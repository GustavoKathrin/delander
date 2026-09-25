package br.com.oficina.peca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PecaOsRepository extends JpaRepository<PecaOs, UUID> {

    List<PecaOs> findByOrdemServicoIdOrderByCriadoEm(UUID ordemServicoId);

    List<PecaOs> findByOficinaIdAndStatusInOrderByPrevisaoChegada(UUID oficinaId, List<StatusPeca> status);

    /**
     * Quais destas OS tem peca em cada situacao — uma consulta so, para o
     * card do patio nao virar uma consulta por carro.
     */
    @Query("select distinct p.ordemServicoId from PecaOs p "
            + "where p.ordemServicoId in :ids and p.status in :status")
    List<UUID> osComPecaEm(@Param("ids") List<UUID> ids, @Param("status") List<StatusPeca> status);
}
