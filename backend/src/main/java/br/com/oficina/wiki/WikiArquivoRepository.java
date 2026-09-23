package br.com.oficina.wiki;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WikiArquivoRepository extends JpaRepository<WikiArquivo, UUID> {

    List<WikiArquivo> findByWikiArtigoIdOrderByOrdem(UUID wikiArtigoId);

    Optional<WikiArquivo> findByIdAndOficinaId(UUID id, UUID oficinaId);

    @Query("select a from WikiArquivo a where a.wikiArtigoId is null and a.criadoEm < ?1")
    List<WikiArquivo> orfaos(OffsetDateTime limite);
}
