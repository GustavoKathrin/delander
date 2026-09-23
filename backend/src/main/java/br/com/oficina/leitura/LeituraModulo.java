package br.com.oficina.leitura;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Um modulo do carro dentro de uma leitura (PGM-FI, ABS, SRS...).
 *
 * Nao estende BaseEntity: e filho de leitura, sem oficina_id e sem auditoria
 * propria, como veiculo_proprietario_hist na V1. Com ddl-auto=validate, herdar
 * BaseEntity faria o boot falhar por colunas que a tabela nao tem.
 */
@Entity
@Table(name = "leitura_modulo")
@Getter
@Setter
public class LeituraModulo {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "leitura_id", nullable = false)
    private Leitura leitura;

    @Column(name = "nome", nullable = false, length = 80)
    private String nome;

    /** O "Caminho:" inteiro do relatorio, para rastrear de onde o dado veio. */
    @Column(name = "caminho", length = 400)
    private String caminho;

    @Column(name = "ordem", nullable = false)
    private int ordem = 0;

    @OneToMany(mappedBy = "modulo", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordem")
    private List<LeituraItem> itens = new ArrayList<>();

    public void adicionarItem(LeituraItem item) {
        item.setModulo(this);
        item.setOrdem(itens.size());
        itens.add(item);
    }
}
