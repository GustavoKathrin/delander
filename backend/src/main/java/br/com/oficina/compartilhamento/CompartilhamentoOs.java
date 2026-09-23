package br.com.oficina.compartilhamento;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Link publico de acompanhamento. Guardamos apenas o hash do token:
 * o token em si so existe no link que o dono entrega ao cliente.
 */
@Entity
@Table(name = "compartilhamento_os")
@Getter
@Setter
public class CompartilhamentoOs extends BaseEntity {

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    /** Valor do token, para o dono reenviar o mesmo link sem invalidar o anterior. */
    @Column(name = "token", nullable = false, length = 64)
    private String token;

    /** O que este link mostra. Sobrescreve o padrao global e o do cliente. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "escopo")
    private Map<String, Object> escopo;

    @Column(name = "pin", length = 10)
    private String pin;

    @Column(name = "expira_em")
    private OffsetDateTime expiraEm;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    @Column(name = "total_acessos", nullable = false)
    private int totalAcessos = 0;

    @Column(name = "ultimo_acesso_em")
    private OffsetDateTime ultimoAcessoEm;

    public boolean valido(OffsetDateTime agora) {
        return ativo && (expiraEm == null || expiraEm.isAfter(agora));
    }
}
