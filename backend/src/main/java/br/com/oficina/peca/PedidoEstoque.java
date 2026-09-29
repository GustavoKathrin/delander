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

/**
 * Peca pedida para a prateleira, sem carro nenhum.
 *
 * "Acabou o filtro, compra 10". E outra coisa que a peca de OS: nao tem carro,
 * nao tem urgencia derivada de agenda, nao mexe no valor de OS nenhuma, e o
 * "chegou" dela significa o oposto — a peca entra no estoque e **fica**,
 * enquanto a peca de carro entra e sai na mesma transacao porque tem dono.
 */
@Entity
@Table(name = "pedido_estoque")
@Getter
@Setter
public class PedidoEstoque extends BaseEntity {

    /** Nulo enquanto a peca nao estiver no catalogo; vale pela descricao. */
    @Column(name = "peca_catalogo_id")
    private UUID pecaCatalogoId;

    @Column(name = "descricao", nullable = false, length = 200)
    private String descricao;

    @Column(name = "quantidade", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantidade = BigDecimal.ONE;

    @Column(name = "fornecedor", length = 160)
    private String fornecedor;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private StatusPeca status = StatusPeca.SOLICITADA;

    @Column(name = "previsao_chegada")
    private LocalDate previsaoChegada;

    @Column(name = "valor_unitario", precision = 12, scale = 2)
    private BigDecimal valorUnitario;

    @Column(name = "observacao", length = 400)
    private String observacao;

    public boolean pendente() {
        return status == StatusPeca.SOLICITADA || status == StatusPeca.COMPRADA;
    }
}
