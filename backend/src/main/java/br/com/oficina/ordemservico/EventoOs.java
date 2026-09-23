package br.com.oficina.ordemservico;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Trilha de eventos da OS: alimenta a timeline interna, a auditoria
 * e a pagina publica de acompanhamento (filtrada por visivel_cliente).
 */
@Entity
@Table(name = "evento_os")
@Getter
@Setter
public class EventoOs {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "oficina_id", nullable = false)
    private UUID oficinaId;

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @Column(name = "tipo", nullable = false, length = 60)
    private String tipo;

    @Column(name = "descricao", length = 400)
    private String descricao;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "dados")
    private Map<String, Object> dados;

    @Column(name = "autor", length = 180)
    private String autor;

    @Column(name = "visivel_cliente", nullable = false)
    private boolean visivelCliente = true;

    @Column(name = "criado_em", nullable = false)
    private OffsetDateTime criadoEm = OffsetDateTime.now();
}
