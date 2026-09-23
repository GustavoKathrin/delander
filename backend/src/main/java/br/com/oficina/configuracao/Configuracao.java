package br.com.oficina.configuracao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "configuracao")
@Getter
@Setter
public class Configuracao {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "oficina_id", nullable = false)
    private UUID oficinaId;

    @Column(name = "chave", nullable = false, length = 100)
    private String chave;

    @Column(name = "valor")
    private String valor;

    @Column(name = "tipo", nullable = false, length = 20)
    private String tipo;

    @Column(name = "grupo", nullable = false, length = 40)
    private String grupo;

    @Column(name = "atualizado_em")
    private OffsetDateTime atualizadoEm;

    @Column(name = "atualizado_por", length = 180)
    private String atualizadoPor;
}
