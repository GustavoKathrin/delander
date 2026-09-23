package br.com.oficina.cadastro;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Area tecnica configuravel pelo dono: motor, eletrica, suspensao, funilaria... */
@Entity
@Table(name = "especialidade")
@Getter
@Setter
public class Especialidade extends BaseEntity {

    @Column(name = "nome", nullable = false, length = 80)
    private String nome;

    @Column(name = "cor", nullable = false, length = 20)
    private String cor = "#64748b";

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;
}
