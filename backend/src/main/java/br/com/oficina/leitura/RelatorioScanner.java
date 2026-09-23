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

    public record Previa(Cabecalho cabecalho, List<Modulo> modulos, List<String> avisos) {

        public int totalDeItens() {
            return modulos.stream().mapToInt(m -> m.itens().size()).sum();
        }
    }
}
