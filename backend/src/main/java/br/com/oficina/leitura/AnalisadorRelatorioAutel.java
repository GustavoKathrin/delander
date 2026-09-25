package br.com.oficina.leitura;

import br.com.oficina.common.RegraNegocioException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Texto do relatorio do Autel -> rascunho de leitura.
 *
 * Nao conhece PDF: recebe String. E o que torna o pedaco dificil testavel sem
 * arquivo binario nenhum.
 *
 * O relatorio e em portugues de Portugal ("Dados actuais", "Matricula",
 * "Val. Borboleta"), entao toda comparacao e feita sem acento e em minusculas.
 * Isso e o truque de robustez que mais importa aqui.
 */
@Component
public class AnalisadorRelatorioAutel implements EstrategiaDeRelatorio {

    static final String NOME = "Autel — colunas alinhadas";

    private static final int MAXIMO_DE_ITENS = 2000;

    /** NO. | nome | valor | MIN | MAX | unidade(opcional) */
    private static final Pattern LINHA_COMPLETA = Pattern.compile(
            "^\\s*(\\d{1,3})\\s+(.+?)\\s+(-?\\d+(?:[.,]\\d+)?)\\s+(-?\\d+(?:[.,]\\d+)?)"
                    + "\\s+(-?\\d+(?:[.,]\\d+)?)\\s*(\\S*)\\s*$");

    /** A mesma linha sem o valor: o scanner as vezes deixa a coluna vazia. */
    private static final Pattern LINHA_SEM_VALOR = Pattern.compile(
            "^\\s*(\\d{1,3})\\s+(.+?)\\s+(-?\\d+(?:[.,]\\d+)?)\\s+(-?\\d+(?:[.,]\\d+)?)\\s*(\\S*)\\s*$");

    private static final Pattern MODELO = Pattern.compile("^(\\d{4})/([^/]+)/(.+)$");
    private static final Pattern KM = Pattern.compile("quilometragem:\\s*([\\d.]+)");

