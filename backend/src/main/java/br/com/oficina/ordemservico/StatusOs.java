package br.com.oficina.ordemservico;

/** Ciclo de vida do carro dentro da oficina. */
public enum StatusOs {
    RECEBIDO,
    EM_DIAGNOSTICO,
    AGUARDANDO_APROVACAO,
    AGENDADO,
    EM_EXECUCAO,
    PAUSADO,
    PRONTO_AGUARDANDO_RETIRADA,
    ENTREGUE,
    CANCELADO;

    /** O carro ainda esta ocupando espaco fisico na oficina? */
    public boolean noPatio() {
        return this != ENTREGUE && this != CANCELADO;
    }

    public boolean finalizada() {
        return this == ENTREGUE || this == CANCELADO;
    }

    /** Estados em que o carro esta parado esperando algo, nao sendo trabalhado. */
    public boolean aguardando() {
        return this == RECEBIDO || this == AGUARDANDO_APROVACAO
                || this == AGENDADO || this == PAUSADO;
    }

    public String descricao() {
        return switch (this) {
            case RECEBIDO -> "Recebido";
            case EM_DIAGNOSTICO -> "Em diagnostico";
            case AGUARDANDO_APROVACAO -> "Aguardando aprovacao";
            case AGENDADO -> "Agendado";
            case EM_EXECUCAO -> "Em execucao";
            case PAUSADO -> "Pausado";
            case PRONTO_AGUARDANDO_RETIRADA -> "Pronto - aguardando retirada";
            case ENTREGUE -> "Entregue";
            case CANCELADO -> "Cancelado";
        };
    }
}
