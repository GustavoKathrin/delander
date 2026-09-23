package br.com.oficina.cadastro;

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

/**
 * Servico padrao com tempo de referencia. O tempo padrao alimenta a sugestao
 * de estimativa e vai sendo corrigido pelo historico (estimado x realizado).
 */
@Entity
@Table(name = "catalogo_servico")
@Getter
@Setter
public class CatalogoServico extends BaseEntity {

    @Column(name = "descricao", nullable = false, length = 200)
    private String descricao;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "especialidade_id")
    private Especialidade especialidade;

    @Column(name = "horas_padrao", nullable = false, precision = 6, scale = 2)
    private BigDecimal horasPadrao = BigDecimal.ONE;

    @Column(name = "preco_sugerido", precision = 12, scale = 2)
    private BigDecimal precoSugerido;

    /** Servico que sobe o carro: quem marca isso alimenta a fila do elevador. */
    @Column(name = "exige_elevador", nullable = false)
    private boolean exigeElevador = false;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;
}
