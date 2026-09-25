package br.com.oficina.peca;

/**
 * De onde a peca vem.
 *
 * E a diferenca entre "isso custa R$ 80" e "alguem precisa ir atras disso".
 * Peca de estoque entra no orcamento e nunca aparece na fila de compras;
 * so a de compra vira trabalho para alguem.
 */
public enum OrigemPeca {

    /** Ja esta na prateleira da oficina. */
    ESTOQUE,

    /** Precisa ser comprada: entra na fila do dono e do atendente. */
    COMPRAR;

    public String descricao() {
        return switch (this) {
            case ESTOQUE -> "Temos aqui";
            case COMPRAR -> "Precisa comprar";
        };
    }
}
