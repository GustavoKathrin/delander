package br.com.oficina.leitura;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/** Uma linha da tabela do scanner: NO. / Nome / Valor / MIN / MAX / Unidade. */
@Entity
@Table(name = "leitura_item")
@Getter
@Setter
public class LeituraItem {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "leitura_modulo_id", nullable = false)
    private LeituraModulo modulo;

    @Column(name = "ordem", nullable = false)
    private int ordem = 0;

    /** O "NO." do relatorio. Tem buracos (1, 2, 3, 5, 6...) e isso e preservado. */
    @Column(name = "numero")
    private Integer numero;

    @Column(name = "nome", nullable = false, length = 200)
    private String nome;

    /**
     * O texto exato que o scanner mostrou. Guardado separado do numero porque
     * nem todo valor e numero: aparece "ON", "-", "Ligado".
     */
    @Column(name = "valor", length = 60)
    private String valor;

    @Column(name = "valor_num", precision = 14, scale = 4)
    private BigDecimal valorNumerico;

    @Column(name = "minimo", precision = 14, scale = 4)
    private BigDecimal minimo;

    @Column(name = "maximo", precision = 14, scale = 4)
    private BigDecimal maximo;

    @Column(name = "unidade", length = 20)
    private String unidade;

    /** Fora da faixa que o proprio relatorio declara. */
    public boolean foraDaFaixa() {
        if (valorNumerico == null) {
            return false;
        }
        if (minimo != null && valorNumerico.compareTo(minimo) < 0) {
            return true;
        }
        return maximo != null && valorNumerico.compareTo(maximo) > 0;
    }
}
