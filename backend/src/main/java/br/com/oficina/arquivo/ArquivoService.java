package br.com.oficina.arquivo;

import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.ordemservico.EventoService;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import br.com.oficina.ordemservico.OsDtos;
import br.com.oficina.ordemservico.OsItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Fotos e documentos da OS.
 *
 * As regras de disco (tipo pelos bytes iniciais, nome gerado pelo servidor,
 * limite de tamanho, caminho preso na raiz de uploads) moram em
 * {@link ArmazenamentoArquivos}, porque as leituras do scanner precisam das
 * mesmas. A API publica deste servico nao mudou.
 */
@Service
public class ArquivoService {

    private static final Logger log = LoggerFactory.getLogger(ArquivoService.class);

    private final ArquivoOsRepository repository;
    private final OrdemServicoRepository osRepository;
    private final EventoService eventoService;
    private final ArmazenamentoArquivos armazenamento;
    private final Contexto contexto;

    public ArquivoService(ArquivoOsRepository repository,
                          OrdemServicoRepository osRepository,
                          EventoService eventoService,
                          ArmazenamentoArquivos armazenamento,
                          Contexto contexto) {
        this.repository = repository;
        this.osRepository = osRepository;
        this.eventoService = eventoService;
        this.armazenamento = armazenamento;
        this.contexto = contexto;
    }

    /**
     * Anexa uma foto, opcionalmente colada em UM servico da OS.
     *
     * Com `osItemId`, a foto deixa de ser "do carro" e passa a ser "da troca
     * da correia" -- que e a pergunta que o cliente faz e que quatro fotos de
     * motor aberto nao respondem.
     */
    @Transactional
    public OsDtos.ArquivoResposta salvar(UUID osId, MultipartFile arquivo, String momento,
                                         boolean visivelCliente, UUID osItemId) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = osRepository.buscarCompleta(osId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Ordem de servico", osId));
        if (!os.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }

        String momentoValidado = List.of("ENTRADA", "EXECUCAO", "SAIDA").contains(momento)
                ? momento : "EXECUCAO";

        // O servico tem que ser DESTE carro. Sem esta checagem, um id de item
        // de outra oficina rotularia a foto com um servico que o dono nao
        // consegue abrir -- e a galeria mostraria um nome que nao existe.
        OsItem servico = null;
        if (osItemId != null) {
            servico = os.getItens().stream()
                    .filter(i -> i.getId().equals(osItemId))
                    .findFirst()
                    .orElseThrow(() -> new RegraNegocioException(
                            "Este servico nao e deste carro."));
        }

        // A subpasta continua sendo o id da OS: os caminhos ja gravados no
        // banco precisam continuar resolvendo.
        ArmazenamentoArquivos.Guardado guardado = armazenamento.guardar(arquivo, osId.toString());

        ArquivoOs registro = new ArquivoOs();
        registro.setOficinaId(oficinaId);
        registro.setOrdemServicoId(osId);
        registro.setOsItemId(servico == null ? null : servico.getId());
        registro.setNomeOriginal(guardado.nomeOriginal());
        registro.setCaminho(guardado.caminhoRelativo());
        registro.setContentType(guardado.contentType());
        registro.setTamanho(guardado.tamanho());
        registro.setMomento(momentoValidado);
        registro.setVisivelCliente(visivelCliente);
        registro.setCriadoEm(OffsetDateTime.now());
        registro.setCriadoPor(contexto.usuario().email());
        ArquivoOs salvo = repository.save(registro);

        if ("ENTRADA".equals(momentoValidado)) {
            apagarEntradasAntigas(os);
        }

        // Com servico, o evento diz de qual: na linha do tempo de um carro com
        // cinco servicos, "Arquivo anexado" sozinho nao localiza nada.
        eventoService.registrar(oficinaId, osId, EventoService.FOTO_ANEXADA,
                servico == null
                        ? "Arquivo anexado: " + salvo.getNomeOriginal()
                        : "Foto de %s: %s".formatted(servico.getDescricao(), salvo.getNomeOriginal()),
                visivelCliente);

        return resposta(salvo, servico == null ? null : servico.getDescricao());
    }

    /**
     * Cada carro guarda uma foto de entrada so: a de agora.
     *
     * Decisao da oficina, e ela tem duas razoes. A primeira e disco: foto de
     * entrada de todo carro em toda passagem cresce sem parar e ninguem volta
     * para limpar. A segunda e mais importante: a foto da visita passada nao
     * prova o estado de hoje. Guardada, ela viraria prova contra a propria
     * oficina numa discussao sobre um risco que apareceu depois.
     *
     * Apaga do disco e do banco. Silencioso de proposito: falhar aqui
     * derrubaria o upload que acabou de dar certo, e o que importa — a foto
     * de hoje — ja esta gravada.
     */
    private void apagarEntradasAntigas(OrdemServico os) {
        List<ArquivoOs> antigas =
                repository.entradasDeOutrasPassagens(os.getVeiculo().getId(), os.getId());
        if (antigas.isEmpty()) {
            return;
        }
        for (ArquivoOs antiga : antigas) {
            try {
                armazenamento.apagar(antiga.getCaminho());
            } catch (RuntimeException e) {
                log.warn("Nao foi possivel apagar a foto de entrada {}: {}",
                        antiga.getCaminho(), e.getMessage());
            }
        }
        repository.deleteAll(antigas);
        log.info("Foto de entrada do veiculo {} substituida ({} arquivo(s) antigo(s) removido(s)).",
                os.getVeiculo().getPlaca(), antigas.size());
    }

