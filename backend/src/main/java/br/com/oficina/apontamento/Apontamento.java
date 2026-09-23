package br.com.oficina.apontamento;

import br.com.oficina.common.BaseEntity;
import br.com.oficina.funcionario.Funcionario;
import br.com.oficina.ordemservico.OsItem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Sessao de trabalho. Inicio e fim vem sempre do relogio do servidor:
 * sem isso a metrica de tempo vira lixo em uma semana.
 */
@Entity
@Table(name = "apontamento")
@Getter
@Setter
public class Apontamento extends BaseEntity {

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "os_item_id", nullable = false)
    private OsItem osItem;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "funcionario_id", nullable = false)
    private Funcionario funcionario;

    @Column(name = "inicio", nullable = false)
    private OffsetDateTime inicio;

    @Column(name = "fim")
    private OffsetDateTime fim;

    /** Quanto o mecanico disse que ia gastar, informado no momento de iniciar. */
    @Column(name = "horas_estimadas_informadas", precision = 6, scale = 2)
    private BigDecimal horasEstimadasInformadas;

    @Column(name = "observacao", length = 400)
    private String observacao;

    @Column(name = "encerrado_automaticamente", nullable = false)
    private boolean encerradoAutomaticamente = false;

    public boolean aberto() {
        return fim == null;
    }

    public BigDecimal horas(OffsetDateTime agora) {
        OffsetDateTime termino = fim != null ? fim : agora;
        long minutos = Duration.between(inicio, termino).toMinutes();
        return BigDecimal.valueOf(Math.max(minutos, 0))
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    public long minutos(OffsetDateTime agora) {
        OffsetDateTime termino = fim != null ? fim : agora;
        return Math.max(Duration.between(inicio, termino).toMinutes(), 0);
    }
}
