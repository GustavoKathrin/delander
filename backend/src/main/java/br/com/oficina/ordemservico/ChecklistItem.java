package br.com.oficina.ordemservico;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

/** Checklist de entrada: protege a oficina de reclamacao de avaria pre-existente. */
@Entity
@Table(name = "checklist_item")
@Getter
@Setter
public class ChecklistItem {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "oficina_id", nullable = false)
    private UUID oficinaId;

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @Column(name = "descricao", nullable = false, length = 200)
    private String descricao;

    @Column(name = "ok")
    private Boolean ok;

    @Column(name = "observacao", length = 300)
    private String observacao;

    @Column(name = "ordem", nullable = false)
    private int ordem = 0;
}