    // Estas tres rodam sobre o texto que mantem o caso original (para "V4.00"
    // nao virar "v4.00"), entao precisam ser insensiveis a maiuscula.
    private static final Pattern PLACA =
            Pattern.compile("matricula:\\s*([A-Za-z0-9-]{4,12})", Pattern.CASE_INSENSITIVE);
    private static final Pattern VERSAO =
            Pattern.compile("versao:\\s*(\\S+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern RELATORIO =
            Pattern.compile("numero do relatorio:\\s*(\\S+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern FERRAMENTA = Pattern.compile("ferramenta:\\s*(.+?)(?:\\s{2,}|$)");
    private static final Pattern TESTE =
            Pattern.compile("tempo de teste:\\s*(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})");
    private static final Pattern CAMINHO = Pattern.compile("^caminho:\\s*(.+)$");

    /** Bandas que se repetem em toda pagina e nao sao dado nenhum. */
    private static final List<Pattern> LIXO = List.of(
            Pattern.compile("^\\d{4}/[^/]+/.+$"),                    // 2014/Honda/Civic
            Pattern.compile("^autel\\b"),
            Pattern.compile("www\\.autel\\.com"),
            Pattern.compile("^no\\.?\\s"),                           // cabecalho da tabela
            Pattern.compile("^\\d+\\s*/\\s*\\d+$"),                  // 1/7
            Pattern.compile("^\\d{1,3}$"),                           // numero de pagina solto
            Pattern.compile("^(tempo de teste|numero do relatorio|ferramenta|versao"
                    + "|numero de serie|nome:|tel:|vin\\b|quilometragem|matricula|submodelo"
                    + "|informacoes|dados act?uais|dados atuais|caminho|relatorio"
                    + "|maxidas|oficina:|e-?mail:|endereco:|nome do tecnico)"));

    @Override
    public String nome() {
        return NOME;
    }

    @Override
    public RelatorioScanner.Previa analisar(String texto) {
        if (texto == null || texto.isBlank()) {
            throw new RegraNegocioException(
                    "Nao foi possivel ler texto nenhum do PDF. "
                            + "Se o arquivo for uma imagem escaneada, o sistema ainda nao consegue ler.");
        }

        // PDF usa espaco inquebravel e espaco fino nas colunas; sem trocar por
        // espaco normal os regex de coluna nao casam.
        List<String> linhas = texto.lines()
                .map(l -> l.replace("\u00A0", " ").replace("\u2009", " ")
                        .replace("\u202F", " ").strip())
                .toList();
        List<String> avisos = new ArrayList<>();

        RelatorioScanner.Cabecalho cabecalho = lerCabecalho(linhas);
        List<RelatorioScanner.Modulo> modulos = lerModulos(linhas, avisos);

        int itens = modulos.stream().mapToInt(m -> m.itens().size()).sum();
        if (itens == 0) {
            throw new RegraNegocioException(
                    "O PDF foi lido, mas nenhuma linha de dados foi reconhecida. "
                            + "Confira se e o relatorio de 'Dados actuais' do scanner.");
        }
        if (itens >= MAXIMO_DE_ITENS) {
            avisos.add("O relatorio tem muitas linhas; foram lidas as primeiras " + MAXIMO_DE_ITENS + ".");
        }
        if (cabecalho.placaSugerida() != null) {
            avisos.add("A placa do relatorio (%s) e so uma sugestao — confirme o carro."
                    .formatted(cabecalho.placaSugerida()));
        }

        RelatorioScanner.Qualidade qualidade = QualidadeDaLeitura.medir(modulos, NOME);
        if (!qualidade.confiavel()) {
            avisos.add("Faltaram %d linha(s) numeradas no meio da tabela (de %d). "
                    .formatted(qualidade.faltando().size(), qualidade.esperados())
                    + "O relatorio numera as proprias linhas, e esses numeros nao apareceram.");
        }

        return new RelatorioScanner.Previa(cabecalho, modulos, avisos, qualidade);
    }

    // ------------------------------------------------------------- cabecalho

    private RelatorioScanner.Cabecalho lerCabecalho(List<String> linhas) {
        String marca = null;
        String modelo = null;
        Integer ano = null;
        Integer km = null;
        String placa = null;
        String ferramenta = null;
        String versao = null;
        String numeroRelatorio = null;
        java.time.OffsetDateTime momento = null;

        for (String linha : linhas) {
            String chave = semAcento(linha);
            // Mesmo texto sem acento mas COM o caso original: "V4.00" nao pode
            // virar "v4.00" so porque a busca e insensivel a maiuscula.
            String comCaso = semAcentoMantendoCaso(linha);

            if (marca == null) {
                Matcher m = MODELO.matcher(linha);
                if (m.matches()) {
                    ano = inteiro(m.group(1));
                    marca = m.group(2).strip();
                    modelo = ateOProximoRotulo(m.group(3));
                }
            }
            km = km != null ? km : primeiroInteiro(KM, chave);
            placa = placa != null ? placa : primeiro(PLACA, comCaso, true);
            ferramenta = ferramenta != null
                    ? ferramenta
                    : ateOProximoRotulo(primeiroOriginal(FERRAMENTA, chave, linha));
            versao = versao != null ? versao : primeiro(VERSAO, comCaso, false);
            numeroRelatorio = numeroRelatorio != null ? numeroRelatorio : primeiro(RELATORIO, comCaso, true);

            if (momento == null) {
                Matcher m = TESTE.matcher(chave);
                if (m.find()) {
                    momento = LocalDateTime
                            .parse(m.group(1), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                            .atZone(ZoneId.systemDefault())
                            .toOffsetDateTime();
                }
            }
        }
        return new RelatorioScanner.Cabecalho(marca, modelo, ano, km, placa,
                ferramenta, versao, numeroRelatorio, momento);
    }

    // --------------------------------------------------------------- modulos

    private List<RelatorioScanner.Modulo> lerModulos(List<String> linhas, List<String> avisos) {
        List<RelatorioScanner.Modulo> modulos = new ArrayList<>();
        List<RelatorioScanner.Item> itens = new ArrayList<>();
        String nomeAtual = null;
        String caminhoAtual = null;
        int ignoradas = 0;
        int total = 0;

        for (String linha : linhas) {
            if (linha.isBlank()) {
                continue;
            }
            String chave = semAcento(linha);

            // Cada "Caminho:" abre um modulo novo: um PDF pode trazer mais de um.
            Matcher caminho = CAMINHO.matcher(chave);
            if (caminho.find()) {
                if (nomeAtual != null && !itens.isEmpty()) {
                    modulos.add(new RelatorioScanner.Modulo(nomeAtual, caminhoAtual, List.copyOf(itens)));
                }
                itens = new ArrayList<>();
                caminhoAtual = linha.substring(linha.indexOf(':') + 1).strip();
                nomeAtual = moduloDoCaminho(caminhoAtual);
                continue;
            }

            if (ehLixo(chave)) {
                continue;
            }
            if (total >= MAXIMO_DE_ITENS) {
                break;
            }

            RelatorioScanner.Item item = lerItem(linha);
            if (item != null) {
                itens.add(item);
                total++;
            } else if (pareceLinhaDeDado(chave)) {
                ignoradas++;
            }
        }

        if (!itens.isEmpty()) {
            modulos.add(new RelatorioScanner.Modulo(
                    nomeAtual != null ? nomeAtual : "Modulo", caminhoAtual, List.copyOf(itens)));
        }
        if (ignoradas > 0) {
            avisos.add("%d linha(s) nao foram reconhecidas e ficaram de fora. Confira a lista."
                    .formatted(ignoradas));
        }
        return modulos;
    }

    /**
     * "Selecao automatica > GERAL > Unidade de controlo > PGM-FI > Dados actuais >"
     * vira "PGM-FI": o ultimo segmento util antes de "Dados actuais".
     */
    private String moduloDoCaminho(String caminho) {
        List<String> partes = new ArrayList<>();
        for (String p : caminho.split(">")) {
            String limpo = p.strip();
            if (limpo.isEmpty()) {
                continue;
            }
            String chave = semAcento(limpo);
            if (chave.matches("dados act?uais|dados atuais|live data|datastream")) {
                continue;
            }
            partes.add(semRotuloInicial(limpo));
        }
        return partes.isEmpty() ? "Modulo" : partes.get(partes.size() - 1);
    }

    // ----------------------------------------------------------------- itens

    private RelatorioScanner.Item lerItem(String linha) {
        Matcher completa = LINHA_COMPLETA.matcher(linha);
        if (completa.matches()) {
            return new RelatorioScanner.Item(
                    inteiro(completa.group(1)),
                    completa.group(2).strip(),
                    completa.group(3),
                    decimal(completa.group(3)),
                    decimal(completa.group(4)),
                    decimal(completa.group(5)),
                    unidade(completa.group(6)));
        }

        Matcher semValor = LINHA_SEM_VALOR.matcher(linha);
        if (semValor.matches()) {
            return new RelatorioScanner.Item(
                    inteiro(semValor.group(1)),
                    semValor.group(2).strip(),
                    null,
                    null,
                    decimal(semValor.group(3)),
                    decimal(semValor.group(4)),
                    unidade(semValor.group(5)));
        }
        return null;
    }

    /** Comeca com numero e tem texto: provavelmente era dado e o parser errou. */
    private boolean pareceLinhaDeDado(String chave) {
        return chave.matches("^\\d{1,3}\\s+\\S.*") && chave.length() > 6;
    }

    private boolean ehLixo(String chave) {
        for (Pattern p : LIXO) {
            if (p.matcher(chave).find()) {
                return true;
            }
        }
        return false;
    }

    // ----------------------------------------------------------------- apoio

    /** Sem acento e sem caso: para comparar. */
    /**
     * Rotulos que aparecem no cabecalho do relatorio.
     *
     * Existem porque a Autel nem sempre quebra linha entre um campo e o
     * proximo: dependendo da versao e do idioma, uma linha sai como
     * "2014/Honda/Civic Quilometragem: 175811 km" ou
     * "Ferramenta: MaxiDAS DS900-BT Numero de serie: VX2GR5C01294".
     * Quem captura "ate o fim da linha" leva o campo seguinte junto.
     */
    private static final Pattern PROXIMO_ROTULO = Pattern.compile(
            "\\s*\\b(quilometragem|numero de serie|matricula|vin|versao|nome|tel"
                    + "|tempo de teste|numero do relatorio|submodelo|unidade submodelo"
                    + "|ferramenta)\\s*:",
            Pattern.CASE_INSENSITIVE);

    /**
     * Corta um valor onde comeca o proximo rotulo.
     *
     * Sem isto, o modelo do carro vira "Civic Quilometragem: 175811 km" — e
     * aquele Civic deixa de casar com os outros Civic 2014 do acervo, que e
     * justamente o que da valor a leitura guardada.
     */
    private static String ateOProximoRotulo(String valor) {
        if (valor == null) {
            return null;
        }
        Matcher corte = PROXIMO_ROTULO.matcher(semAcentoMantendoCaso(valor));
        String limpo = corte.find() ? valor.substring(0, corte.start()) : valor;
        return limpo.strip();
    }

    /**
     * Tira o rotulo que veio grudado no inicio do valor.
     *
     * "Unidade Submodelo: GERAL" e o nome do modulo com a etiqueta junto; o
     * nome e "GERAL". Com a etiqueta, cada relatorio de fabricante diferente
     * criaria um modulo novo para o mesmo lugar do carro.
     */
    private static String semRotuloInicial(String valor) {
        if (valor == null) {
            return null;
        }
        Matcher rotulo = PROXIMO_ROTULO.matcher(semAcentoMantendoCaso(valor));
        if (rotulo.find() && rotulo.start() == 0) {
            return valor.substring(rotulo.end()).strip();
        }
        return valor.strip();
    }

    private static String semAcento(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .strip();
    }

    /** Sem acento mas com o caso original: para extrair valor legivel. */
    private static String semAcentoMantendoCaso(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .strip();
    }

    /**
     * Virgula so vira ponto quando e claramente decimal. "1,234" pode ser
     * separador de milhar, e trocar as cegas inventaria um numero errado.
     */
    private static BigDecimal decimal(String bruto) {
        if (bruto == null || bruto.isBlank()) {
            return null;
        }
        String limpo = bruto.strip();
        boolean temPonto = limpo.indexOf('.') >= 0;
        long virgulas = limpo.chars().filter(c -> c == ',').count();
        if (virgulas == 1 && !temPonto) {
            limpo = limpo.replace(',', '.');
        } else if (virgulas > 0) {
            limpo = limpo.replace(",", "");
        }
        try {
            return new BigDecimal(limpo);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer inteiro(String bruto) {
        try {
            return Integer.valueOf(bruto.replaceAll("\\D", ""));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String unidade(String bruto) {
        if (bruto == null) {
            return null;
        }
        String limpo = bruto.strip();
        return limpo.isEmpty() || limpo.length() > 20 ? null : limpo;
    }

    private static String primeiro(Pattern p, String chave, boolean maiusculas) {
        Matcher m = p.matcher(chave);
        if (!m.find()) {
            return null;
        }
        String valor = m.group(1).strip();
        return maiusculas ? valor.toUpperCase() : valor;
    }

    /** Casa na versao sem acento mas devolve o texto original, com acento. */
    private static String primeiroOriginal(Pattern p, String chave, String original) {
        Matcher m = p.matcher(chave);
        if (!m.find()) {
            return null;
        }
        int inicio = original.toLowerCase().indexOf(':', Math.max(m.start() - 1, 0));
        if (inicio < 0 || inicio + 1 >= original.length()) {
            return m.group(1).strip();
        }
        String resto = original.substring(inicio + 1).strip();
        String[] colunas = resto.split("\\s{2,}");
        return colunas[0].strip();
    }

    private static Integer primeiroInteiro(Pattern p, String chave) {
        String bruto = primeiro(p, chave, false);
        return bruto == null ? null : inteiro(bruto);
    }
}
