package br.com.oficina.peca;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Peca da OS: falta de peca e o motivo numero um de carro parado. */
@Entity
@Table(name = "peca_os")
@Getter
@Setter
public class PecaOs extends BaseEntity {

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @Column(name = "descricao", nullable = false, length = 200)
    private String descricao;

    @Column(name = "quantidade", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantidade = BigDecimal.ONE;

    @Column(name = "fornecedor", length = 160)
    private String fornecedor;

    /** Ja temos, ou alguem precisa comprar? So a segunda vira fila. */
    @Enumerated(EnumType.STRING)
    @Column(name = "origem", nullable = false, length = 20)
    private OrigemPeca origem = OrigemPeca.COMPRAR;

    /** Trava o inicio do servico, ou so faz falta antes de terminar? */
    @Enumerated(EnumType.STRING)
    @Column(name = "momento_necessario", nullable = false, length = 20)
    private MomentoDaPeca momentoNecessario = MomentoDaPeca.DURANTE;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private StatusPeca status = StatusPeca.SOLICITADA;

    @Column(name = "previsao_chegada")
    private LocalDate previsaoChegada;

    @Column(name = "valor_unitario", precision = 12, scale = 2)
    private BigDecimal valorUnitario;

    public BigDecimal total() {
        if (valorUnitario == null) {
            return BigDecimal.ZERO;
        }
        return valorUnitario.multiply(quantidade);
    }
}
