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
            case EM_EXECUCAO -> "Em execução";
            case PAUSADO -> "Pausado";
            case CONCLUIDO -> "Concluído";
            case CANCELADO -> "Cancelado";
        };
    }
}
