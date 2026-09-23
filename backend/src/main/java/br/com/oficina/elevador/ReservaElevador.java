package br.com.oficina.elevador;

import br.com.oficina.cadastro.Box;
import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Uma subida no elevador: qual carro, em qual elevador, a partir de quando
 * e por quanto tempo.
 *
 * A vaga e ocupada por DIA — o carro dorme na oficina. O elevador nao: um
 * alinhamento de 1h nao pode travar o elevador o dia inteiro. Por isso aqui
 * o tempo e em hora, e nao em data como em CapacidadeService.Ocupacao.
 */
@Entity
@Table(name = "reserva_elevador")
@Getter
@Setter
public class ReservaElevador extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "box_id", nullable = false)
    private Box box;

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @Column(name = "inicio_previsto", nullable = false)
    private OffsetDateTime inicioPrevisto;

    @Column(name = "horas_previstas", nullable = false, precision = 6, scale = 2)
    private BigDecimal horasPrevistas = BigDecimal.ONE;

    @Column(name = "inicio_real")
    private OffsetDateTime inicioReal;

    @Column(name = "fim_real")
    private OffsetDateTime fimReal;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private StatusReserva status = StatusReserva.RESERVADO;

    @Column(name = "observacao", length = 300)
    private String observacao;

    /** Quando o carro deve descer, contado do inicio real se ja subiu. */
    public OffsetDateTime terminoPrevisto() {
        OffsetDateTime base = inicioReal != null ? inicioReal : inicioPrevisto;
        return base.plusMinutes(emMinutos(horasPrevistas));
    }

    /**
     * Minutos que faltam para descer. Negativo quando passou da hora — quem
     * chama decide se mostra "desce em 20min" ou "passou 15min".
     */
    public long minutosRestantes(OffsetDateTime agora) {
        return Duration.between(agora, terminoPrevisto()).toMinutes();
    }

    /** Quanto tempo o carro ficou (ou esta) em cima. */
    public BigDecimal horasNoElevador(OffsetDateTime agora) {
        if (inicioReal == null) {
            return BigDecimal.ZERO;
        }
        OffsetDateTime termino = fimReal != null ? fimReal : agora;
        long minutos = Duration.between(inicioReal, termino).toMinutes();
        return BigDecimal.valueOf(Math.max(minutos, 0))
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    /** Janela que esta reserva ocupa no elevador. */
    public boolean conflitaCom(OffsetDateTime inicio, BigDecimal horas) {
        OffsetDateTime fim = inicio.plusMinutes(emMinutos(horas));
        OffsetDateTime meuInicio = inicioReal != null ? inicioReal : inicioPrevisto;
        // Encostar nao e conflito: um desce 10h, o outro sobe 10h.
        return meuInicio.isBefore(fim) && terminoPrevisto().isAfter(inicio);
    }

    private static long emMinutos(BigDecimal horas) {
        return horas == null ? 60L : horas.multiply(BigDecimal.valueOf(60)).longValue();
    }
}
