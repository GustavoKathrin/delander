package br.com.oficina.peca;

public enum StatusPeca {
    SOLICITADA,
    COMPRADA,
    RECEBIDA,
    APLICADA,
    CANCELADA;

    public String descricao() {
        return switch (this) {
            case SOLICITADA -> "Solicitada";
            case COMPRADA -> "Comprada";
            case RECEBIDA -> "Recebida";
            case APLICADA -> "Aplicada";
            case CANCELADA -> "Cancelada";
        };
    }

    public boolean pendente() {
        return this == SOLICITADA || this == COMPRADA;
    }
}
