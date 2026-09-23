package br.com.oficina.ordemservico;

import br.com.oficina.cadastro.CatalogoServico;
import br.com.oficina.cadastro.Especialidade;
import br.com.oficina.common.BaseEntity;
import br.com.oficina.funcionario.Funcionario;
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

/** Tarefa da OS. A especialidade exigida define quem pode assumir. */
@Entity
@Table(name = "os_item")
@Getter
@Setter
public class OsItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ordem_servico_id", nullable = false)
    private OrdemServico ordemServico;

    @Column(name = "descricao", nullable = false, length = 240)
    private String descricao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "especialidade_id")
    private Especialidade especialidade;

    /**
     * De qual servico do catalogo este item saiu, quando saiu de um.
     * E o que diz se o servico sobe o carro (exige_elevador).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "catalogo_servico_id")
    private CatalogoServico catalogoServico;

    @Column(name = "horas_estimadas", nullable = false, precision = 6, scale = 2)
    private BigDecimal horasEstimadas = BigDecimal.ONE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "funcionario_id")
    private Funcionario funcionario;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private StatusItem status = StatusItem.PENDENTE;

    @Column(name = "valor", precision = 12, scale = 2)
    private BigDecimal valor;

    @Column(name = "ordem", nullable = false)
    private int ordem = 0;
}
