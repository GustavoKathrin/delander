package br.com.oficina.compartilhamento;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CompartilhamentoOsRepository extends JpaRepository<CompartilhamentoOs, UUID> {

    Optional<CompartilhamentoOs> findByTokenHash(String tokenHash);

    Optional<CompartilhamentoOs> findFirstByOrdemServicoIdAndAtivoTrueOrderByCriadoEmDesc(UUID ordemServicoId);

    @Query("select c.ordemServicoId from CompartilhamentoOs c where c.ordemServicoId in ?1 and c.ativo = true")
    List<UUID> osComLinkAtivo(List<UUID> ordemServicoIds);
}
