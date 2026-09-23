package br.com.oficina.elevador;

/** Ciclo de vida da reserva do elevador. */
public enum StatusReserva {

    /** Marcada para um horario; o carro ainda nao subiu. */
    RESERVADO("Reservado"),

    /** O carro esta em cima agora. So existe uma por elevador (uk_elevador_em_uso). */
    EM_USO("No elevador"),

    /** Ja desceu. */
    CONCLUIDO("Concluido"),

    CANCELADO("Cancelado");

    private final String descricao;

    StatusReserva(String descricao) {
        this.descricao = descricao;
    }

    public String descricao() {
        return descricao;
    }

    /** Ocupa a agenda do elevador: conta para "livre as 14h?". */
    public boolean viva() {
        return this == RESERVADO || this == EM_USO;
    }
}
