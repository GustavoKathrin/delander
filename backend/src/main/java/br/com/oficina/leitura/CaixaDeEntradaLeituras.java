package br.com.oficina.leitura;

import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.config.AppProperties;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoRepository;
import br.com.oficina.configuracao.ConfiguracaoService;
import jakarta.mail.BodyPart;
import jakarta.mail.Flags;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.search.FlagTerm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * O relatorio do scanner chega por e-mail e entra sozinho.
 *
 * O tablet do scanner manda o PDF para uma caixa da oficina. Ate aqui alguem
 * tinha que abrir o e-mail, baixar o arquivo e importar na tela. Este job faz
 * esse caminho — e para nele: a leitura nasce PENDENTE, porque o PDF nao diz
 * se o motor estava ligado nem de que carro e, e inventar isso estragaria
 * justamente o dado que a ferramenta existe para guardar.
 *
 * Desligado por padrao. Com a chave desligada nao abre conexao nenhuma.
 *
 * As guardas existem porque uma caixa de e-mail e uma porta para o mundo:
 * so remetente da lista, so assunto com a palavra combinada, so anexo que e
 * PDF pelos BYTES, teto de tamanho, de anexos e de mensagens por rodada,
 * timeout na conexao e na leitura. E-mail nunca e apagado, e so vira lido
 * quando a mensagem foi tratada ate o fim sem erro inesperado.
 */
@Component
public class CaixaDeEntradaLeituras {

    private static final Logger log = LoggerFactory.getLogger(CaixaDeEntradaLeituras.class);

    /** Tetos por rodada: uma caixa com 3 mil e-mails nao pode travar o sistema. */
    private static final int MAX_MENSAGENS = 20;
    private static final int MAX_ANEXOS = 5;
    private static final long MAX_BYTES = 8L * 1024 * 1024;
    private static final String TIMEOUT_MS = "20000";

    private final ConfiguracaoService config;
    private final ConfiguracaoRepository configuracaoRepository;
    private final LeituraService leituraService;
    private final LeitorPdfAutel leitor;
    private final AnalisadorRelatorioAutel analisador;
    private final AppProperties props;
    private final Clock clock;

    /**
     * Quando cada oficina foi lida pela ultima vez.
     *
     * O intervalo e configuravel pela tela e @Scheduled nao le do banco: o
     * job acorda de minuto em minuto e cada oficina decide se ja e hora. Em
     * memoria de proposito — perder isso num restart custa uma consulta a
     * mais na caixa, nada.
     */
    private final Map<UUID, Instant> ultimaRodada = new ConcurrentHashMap<>();

