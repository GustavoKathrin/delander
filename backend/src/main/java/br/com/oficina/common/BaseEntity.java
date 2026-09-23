package br.com.oficina.common;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.domain.Persistable;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Base de toda entidade de dominio: id proprio, oficina (preparado para
 * multi-oficina) e trilha de auditoria.
 */
@MappedSuperclass
@Getter
@Setter
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity implements Persistable<UUID> {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "oficina_id", nullable = false)
    private UUID oficinaId;

    /**
     * Instant, nao OffsetDateTime: o auditing do Spring Data nao sabe preencher
     * OffsetDateTime (aceita Instant, LocalDateTime, LocalDate, LocalTime, Date, long).
     * No banco continua timestamptz.
     */
    @CreatedDate
    @Column(name = "criado_em", updatable = false)
    private Instant criadoEm;

    @CreatedBy
    @Column(name = "criado_por", updatable = false, length = 180)
    private String criadoPor;

    @LastModifiedDate
    @Column(name = "atualizado_em")
    private Instant atualizadoEm;

    @LastModifiedBy
    @Column(name = "atualizado_por", length = 180)
    private String atualizadoPor;

    /** Evita o SELECT antes do INSERT que o Spring Data faz com id atribuido. */
    @Transient
    private boolean novo = true;

    @Override
    public boolean isNew() {
        return novo;
    }

    @PostPersist
    @PostLoad
    void marcarComoPersistido() {
        this.novo = false;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof BaseEntity outra)) {
            return false;
        }
        return id != null && id.equals(outra.getId());
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
