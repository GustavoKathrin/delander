package br.com.oficina.wiki;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Um artigo da wiki: a solucao que deu certo, escrita por quem resolveu.
 *
 * O vinculo que importa e o MODELO, nao o carro: o proximo Civic 2014 com o
 * mesmo sintoma tem que cair neste texto. O carro, a OS e a leitura ficam como
 * procedencia — util para voltar no caso concreto, e todos on delete set null
 * porque o artigo sobrevive ao registro que o originou.
 */
@Entity
@Table(name = "wiki_artigo")
@Getter
@Setter
public class WikiArtigo extends BaseEntity {

    @Column(name = "titulo", nullable = false, length = 200)
    private String titulo;

    @Column(name = "corpo")
    private String corpo;

    @Column(name = "marca", length = 60)
    private String marca;

    @Column(name = "modelo", length = 80)
    private String modelo;

    @Column(name = "motor", length = 60)
    private String motor;

    @Column(name = "ano_de")
    private Integer anoDe;

    @Column(name = "ano_ate")
    private Integer anoAte;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tags")
    private List<String> tags = new ArrayList<>();

    @Column(name = "veiculo_id")
    private UUID veiculoId;

    @Column(name = "ordem_servico_id")
    private UUID ordemServicoId;

    @Column(name = "leitura_id")
    private UUID leituraId;

    @Column(name = "publicado", nullable = false)
    private boolean publicado = true;

    /** "Honda Civic 2012-2016 · 2.0 flex" — o cabecalho do artigo. */
    public String alcance() {
        StringBuilder sb = new StringBuilder();
        if (marca != null) {
            sb.append(marca);
        }
        if (modelo != null) {
            sb.append(sb.isEmpty() ? "" : " ").append(modelo);
        }
        if (anoDe != null || anoAte != null) {
            sb.append(sb.isEmpty() ? "" : " ");
            if (anoDe != null && anoAte != null) {
                sb.append(anoDe.equals(anoAte) ? anoDe.toString() : anoDe + "-" + anoAte);
            } else {
                sb.append(anoDe != null ? "de " + anoDe : "ate " + anoAte);
            }
        }
        if (motor != null && !motor.isBlank()) {
            sb.append(sb.isEmpty() ? "" : " · ").append(motor);
        }
        return sb.isEmpty() ? "Qualquer veiculo" : sb.toString();
    }
}
