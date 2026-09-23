package br.com.oficina.ordemservico;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EventoOsRepository extends JpaRepository<EventoOs, UUID> {

    List<EventoOs> findByOrdemServicoIdOrderByCriadoEmAsc(UUID ordemServicoId);

    List<EventoOs> findByOrdemServicoIdAndVisivelClienteTrueOrderByCriadoEmAsc(UUID ordemServicoId);
}
