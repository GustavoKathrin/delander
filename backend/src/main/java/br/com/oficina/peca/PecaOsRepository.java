package br.com.oficina.peca;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PecaOsRepository extends JpaRepository<PecaOs, UUID> {

    List<PecaOs> findByOrdemServicoIdOrderByCriadoEm(UUID ordemServicoId);

    List<PecaOs> findByOficinaIdAndStatusInOrderByPrevisaoChegada(UUID oficinaId, List<StatusPeca> status);
}
