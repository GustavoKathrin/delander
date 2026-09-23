package br.com.oficina.apontamento;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApontamentoRepository extends JpaRepository<Apontamento, UUID> {

    @Query("""
            select a from Apontamento a
              join fetch a.funcionario f
              join fetch a.osItem i
            where a.ordemServicoId = ?1
            order by a.inicio
            """)
    List<Apontamento> listarPorOs(UUID ordemServicoId);

    @Query("select a from Apontamento a where a.osItem.id = ?1 and a.fim is null")
    Optional<Apontamento> abertoDoItem(UUID osItemId);

    @Query("""
            select a from Apontamento a
              join fetch a.osItem i
              join fetch i.ordemServico os
              join fetch os.veiculo v
            where a.funcionario.id = ?1 and a.fim is null
            """)
    List<Apontamento> abertosDoFuncionario(UUID funcionarioId);

    @Query("select a from Apontamento a where a.oficinaId = ?1 and a.fim is null")
    List<Apontamento> abertos(UUID oficinaId);

    @Query(value = """
            select coalesce(sum(extract(epoch from (coalesce(fim, :agora) - inicio))), 0)
            from apontamento where ordem_servico_id = :osId
            """, nativeQuery = true)
    Double segundosTrabalhadosNaOs(@Param("osId") UUID osId, @Param("agora") OffsetDateTime agora);

    /** Horas trabalhadas por OS de uma lista, em uma unica consulta (evita N+1 no quadro). */
    @Query(value = """
            select ordem_servico_id as osId,
                   coalesce(sum(extract(epoch from (coalesce(fim, :agora) - inicio))), 0) / 3600.0 as horas
            from apontamento
            where ordem_servico_id in (:osIds)
            group by ordem_servico_id
            """, nativeQuery = true)
    List<Object[]> horasPorOs(@Param("osIds") List<UUID> osIds, @Param("agora") OffsetDateTime agora);

    @Query("""
            select a from Apontamento a
              join fetch a.funcionario
              join fetch a.osItem
            where a.oficinaId = :oficinaId
              and a.inicio >= :de and a.inicio < :ate
            """)
    List<Apontamento> doPeriodo(@Param("oficinaId") UUID oficinaId,
                                @Param("de") OffsetDateTime de,
                                @Param("ate") OffsetDateTime ate);

    @Query("select max(a.inicio) from Apontamento a where a.ordemServicoId = ?1")
    Optional<OffsetDateTime> ultimoInicio(UUID ordemServicoId);

    /** Ultima atividade por OS: base do radar de carros parados. */
    @Query(value = """
            select ordem_servico_id as osId, max(coalesce(fim, inicio)) as ultima
            from apontamento
            where ordem_servico_id in (:osIds)
            group by ordem_servico_id
            """, nativeQuery = true)
    List<Object[]> ultimaAtividadePorOs(@Param("osIds") List<UUID> osIds);

    /** Produtividade por mecanico no periodo: horas trabalhadas x horas estimadas. */
    @Query(value = """
            select f.nome as mecanico,
                   count(distinct a.os_item_id) as servicos,
                   coalesce(sum(extract(epoch from (coalesce(a.fim, :agora) - a.inicio))), 0) / 3600.0 as horas,
                   coalesce(sum(distinct i.horas_estimadas), 0) as estimadas
            from apontamento a
            join funcionario f on f.id = a.funcionario_id
            join os_item i on i.id = a.os_item_id
            where a.oficina_id = :oficinaId
              and a.inicio >= :de and a.inicio < :ate
            group by f.nome
            order by horas desc
            """, nativeQuery = true)
    List<Object[]> produtividadePorMecanico(@Param("oficinaId") UUID oficinaId,
                                            @Param("de") OffsetDateTime de,
                                            @Param("ate") OffsetDateTime ate,
                                            @Param("agora") OffsetDateTime agora);
}
