package br.com.oficina.arquivo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "arquivo_os")
@Getter
@Setter
public class ArquivoOs {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "oficina_id", nullable = false)
    private UUID oficinaId;

    @Column(name = "ordem_servico_id", nullable = false)
    private UUID ordemServicoId;

    @Column(name = "nome_original", nullable = false, length = 200)
    private String nomeOriginal;

    @Column(name = "caminho", nullable = false, length = 300)
    private String caminho;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "tamanho")
    private Long tamanho;

    @Column(name = "momento", nullable = false, length = 20)
    private String momento = "EXECUCAO";

    @Column(name = "visivel_cliente", nullable = false)
    private boolean visivelCliente = false;

    @Column(name = "criado_em", nullable = false)
    private OffsetDateTime criadoEm = OffsetDateTime.now();

    @Column(name = "criado_por", length = 180)
    private String criadoPor;
}
