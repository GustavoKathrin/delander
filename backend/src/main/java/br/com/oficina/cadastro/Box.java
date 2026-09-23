package br.com.oficina.cadastro;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Vaga fisica. E a capacidade real da oficina, nao so "carros por mes". */
@Entity
@Table(name = "box")
@Getter
@Setter
public class Box extends BaseEntity {

    @Column(name = "nome", nullable = false, length = 60)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 20)
    private TipoBox tipo = TipoBox.BOX;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    /**
     * Onde a vaga fica na planta do patio.
     *
     * Coluna e linha NULAS significam "sem layout salvo": a planta volta a se
     * arrumar sozinha, que e o comportamento de quem nunca abriu o cadeado.
     * Por isso sao Integer e nao int.
     */
    @Column(name = "layout_coluna")
    private Integer layoutColuna;

    @Column(name = "layout_linha")
    private Integer layoutLinha;

    @Column(name = "layout_largura", nullable = false)
    private int layoutLargura = 1;

    @Column(name = "layout_altura", nullable = false)
    private int layoutAltura = 1;

    public boolean temLayout() {
        return layoutColuna != null && layoutLinha != null;
    }

    /** Celulas que esta vaga ocupa, para detectar sobreposicao. */
    public boolean ocupaCelula(int coluna, int linha) {
        if (!temLayout()) {
            return false;
        }
        return coluna >= layoutColuna && coluna < layoutColuna + layoutLargura
                && linha >= layoutLinha && linha < layoutLinha + layoutAltura;
    }
}
