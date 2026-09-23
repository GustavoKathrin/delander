package br.com.oficina.parada;

import br.com.oficina.cadastro.MotivoParada;
import br.com.oficina.common.BaseEntity;
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
 * Registro de carro parado. E o dado que o Pareto usa para mostrar
 * o gargalo real da oficina (peca, aprovacao, terceiro...).
 */
@Entity
@Table(name = "parada")
@Getter
@Setter
public class Parada extends BaseEntity {

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "motivo_parada_id", nullable = false)
    private MotivoParada motivoParada;

    @Column(name = "inicio", nullable = false)
    private OffsetDateTime inicio;

    @Column(name = "fim")
    private OffsetDateTime fim;

    @Column(name = "descricao", length = 400)
    private String descricao;

    @Column(name = "visivel_cliente", nullable = false)
    private boolean visivelCliente = false;

    public boolean aberta() {
        return fim == null;
    }

    public BigDecimal horas(OffsetDateTime agora) {
        OffsetDateTime termino = fim != null ? fim : agora;
        long minutos = Duration.between(inicio, termino).toMinutes();
        return BigDecimal.valueOf(Math.max(minutos, 0))
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }
}
