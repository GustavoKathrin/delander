package br.com.oficina.cadastro;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "motivo_parada")
@Getter
@Setter
public class MotivoParada extends BaseEntity {

    @Column(name = "nome", nullable = false, length = 100)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(name = "categoria", nullable = false, length = 20)
    private CategoriaParada categoria;

    @Column(name = "bloqueia_execucao", nullable = false)
    private boolean bloqueiaExecucao = true;

    @Column(name = "visivel_cliente_padrao", nullable = false)
    private boolean visivelClientePadrao = false;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;
}
