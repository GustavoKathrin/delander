package br.com.oficina.ordemservico;

public enum Prioridade {
    BAIXA,
    NORMAL,
    ALTA,
    URGENTE;

    public int peso() {
        return switch (this) {
            case URGENTE -> 4;
            case ALTA -> 3;
            case NORMAL -> 2;
            case BAIXA -> 1;
        };
    }

    public String descricao() {
        return switch (this) {
            case BAIXA -> "Baixa";
            case NORMAL -> "Normal";
            case ALTA -> "Alta";
            case URGENTE -> "Urgente";
        };
    }
}
