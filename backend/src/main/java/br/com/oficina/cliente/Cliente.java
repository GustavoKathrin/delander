package br.com.oficina.cliente;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Entity
@Table(name = "cliente")
@Getter
@Setter
public class Cliente extends BaseEntity {

    @Column(name = "nome", nullable = false, length = 160)
    private String nome;

    @Column(name = "documento", length = 30)
    private String documento;

    @Column(name = "telefone", length = 30)
    private String telefone;

    @Column(name = "email", length = 180)
    private String email;

    @Column(name = "observacoes")
    private String observacoes;

    @Column(name = "consentimento_contato", nullable = false)
    private boolean consentimentoContato = false;

    /** null = usa o padrao global da oficina. */
    @Column(name = "compartilhamento_habilitado")
    private Boolean compartilhamentoHabilitado;

    /** Sobrescreve, por cliente, o que o link publico mostra. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "escopo_compartilhamento")
    private Map<String, Object> escopoCompartilhamento;

    @Column(name = "anonimizado", nullable = false)
    private boolean anonimizado = false;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    /** Primeiro nome: o unico dado pessoal exibido na pagina publica. */
    public String primeiroNome() {
        if (nome == null || nome.isBlank()) {
            return "Cliente";
        }
        return nome.trim().split("\s+")[0];
    }
}
