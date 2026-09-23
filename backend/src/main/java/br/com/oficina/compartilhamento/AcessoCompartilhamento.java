package br.com.oficina.compartilhamento;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Log de acesso ao link publico (LGPD: IP truncado). */
@Entity
@Table(name = "acesso_compartilhamento")
@Getter
@Setter
public class AcessoCompartilhamento {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "compartilhamento_id", nullable = false)
    private UUID compartilhamentoId;

    @Column(name = "quando", nullable = false)
    private OffsetDateTime quando = OffsetDateTime.now();

    @Column(name = "ip", length = 60)
    private String ip;

    @Column(name = "user_agent", length = 300)
    private String userAgent;
}