    @Transactional(readOnly = true)
    public ArquivoOs metadados(UUID osId, UUID arquivoId) {
        ArquivoOs arquivo = repository.findById(arquivoId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Arquivo", arquivoId));
        if (!arquivo.getOrdemServicoId().equals(osId)
                || !arquivo.getOficinaId().equals(contexto.oficinaId())) {
            throw RecursoNaoEncontradoException.de("Arquivo", arquivoId);
        }
        return arquivo;
    }

    /** Usado pela pagina publica: valida se a foto foi liberada para o cliente. */
    @Transactional(readOnly = true)
    public ArquivoOs metadadosPublicos(UUID osId, UUID arquivoId) {
        ArquivoOs arquivo = repository.findById(arquivoId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Arquivo", arquivoId));
        if (!arquivo.getOrdemServicoId().equals(osId) || !arquivo.isVisivelCliente()) {
            throw RecursoNaoEncontradoException.de("Arquivo", arquivoId);
        }
        return arquivo;
    }

    /**
     * Libera (ou recolhe) a foto para o link do cliente.
     *
     * A foto nasce interna de proposito: foto de motor aberto no meio do
     * servico ajuda um cliente e assusta outro, e quem sabe qual dos dois e
     * este nao e quem configurou a oficina -- e quem esta com o carro na
     * frente. Mesma regra do escopo do link: muda quem trabalha no carro.
     */
    @Transactional
    public OsDtos.ArquivoResposta visibilidade(UUID osId, UUID arquivoId, boolean visivelCliente) {
        contexto.exigirEquipe("Mudar o que o cliente vê é de quem trabalha no carro.");
        ArquivoOs arquivo = metadados(osId, arquivoId);
        arquivo.setVisivelCliente(visivelCliente);
        ArquivoOs salvo = repository.save(arquivo);
        return resposta(salvo, null);
    }

    /**
     * Remove uma foto.
     *
     * Existe porque a alternativa e pior: a foto e tirada de luva, com o
     * celular na mao, dentro do box -- e a primeira sai tremida ou do chao.
     * Sem apagar, a galeria vira lixo e, se a foto estiver liberada, o
     * cliente ve o chao do box.
     *
     * A foto de ENTRADA e a excecao: ela e prova de como o carro chegou, para
     * os dois lados. Quem apaga prova e a gerencia, assumindo a escolha.
     */
    @Transactional
    public void apagar(UUID osId, UUID arquivoId) {
        ArquivoOs arquivo = metadados(osId, arquivoId);
        if ("ENTRADA".equals(arquivo.getMomento())) {
            contexto.exigirGerencia();
        } else {
            contexto.exigirMaoNaMassa();
        }
        try {
            armazenamento.apagar(arquivo.getCaminho());
        } catch (RuntimeException e) {
            // O registro vai embora de qualquer jeito: um arquivo orfao no
            // disco incomoda o servidor, uma linha orfa no banco mostra ao
            // cliente uma imagem quebrada.
            log.warn("Nao foi possivel apagar o arquivo {}: {}", arquivo.getCaminho(), e.getMessage());
        }
        repository.delete(arquivo);
        eventoService.registrar(contexto.oficinaId(), osId, EventoService.FOTO_ANEXADA,
                "Arquivo removido: " + arquivo.getNomeOriginal(), false);
    }

    public Resource conteudo(ArquivoOs arquivo) {
        return armazenamento.conteudo(arquivo.getCaminho());
    }

    /**
     * O anexo como a tela precisa dele.
     *
     * Estatico e aqui porque o formato da URL e o teste de "da para mostrar
     * como miniatura" estavam escritos em dois lugares -- a lista do detalhe
     * e a resposta do upload -- e so um deles mudava quando a regra mudava.
     *
     * `servico` vem de fora: quem chama ja carregou os itens da OS, e buscar
     * a descricao aqui seria uma ida ao banco por foto.
     */
    public static OsDtos.ArquivoResposta resposta(ArquivoOs a, String servico) {
        return new OsDtos.ArquivoResposta(
                a.getId(),
                a.getNomeOriginal(),
                "/api/os/%s/arquivos/%s".formatted(a.getOrdemServicoId(), a.getId()),
                a.getMomento(),
                a.isVisivelCliente(),
                a.getCriadoEm(),
                a.getOsItemId(),
                servico,
                a.getContentType() != null && a.getContentType().startsWith("image/"));
    }
}