    public CaixaDeEntradaLeituras(ConfiguracaoService config,
                                  ConfiguracaoRepository configuracaoRepository,
                                  LeituraService leituraService,
                                  LeitorPdfAutel leitor,
                                  AnalisadorRelatorioAutel analisador,
                                  AppProperties props,
                                  Clock clock) {
        this.config = config;
        this.configuracaoRepository = configuracaoRepository;
        this.leituraService = leituraService;
        this.leitor = leitor;
        this.analisador = analisador;
        this.props = props;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void buscar() {
        for (UUID oficinaId : configuracaoRepository.oficinasConfiguradas()) {
            try {
                buscarDaOficina(oficinaId);
            } catch (Exception e) {
                // Uma caixa fora do ar nao pode impedir a proxima oficina nem
                // derrubar o agendador.
                log.warn("Leituras por e-mail: falha na oficina {}: {}", oficinaId, e.getMessage());
            }
        }
    }

    private void buscarDaOficina(UUID oficinaId) throws Exception {
        if (!config.flag(oficinaId, Chaves.EMAIL_LEITURAS_ATIVO)) {
            return;
        }
        AppProperties.Imap imap = props.imap();
        if (imap == null || !imap.configurado()) {
            log.warn("Leituras por e-mail ligadas na oficina {}, mas sem APP_IMAP_HOST/USUARIO/SENHA. "
                    + "Nada sera lido.", oficinaId);
            return;
        }

        int minutos = Math.max(1, config.inteiro(oficinaId, Chaves.EMAIL_INTERVALO_MINUTOS, 15));
        Instant agora = clock.instant();
        Instant anterior = ultimaRodada.get(oficinaId);
        if (anterior != null && Duration.between(anterior, agora).toMinutes() < minutos) {
            return;
        }
        ultimaRodada.put(oficinaId, agora);

        List<String> remetentes = listaDeRemetentes(oficinaId);
        if (remetentes.isEmpty()) {
            log.warn("Leituras por e-mail ligadas na oficina {} sem nenhum remetente autorizado. "
                    + "Preencha \"De quem aceitar\" em Configuracoes.", oficinaId);
            return;
        }
        String palavraChave = semAcento(
                config.texto(oficinaId, Chaves.EMAIL_ASSUNTO, "RELATORIO DE DIAGNOSTICO"));
        // Campo apagado na tela vem como texto vazio, e getFolder("") estoura.
        String pasta = config.texto(oficinaId, Chaves.EMAIL_PASTA, "INBOX");
        if (pasta == null || pasta.isBlank()) {
            pasta = "INBOX";
        }

        Store store = null;
        Folder caixa = null;
        try {
            store = Session.getInstance(propriedadesImap(imap)).getStore(imap.ssl() ? "imaps" : "imap");
            store.connect(imap.host(), imap.porta(), imap.usuario(), imap.senha());

            caixa = store.getFolder(pasta);
            if (!caixa.exists()) {
                log.warn("Pasta \"{}\" nao existe na caixa de e-mail.", pasta);
                return;
            }
            caixa.open(Folder.READ_WRITE);

            Message[] naoLidas = caixa.search(new FlagTerm(new Flags(Flags.Flag.SEEN), false));
            int examinadas = 0;
            int gravadas = 0;

            for (Message mensagem : naoLidas) {
                if (examinadas >= MAX_MENSAGENS) {
                    break;
                }
                examinadas++;

                if (!remetenteAutorizado(mensagem, remetentes)
                        || !assuntoConfere(mensagem, palavraChave)) {
                    continue;
                }

                String remetente = primeiroRemetente(mensagem);
                Resultado resultado = new Resultado();
                percorrer(mensagem, oficinaId, remetente, resultado);
                gravadas += resultado.gravadas;

                // So marca como lido quando a mensagem foi tratada ate o fim
                // sem erro inesperado. Se o banco caiu no meio, ela continua
                // la para a proxima rodada. Nunca apagamos nada.
                if (!resultado.falhou) {
                    mensagem.setFlag(Flags.Flag.SEEN, true);
                }
            }

            if (gravadas > 0) {
                log.info("Leituras por e-mail: {} relatorio(s) gravado(s) como pendentes.", gravadas);
            }
        } finally {
            if (caixa != null && caixa.isOpen()) {
                caixa.close(false);
            }
            if (store != null && store.isConnected()) {
                store.close();
            }
        }
    }

    /** O que aconteceu com uma mensagem. */
    private static final class Resultado {
        int gravadas;
        int anexosVistos;
        /** Erro inesperado: a mensagem fica nao lida para tentar de novo. */
        boolean falhou;
    }

    /**
     * Anda pela mensagem atras de PDF.
     *
     * Recursivo porque cliente de e-mail aninha: multipart/mixed com um
     * multipart/alternative dentro e comum, e um anexo perdido nesse segundo
     * nivel viraria "nao aconteceu nada" — o pior jeito de falhar.
     */
    private void percorrer(Part parte, UUID oficinaId, String remetente, Resultado resultado) {
        if (resultado.anexosVistos >= MAX_ANEXOS) {
            return;
        }
        try {
            Object conteudo = parte.getContent();
            if (conteudo instanceof Multipart partes) {
                for (int i = 0; i < partes.getCount(); i++) {
                    BodyPart filha = partes.getBodyPart(i);
                    percorrer(filha, oficinaId, remetente, resultado);
                }
                return;
            }
        } catch (Exception e) {
            resultado.falhou = true;
            log.info("Nao foi possivel abrir parte da mensagem de {}: {}", remetente, e.getMessage());
            return;
        }

        // Folha: so interessa se tem nome de arquivo ou veio como anexo. O
        // tipo real e conferido pelos bytes, nunca pelo nome.
        try {
            String nome = parte.getFileName();
            boolean anexo = Part.ATTACHMENT.equalsIgnoreCase(parte.getDisposition()) || nome != null;
            if (!anexo) {
                return;
            }
            resultado.anexosVistos++;

            byte[] bytes = ler(parte);
            if (bytes.length == 0) {
                log.info("Anexo de {} ignorado: vazio ou acima de 8 MB.", remetente);
                return;
            }

            RelatorioScanner.Previa previa = analisador.analisar(leitor.extrairTexto(bytes));
            if (previa.totalDeItens() == 0) {
                log.info("Anexo de {} nao parece um relatorio de scanner. Ignorado.", remetente);
                return;
            }

            UUID id = leituraService.registrarPendente(oficinaId, previa, bytes, nome, remetente);
            if (id != null) {
                resultado.gravadas++;
            }
        } catch (RegraNegocioException e) {
            // Recusa nossa: nao e PDF, e grande demais, ja foi importado. A
            // resposta nao muda na proxima rodada — nao vale segurar o e-mail.
            log.info("Anexo de {} recusado: {}", remetente, e.getMessage());
        } catch (Exception e) {
            resultado.falhou = true;
            log.warn("Erro ao gravar anexo de {}: {}", remetente, e.getMessage());
        }
    }

    private byte[] ler(Part parte) throws Exception {
        try (InputStream entrada = parte.getInputStream()) {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            long total = 0;
            int lidos;
            while ((lidos = entrada.read(buffer)) > 0) {
                total += lidos;
                if (total > MAX_BYTES) {
                    // Para de ler em vez de encher a memoria com o que seria
                    // recusado do mesmo jeito.
                    return new byte[0];
                }
                saida.write(buffer, 0, lidos);
            }
            return saida.toByteArray();
        }
    }

    // ============================================================ guardas

    private List<String> listaDeRemetentes(UUID oficinaId) {
        return Arrays.stream(config.texto(oficinaId, Chaves.EMAIL_REMETENTES, "").split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(s -> s.toLowerCase(Locale.ROOT))
                .toList();
    }

    /** Endereco exato, sem caso. Nada de "contem": dominio parecido e truque velho. */
    private boolean remetenteAutorizado(Message mensagem, List<String> autorizados) throws Exception {
        for (InternetAddress endereco : enderecos(mensagem)) {
            String email = endereco.getAddress();
            if (email != null && autorizados.contains(email.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private boolean assuntoConfere(Message mensagem, String palavraChave) throws Exception {
        if (palavraChave.isBlank()) {
            return true;
        }
        String assunto = mensagem.getSubject();
        return assunto != null && semAcento(assunto).contains(palavraChave);
    }

    private String primeiroRemetente(Message mensagem) throws Exception {
        List<InternetAddress> lista = enderecos(mensagem);
        return lista.isEmpty() || lista.get(0).getAddress() == null
                ? "desconhecido"
                : lista.get(0).getAddress();
    }

    private List<InternetAddress> enderecos(Message mensagem) throws Exception {
        List<InternetAddress> lista = new ArrayList<>();
        if (mensagem.getFrom() != null) {
            for (var endereco : mensagem.getFrom()) {
                if (endereco instanceof InternetAddress internet) {
                    lista.add(internet);
                }
            }
        }
        return lista;
    }

    /** Assunto chega com acento, sem acento e em qualquer caixa. Compara igual. */
    private static String semAcento(String texto) {
        return Normalizer.normalize(texto == null ? "" : texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT)
                .trim();
    }

    private Properties propriedadesImap(AppProperties.Imap imap) {
        String protocolo = imap.ssl() ? "imaps" : "imap";
        Properties p = new Properties();
        p.put("mail.store.protocol", protocolo);
        p.put("mail." + protocolo + ".host", imap.host());
        p.put("mail." + protocolo + ".port", String.valueOf(imap.porta()));
        p.put("mail." + protocolo + ".ssl.enable", String.valueOf(imap.ssl()));
        // Sem timeout, uma caixa que nao responde prende a thread do agendador
        // para sempre — e os outros jobs param junto.
        p.put("mail." + protocolo + ".connectiontimeout", TIMEOUT_MS);
        p.put("mail." + protocolo + ".timeout", TIMEOUT_MS);
        p.put("mail." + protocolo + ".writetimeout", TIMEOUT_MS);
        return p;
    }
}
