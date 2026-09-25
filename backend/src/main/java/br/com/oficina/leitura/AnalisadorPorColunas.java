package br.com.oficina.leitura;

import br.com.oficina.common.RegraNegocioException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Le a tabela pelo espacamento, sem exigir que os valores sejam numeros.
 *
 * A estrategia alinhada exige "numero nome valor min max unidade", todos
 * numericos. Isso quebra em linhas absolutamente normais de scanner:
 *
 *   12  Sensor de oxigenio         ON      -       -       -
 *   47  Status da embreagem        Ativo
 *   88  Codigo de falha            P0301   ---     ---
 *
 * Nenhuma delas tem tres numeros, e todas viraram linha perdida. Aqui o
 * criterio e outro: se a linha COMECA com um numero de item e sobra texto
 * depois, ela e uma linha da tabela — o que vier depois e tratado como
 * texto, e so vira numero quando for numero de verdade.
 *
 * Esta estrategia le mais linhas e com menos precisao nas colunas. Por isso
 * ela e a segunda: so entra quando a primeira deixou buraco.
 */
@Component
public class AnalisadorPorColunas implements EstrategiaDeRelatorio {

    static final String NOME = "Tolerante — separa por espaços";

    private static final int MAXIMO_DE_ITENS = 2000;

    /** Numero do item no inicio da linha, e todo o resto depois dele. */
    private static final Pattern LINHA = Pattern.compile("^\\s*(\\d{1,4})\\s{1,}(\\S.*)$");

    private static final Pattern CAMINHO = Pattern.compile("^caminho:\\s*(.+)$",
            Pattern.CASE_INSENSITIVE);

    /** Linhas que nao sao dado: cabecalho de tabela, rodape, paginacao. */
    private static final Pattern RUIDO = Pattern.compile(
            "^(no\\.?\\s|autel\\b|www\\.|\\d+\\s*/\\s*\\d+$|nome\\s+valor)",
            Pattern.CASE_INSENSITIVE);

    private final AnalisadorRelatorioAutel alinhado;

    public AnalisadorPorColunas(AnalisadorRelatorioAutel alinhado) {
        this.alinhado = alinhado;
    }

    @Override
    public String nome() {
        return NOME;
    }

    @Override
    public RelatorioScanner.Previa analisar(String texto) {
        // O cabecalho (marca, modelo, km, ferramenta) ja e bem lido pela
        // estrategia alinhada, e ele nao depende do formato da tabela.
        // Reaproveitar evita duas verdades diferentes sobre o mesmo carro.
        RelatorioScanner.Cabecalho cabecalho = alinhado.analisar(texto).cabecalho();

        List<String> linhas = texto.lines()
                .map(l -> l.replace(" ", " ").replace(" ", " ")
                        .replace(" ", " ").strip())
                .toList();

        List<String> avisos = new ArrayList<>();
        List<RelatorioScanner.Modulo> modulos = new ArrayList<>();
        List<RelatorioScanner.Item> itensAtuais = new ArrayList<>();
        String caminhoAtual = null;

        for (String linha : linhas) {
            if (linha.isEmpty() || RUIDO.matcher(linha).find()) {
                continue;
            }

            Matcher caminho = CAMINHO.matcher(linha);
            if (caminho.matches()) {
                fechar(modulos, caminhoAtual, itensAtuais);
                itensAtuais = new ArrayList<>();
                caminhoAtual = caminho.group(1).strip();
                continue;
            }

            Matcher m = LINHA.matcher(linha);
            if (!m.matches() || itensAtuais.size() >= MAXIMO_DE_ITENS) {
                continue;
            }
            itensAtuais.add(montar(Integer.parseInt(m.group(1)), m.group(2)));
        }
        fechar(modulos, caminhoAtual, itensAtuais);

        int total = modulos.stream().mapToInt(mo -> mo.itens().size()).sum();
        if (total == 0) {
            throw new RegraNegocioException("Nenhuma linha de dados reconhecida.");
        }

        RelatorioScanner.Qualidade qualidade = QualidadeDaLeitura.medir(modulos, NOME);
        if (!qualidade.confiavel()) {
            avisos.add("Faltaram %d linha(s) numeradas de %d."
                    .formatted(qualidade.faltando().size(), qualidade.esperados()));
        }
        return new RelatorioScanner.Previa(cabecalho, modulos, avisos, qualidade);
    }

    /**
     * Quebra o resto da linha em colunas por dois ou mais espacos.
     *
     * A primeira coluna e o nome; a segunda, o valor; as duas seguintes,
     * minimo e maximo quando forem numeros; a ultima, a unidade. Coluna que
     * nao e numero fica como texto em vez de sumir — "ON" e um valor tao
     * legitimo quanto "728".
     */
    private RelatorioScanner.Item montar(int numero, String resto) {
        String[] colunas = resto.split("\\s{2,}");
        String nome = colunas[0].strip();
        String valor = colunas.length > 1 ? colunas[1].strip() : null;

        BigDecimal minimo = colunas.length > 2 ? numero(colunas[2]) : null;
        BigDecimal maximo = colunas.length > 3 ? numero(colunas[3]) : null;

        // A unidade e a ultima coluna, desde que nao seja um dos numeros
        // que ja foram lidos como minimo/maximo.
        String unidade = null;
        if (colunas.length > 4) {
            unidade = colunas[colunas.length - 1].strip();
        } else if (colunas.length == 3 && minimo == null) {
            unidade = colunas[2].strip();
        }

        return new RelatorioScanner.Item(numero, nome, valor, numero(valor),
                minimo, maximo, vazioComoNulo(unidade));
    }

    private void fechar(List<RelatorioScanner.Modulo> modulos,
                        String caminho,
                        List<RelatorioScanner.Item> itens) {
        if (itens.isEmpty()) {
            return;
        }
        String nome = caminho == null ? "Modulo" : ultimoSegmento(caminho);
        modulos.add(new RelatorioScanner.Modulo(nome, caminho, List.copyOf(itens)));
    }

    private String ultimoSegmento(String caminho) {
        String[] partes = caminho.split(">");
        for (int i = partes.length - 1; i >= 0; i--) {
            String p = partes[i].strip();
            if (!p.isEmpty() && !p.toLowerCase().startsWith("dados")) {
                return p;
            }
        }
        return "Modulo";
    }

    private static BigDecimal numero(String texto) {
        if (texto == null) {
            return null;
        }
        String limpo = texto.strip().replace(",", ".");
        if (!limpo.matches("-?\\d+(\\.\\d+)?")) {
            return null;
        }
        return new BigDecimal(limpo);
    }

    private static String vazioComoNulo(String texto) {
        if (texto == null) {
            return null;
        }
        String limpo = texto.strip();
        // "-" e "---" sao como o scanner escreve "nao se aplica".
        return limpo.isEmpty() || limpo.matches("-+") ? null : limpo;
    }
}
