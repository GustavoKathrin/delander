package br.com.oficina.peca;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public final class PecaCatalogoDtos {

    private PecaCatalogoDtos() {
    }

    public record Requisicao(
            @NotBlank(message = "Informe a peca") @Size(max = 200) String descricao,
            @Size(max = 60) String codigo,
            @Size(max = 120) String fabricante,
            @DecimalMin(value = "0.0", message = "Valor nao pode ser negativo") BigDecimal valorSugerido,
            @DecimalMin(value = "0.0", message = "Estoque nao pode ser negativo") BigDecimal quantidadeEstoque,
            @DecimalMin(value = "0.0", message = "Estoque minimo nao pode ser negativo") BigDecimal estoqueMinimo,
            Boolean ativo) {
    }

    /**
     * @param temEstoque tem na prateleira agora
     * @param acabando   ainda tem, mas chegou no minimo
     */
    public record Resposta(UUID id,
                           String codigo,
                           String descricao,
                           String fabricante,
                           BigDecimal valorSugerido,
                           BigDecimal quantidadeEstoque,
                           BigDecimal estoqueMinimo,
                           boolean temEstoque,
                           boolean acabando,
                           boolean ativo) {

        public static Resposta de(PecaCatalogo p) {
            return new Resposta(
                    p.getId(),
                    p.getCodigo(),
                    p.getDescricao(),
                    p.getFabricante(),
                    p.getValorSugerido(),
                    p.getQuantidadeEstoque(),
                    p.getEstoqueMinimo(),
                    p.temEstoque(),
                    p.acabando(),
                    p.isAtivo());
        }
    }

    /**
     * O que o atendente responde quando a peca comprada chega.
     *
     * O dono foi explicito: ao dar a compra por concluida, a peca **tem** que
     * ficar registrada no estoque. Ou ela e uma peca que o catalogo ja conhece
     * (`catalogoId`), ou nasce agora (`novaDescricao`) — nao existe o caminho
     * de receber sem guardar, porque e assim que o saldo vira ficcao.
     *
     * @param catalogoId     peca que ja existe no catalogo
     * @param novaDescricao  cadastra a peca agora, com este nome
     */
    public record Recebimento(UUID catalogoId,
                              @Size(max = 200) String novaDescricao,
                              @Size(max = 60) String codigo,
                              BigDecimal valorUnitario) {

        public boolean vazio() {
            return catalogoId == null && (novaDescricao == null || novaDescricao.isBlank());
        }
    }
}
