package br.com.oficina.ordemservico;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface EventoOsRepository extends JpaRepository<EventoOs, UUID> {

    List<EventoOs> findByOrdemServicoIdOrderByCriadoEmAsc(UUID ordemServicoId);

    List<EventoOs> findByOrdemServicoIdAndVisivelClienteTrueOrderByCriadoEmAsc(UUID ordemServicoId);

    /**
     * Quantos servicos foram concluidos desde um instante.
     *
     * Vem do evento e nao do `os_item`: o item guarda o status CONCLUIDO,
     * nao QUANDO virou. Sem este numero o painel do dia so mostraria o que
     * esta aberto -- e uma oficina que fechou oito servicos pela manha
     * apareceria igualzinha a uma que nao fechou nenhum.
     */
    long countByOficinaIdAndTipoAndCriadoEmGreaterThanEqual(UUID oficinaId, String tipo, OffsetDateTime desde);
}
