package br.com.oficina.ordemservico;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OsItemRepository extends JpaRepository<OsItem, UUID> {

    @Query("""
            select i from OsItem i
              join fetch i.ordemServico os
              join fetch os.veiculo
              join fetch os.cliente
              left join fetch i.especialidade
              left join fetch i.funcionario
            where i.id = ?1
            """)
    Optional<OsItem> buscarCompleto(UUID id);

    @Query("""
            select i from OsItem i
              join fetch i.ordemServico os
              join fetch os.veiculo
              join fetch os.cliente
              left join fetch i.especialidade
            where i.funcionario.id = ?1
              and i.status in (br.com.oficina.ordemservico.StatusItem.PENDENTE,
                               br.com.oficina.ordemservico.StatusItem.EM_EXECUCAO,
                               br.com.oficina.ordemservico.StatusItem.PAUSADO)
              and os.status not in (br.com.oficina.ordemservico.StatusOs.ENTREGUE,
                                    br.com.oficina.ordemservico.StatusOs.CANCELADO)
            order by os.dataAgendada nulls last, os.prioridade desc, i.ordem
            """)
    List<OsItem> abertosDoFuncionario(UUID funcionarioId);

    @Query("""
            select i from OsItem i
              join fetch i.ordemServico os
              join fetch os.veiculo
              join fetch os.cliente
              left join fetch i.especialidade
              left join fetch i.funcionario
            where os.oficinaId = ?1
              and i.status in (br.com.oficina.ordemservico.StatusItem.PENDENTE,
                               br.com.oficina.ordemservico.StatusItem.EM_EXECUCAO,
                               br.com.oficina.ordemservico.StatusItem.PAUSADO)
              and os.status not in (br.com.oficina.ordemservico.StatusOs.ENTREGUE,
                                    br.com.oficina.ordemservico.StatusOs.CANCELADO)
            order by os.dataAgendada nulls last, os.prioridade desc, i.ordem
            """)
    List<OsItem> abertosDaOficina(UUID oficinaId);

    List<OsItem> findByOrdemServicoIdOrderByOrdem(UUID ordemServicoId);

    long countByOrdemServicoIdAndStatusNot(UUID ordemServicoId, StatusItem status);
}
