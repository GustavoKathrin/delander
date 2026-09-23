package br.com.oficina.arquivo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ArquivoLeituraRepository extends JpaRepository<ArquivoLeitura, UUID> {

    List<ArquivoLeitura> findByLeituraId(UUID leituraId);

    Optional<ArquivoLeitura> findByIdAndOficinaId(UUID id, UUID oficinaId);

    /** Previas que ninguem confirmou: o PDF ficou no disco a toa. */
    @Query("select a from ArquivoLeitura a where a.leituraId is null and a.criadoEm < ?1")
    List<ArquivoLeitura> orfaos(OffsetDateTime limite);
}
