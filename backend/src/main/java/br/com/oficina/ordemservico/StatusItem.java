package br.com.oficina.ordemservico;

public enum StatusItem {
    PENDENTE,
    EM_EXECUCAO,
    PAUSADO,
    CONCLUIDO,
    CANCELADO;

    public String descricao() {
        return switch (this) {
            case PENDENTE -> "Pendente";
            case EM_EXECUCAO -> "Em execucao";
            case PAUSADO -> "Pausado";
            case CONCLUIDO -> "Concluido";
            case CANCELADO -> "Cancelado";
        };
    }
}
