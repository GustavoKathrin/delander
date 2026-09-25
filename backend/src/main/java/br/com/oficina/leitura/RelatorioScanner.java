package br.com.oficina.leitura;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * O que foi lido de um relatorio de scanner, antes de virar Leitura.
 *
 * E so um rascunho: nada disso vai para o banco sem alguem conferir na tela.
 * O parser erra — espacamento de coluna de PDF e imprevisivel — e a tela de
 * conferencia existe justamente para o erro ser barato.
 */
public final class RelatorioScanner {

    private RelatorioScanner() {
    }

    public record Item(Integer numero,
                       String nome,
                       String valor,
                       BigDecimal valorNumerico,
                       BigDecimal minimo,
                       BigDecimal maximo,
                       String unidade) {
    }

    public record Modulo(String nome, String caminho, List<Item> itens) {
    }

    /**
     * Cabecalho do relatorio.
     *
     * De proposito NAO tem VIN, nome nem telefone do cliente, e nem o numero
     * de serie do aparelho: o parser le essas linhas so para descarta-las.
     * A placa vem como SUGESTAO — no relatorio do Autel ela pode estar num
     * formato de outro pais, entao nunca cria veiculo sozinha.
     */
    public record Cabecalho(String marca,
                            String modelo,
                            Integer ano,
                            Integer km,
                            String placaSugerida,
                            String ferramenta,
                            String ferramentaVersao,
                            String numeroRelatorio,
                            OffsetDateTime momentoTeste) {
    }

    /**
     * O quanto da tabela o analisador conseguiu ler.
     *
     * O relatorio numera as proprias linhas, e essa e a melhor testemunha
     * que existe: se o maior numero e 133 e so 95 itens foram lidos, 38
     * linhas ficaram pelo caminho — sem precisar do PDF original para
     * provar. Um analisador que devolve 95 itens sem dizer isso parece
     * ter funcionado, e e assim que leitura incompleta vira acervo furado.
     *
     * @param lidos      itens efetivamente reconhecidos
     * @param esperados  maior numero de linha visto no relatorio
     * @param faltando   numeros de linha que existem no PDF e nao no resultado
     */
    public record Qualidade(int lidos, int esperados, List<Integer> faltando, String estrategia) {

        public int percentual() {
            return esperados <= 0 ? 100 : Math.min(100, lidos * 100 / esperados);
        }

        /** Abaixo disto a importacao nao deve passar batida pela tela. */
        public boolean confiavel() {
            return faltando.isEmpty();
        }
    }

    public record Previa(Cabecalho cabecalho,
                         List<Modulo> modulos,
                         List<String> avisos,
                         Qualidade qualidade) {

        public int totalDeItens() {
            return modulos.stream().mapToInt(m -> m.itens().size()).sum();
        }
    }
}
