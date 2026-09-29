package br.com.oficina.peca;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Uma peca que a oficina conhece, com o que ela tem na prateleira.
 *
 * O catalogo existe por dois motivos que nao sao o mesmo. O primeiro e parar
 * de digitar "kit de embreagem" de novo a cada carro, com preco diferente a
 * cada vez. O segundo e o saldo: sem ele, "temos aqui" era a palavra do
 * mecanico e nada conferia — a peca podia ter acabado no carro anterior.
 *
 * Quantidade e fracionaria porque oficina compra oleo em litro e junta em
 * metro; `numeric(10,2)` e a mesma escala de `peca_os.quantidade`.
 */
@Entity
@Table(name = "peca_catalogo")
@Getter
@Setter
public class PecaCatalogo extends BaseEntity {

    /** Codigo do fabricante. Opcional, mas e o que evita cadastro duplicado. */
    @Column(name = "codigo", length = 60)
    private String codigo;

    @Column(name = "descricao", nullable = false, length = 200)
    private String descricao;

    @Column(name = "fabricante", length = 120)
    private String fabricante;

    @Column(name = "valor_sugerido", precision = 12, scale = 2)
    private BigDecimal valorSugerido;

    @Column(name = "quantidade_estoque", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantidadeEstoque = BigDecimal.ZERO;

    @Column(name = "estoque_minimo", nullable = false, precision = 10, scale = 2)
    private BigDecimal estoqueMinimo = BigDecimal.ZERO;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    /** Tem na prateleira agora. */
    public boolean temEstoque() {
        return quantidadeEstoque.compareTo(BigDecimal.ZERO) > 0;
    }

    /**
     * Esta acabando: ainda tem, mas ja chegou no minimo que a oficina definiu.
     *
     * Peca zerada nao conta como "acabando" — ela acabou, que e outro aviso.
     */
    public boolean acabando() {
        return temEstoque()
                && estoqueMinimo.compareTo(BigDecimal.ZERO) > 0
                && quantidadeEstoque.compareTo(estoqueMinimo) <= 0;
    }
}
