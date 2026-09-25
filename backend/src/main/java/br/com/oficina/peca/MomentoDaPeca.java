package br.com.oficina.peca;

import java.time.LocalDate;

/**
 * Em que momento do servico a peca faz falta.
 *
 * Foi assim que o dono descreveu, e e melhor do que pedir uma data: prazo
 * de peca nao e algo que alguem digita, e consequencia de quando ela e
 * necessaria. A peca herda a urgencia do carro que a espera.
 */
public enum MomentoDaPeca {

    /** Sem ela o servico nao comeca — tem que estar aqui antes de o carro entrar. */
    INICIO,

    /** Da para comecar sem ela; precisa chegar antes de o carro sair. */
    DURANTE;

    public String descricao() {
        return switch (this) {
            case INICIO -> "Para começar";
            case DURANTE -> "Antes de terminar";
        };
    }

    /**
     * Ate quando a peca precisa estar na oficina.
     *
     * O prazo sai da agenda do carro, nao de um campo: peca que trava o
     * inicio precisa chegar antes do dia agendado; a outra, antes da
     * entrega prometida.
     *
     * Nulo quer dizer "sem prazo conhecido" — e isso NAO e folga, e o
     * contrario: o carro esta parado esperando e ninguem marcou dia.
     * Quem consome trata nulo como a urgencia maxima.
     */
    public LocalDate prazo(LocalDate dataAgendada, LocalDate previsaoEntrega) {
        return this == INICIO ? dataAgendada : previsaoEntrega;
    }
}
