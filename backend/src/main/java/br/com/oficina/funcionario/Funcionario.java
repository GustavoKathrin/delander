package br.com.oficina.funcionario;

import br.com.oficina.cadastro.Especialidade;
import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "funcionario")
@Getter
@Setter
public class Funcionario extends BaseEntity {

    /** Ligacao opcional com um login. Funcionario sem login nao acessa o sistema. */
    @Column(name = "usuario_id")
    private UUID usuarioId;

    @Column(name = "nome", nullable = false, length = 160)
    private String nome;

    @Column(name = "telefone", length = 30)
    private String telefone;

    @Column(name = "horas_por_dia", nullable = false, precision = 5, scale = 2)
    private BigDecimal horasPorDia = new BigDecimal("8");

    @Column(name = "custo_hora", precision = 12, scale = 2)
    private BigDecimal custoHora;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "funcionario_especialidade",
            joinColumns = @JoinColumn(name = "funcionario_id"),
            inverseJoinColumns = @JoinColumn(name = "especialidade_id"))
    private Set<Especialidade> especialidades = new LinkedHashSet<>();

    public boolean atende(UUID especialidadeId) {
        if (especialidadeId == null) {
            return true;
        }
        return especialidades.stream().anyMatch(e -> e.getId().equals(especialidadeId));
    }
}
