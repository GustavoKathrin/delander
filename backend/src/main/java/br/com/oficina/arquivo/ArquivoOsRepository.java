package br.com.oficina.arquivo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ArquivoOsRepository extends JpaRepository<ArquivoOs, UUID> {

    List<ArquivoOs> findByOrdemServicoIdOrderByCriadoEm(UUID ordemServicoId);

    List<ArquivoOs> findByOrdemServicoIdAndVisivelClienteTrueOrderByCriadoEm(UUID ordemServicoId);
}
