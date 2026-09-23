package br.com.oficina.ordemservico;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, UUID> {

    List<ChecklistItem> findByOrdemServicoIdOrderByOrdem(UUID ordemServicoId);

    void deleteByOrdemServicoId(UUID ordemServicoId);
}
