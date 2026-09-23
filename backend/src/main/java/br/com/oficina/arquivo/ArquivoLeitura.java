package br.com.oficina.arquivo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * O PDF original de uma leitura do scanner.
 *
 * Tabela propria em vez de afrouxar arquivo_os.ordem_servico_id (que e NOT
 * NULL e tem tres chamadores): a leitura pode nao ter OS nenhuma.
 *
 * leitura_id nulo = enviado na previa e ainda nao confirmado. Um job noturno
 * limpa os orfaos.
 *
 * Nao estende BaseEntity, igual a ArquivoOs: a tabela so tem criado_em e
 * criado_por, e com ddl-auto=validate herdar as colunas de atualizacao faria
 * o boot falhar.
 */
@Entity
@Table(name = "arquivo_leitura")
@Getter
@Setter
public class ArquivoLeitura {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "oficina_id", nullable = false)
    private UUID oficinaId;

    @Column(name = "leitura_id")
    private UUID leituraId;

    @Column(name = "nome_original", nullable = false, length = 200)
    private String nomeOriginal;

    @Column(name = "caminho", nullable = false, length = 300)
    private String caminho;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "tamanho")
    private Long tamanho;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private OffsetDateTime criadoEm = OffsetDateTime.now();

    @Column(name = "criado_por", updatable = false, length = 180)
    private String criadoPor;
}
