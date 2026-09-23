package br.com.oficina.wiki;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Foto de um artigo da wiki. Sem BaseEntity, igual a ArquivoOs e
 * ArquivoLeitura: a tabela nao tem colunas de atualizacao.
 *
 * wiki_artigo_id nulo = subiu na tela de escrita e o artigo ainda nao foi
 * salvo; o mesmo job que limpa previa de leitura limpa estes.
 */
@Entity
@Table(name = "wiki_arquivo")
@Getter
@Setter
public class WikiArquivo {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "oficina_id", nullable = false)
    private UUID oficinaId;

    @Column(name = "wiki_artigo_id")
    private UUID wikiArtigoId;

    @Column(name = "nome_original", nullable = false, length = 200)
    private String nomeOriginal;

    @Column(name = "caminho", nullable = false, length = 300)
    private String caminho;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "tamanho")
    private Long tamanho;

    @Column(name = "legenda", length = 300)
    private String legenda;

    @Column(name = "ordem", nullable = false)
    private int ordem = 0;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private OffsetDateTime criadoEm = OffsetDateTime.now();

    @Column(name = "criado_por", updatable = false, length = 180)
    private String criadoPor;
}
