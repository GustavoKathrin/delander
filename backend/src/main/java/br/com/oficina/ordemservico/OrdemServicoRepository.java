package br.com.oficina.ordemservico;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrdemServicoRepository extends JpaRepository<OrdemServico, UUID> {

    @Query("""
            select os from OrdemServico os
              join fetch os.cliente
              join fetch os.veiculo
              left join fetch os.box
            where os.id = ?1
            """)
    Optional<OrdemServico> buscarCompleta(UUID id);

    @Query("""
            select distinct os from OrdemServico os
              join fetch os.cliente
              join fetch os.veiculo
              left join fetch os.box
              left join fetch os.itens i
              left join fetch i.especialidade
              left join fetch i.funcionario
            where os.id = ?1
            """)
    Optional<OrdemServico> buscarComItens(UUID id);

    /** Carros que ainda ocupam espaco fisico na oficina. */
    @Query("""
            select distinct os from OrdemServico os
              join fetch os.cliente
              join fetch os.veiculo
              left join fetch os.box
              left join fetch os.itens i
              left join fetch i.funcionario
            where os.oficinaId = ?1
              and os.status not in (br.com.oficina.ordemservico.StatusOs.ENTREGUE,
                                    br.com.oficina.ordemservico.StatusOs.CANCELADO)
            order by os.numero
            """)
    List<OrdemServico> noPatio(UUID oficinaId);

    /** OS alocadas na janela do quadro da semana. */
    @Query("""
            select distinct os from OrdemServico os
              join fetch os.cliente
              join fetch os.veiculo
              left join fetch os.box
              left join fetch os.itens i
              left join fetch i.funcionario
              left join fetch i.especialidade
            where os.oficinaId = :oficinaId
              and os.dataAgendada between :de and :ate
              and os.status <> br.com.oficina.ordemservico.StatusOs.CANCELADO
            order by os.dataAgendada, os.numero
            """)
    List<OrdemServico> doPeriodo(@Param("oficinaId") UUID oficinaId,
                                 @Param("de") LocalDate de,
                                 @Param("ate") LocalDate ate);

    /**
     * Fila de espera: entrou, ainda nao tem dia marcado e nao esta ocupando
     * vaga nenhuma. Carro que ja esta num box nao esta esperando vaga — ele
     * aparece na planta, nao na fila.
     */
    @Query("""
            select distinct os from OrdemServico os
              join fetch os.cliente
              join fetch os.veiculo
              left join fetch os.itens i
            where os.oficinaId = ?1
              and os.dataAgendada is null
              and os.box is null
              and os.status not in (br.com.oficina.ordemservico.StatusOs.ENTREGUE,
                                    br.com.oficina.ordemservico.StatusOs.CANCELADO)
            order by os.prioridade desc, os.entradaEm
            """)
    List<OrdemServico> naoAlocadas(UUID oficinaId);

    /**
     * Carros que precisam do elevador e ainda estao na oficina.
     *
     * Quem ja tem reserva viva sai da fila no ElevadorService — aqui nao da
     * para filtrar por isso sem acoplar a OS a reserva_elevador, e a OS nao
     * precisa conhecer o elevador.
     */
    @Query("""
            select distinct os from OrdemServico os
              join fetch os.cliente
              join fetch os.veiculo
              left join fetch os.box
              left join fetch os.itens i
              left join fetch i.funcionario
              left join fetch i.catalogoServico
            where os.oficinaId = ?1
              and os.precisaElevador = true
              and os.status not in (br.com.oficina.ordemservico.StatusOs.ENTREGUE,
                                    br.com.oficina.ordemservico.StatusOs.CANCELADO)
            order by os.prioridade desc, os.dataAgendada nulls last, os.entradaEm
            """)
    List<OrdemServico> precisandoElevador(UUID oficinaId);

    @Query(value = """
            select os from OrdemServico os
              join fetch os.cliente c
              join fetch os.veiculo v
              left join fetch os.box
            where os.oficinaId = :oficinaId
              and os.status in :status
              and (:busca is null or :busca = ''
                   or v.placa like upper(concat('%', :busca, '%'))
                   or lower(c.nome) like lower(concat('%', :busca, '%'))
                   or lower(v.modelo) like lower(concat('%', :busca, '%'))
                   or cast(os.numero as string) like concat('%', :busca, '%'))
            order by os.entradaEm desc
            """,
            countQuery = """
            select count(os) from OrdemServico os
              join os.cliente c
              join os.veiculo v
            where os.oficinaId = :oficinaId
              and os.status in :status
              and (:busca is null or :busca = ''
                   or v.placa like upper(concat('%', :busca, '%'))
                   or lower(c.nome) like lower(concat('%', :busca, '%'))
                   or lower(v.modelo) like lower(concat('%', :busca, '%'))
                   or cast(os.numero as string) like concat('%', :busca, '%'))
            """)
    Page<OrdemServico> buscar(@Param("oficinaId") UUID oficinaId,
                              @Param("status") List<StatusOs> status,
                              @Param("busca") String busca,
                              Pageable pageable);

    @Query("""
            select os from OrdemServico os
              join fetch os.veiculo
              join fetch os.cliente
            where os.veiculo.id = ?1
            order by os.entradaEm desc
            """)
    List<OrdemServico> historicoDoVeiculo(UUID veiculoId);

    long countByOficinaIdAndStatus(UUID oficinaId, StatusOs status);

    @Query("""
            select count(os) from OrdemServico os
            where os.oficinaId = ?1
              and os.status not in (br.com.oficina.ordemservico.StatusOs.ENTREGUE,
                                    br.com.oficina.ordemservico.StatusOs.CANCELADO)
            """)
    long contarNoPatio(UUID oficinaId);

    // ------------------------------------------------- capacidade / metricas

    /** Horas estimadas e quantidade de carros alocados por dia. */
    @Query(value = """
            select os.data_agendada as dia,
                   count(distinct os.id) as carros,
                   coalesce(sum(i.horas), 0) as horas
            from ordem_servico os
            left join (select ordem_servico_id, sum(horas_estimadas) as horas
                       from os_item where status <> 'CANCELADO'
                       group by ordem_servico_id) i on i.ordem_servico_id = os.id
            where os.oficina_id = :oficinaId
              and os.data_agendada between :de and :ate
              and os.status not in ('ENTREGUE', 'CANCELADO')
            group by os.data_agendada
            """, nativeQuery = true)
    List<Object[]> cargaPorDia(@Param("oficinaId") UUID oficinaId,
                               @Param("de") LocalDate de,
                               @Param("ate") LocalDate ate);

    @Query("""
            select count(os) from OrdemServico os
            where os.oficinaId = ?1 and os.dataAgendada between ?2 and ?3
              and os.status <> br.com.oficina.ordemservico.StatusOs.CANCELADO
            """)
    long contarAlocadasNoPeriodo(UUID oficinaId, LocalDate de, LocalDate ate);

    /**
     * Janela de ocupacao de cada vaga: um carro que entrou segunda continua no
     * box na quarta, e libera na previsao de entrega (ou no tempo estimado do
     * servico, quando nao ha previsao). Contar so as OS agendadas no dia faria
     * o quadro prometer vaga que nao existe; ignorar o fim da janela faria a
     * vaga nunca liberar.
     */
    @Query(value = """
            select os.box_id            as box,
                   coalesce(os.data_agendada, cast(os.entrada_em as date)) as inicio,
                   os.previsao_entrega  as previsao,
                   coalesce(i.horas, 0) as horas,
                   os.id                as os_id
            from ordem_servico os
            left join (select ordem_servico_id, sum(horas_estimadas) as horas
                       from os_item where status <> 'CANCELADO'
                       group by ordem_servico_id) i on i.ordem_servico_id = os.id
            where os.oficina_id = :oficinaId
              and os.box_id is not null
              and os.status not in ('ENTREGUE', 'CANCELADO')
            """, nativeQuery = true)
    List<Object[]> vagasOcupadas(@Param("oficinaId") UUID oficinaId);

    @Query("""
            select count(os) from OrdemServico os
            where os.oficinaId = ?1 and os.entradaEm >= ?2 and os.entradaEm < ?3
            """)
    long contarRecebidas(UUID oficinaId, OffsetDateTime de, OffsetDateTime ate);

    @Query("""
            select count(os) from OrdemServico os
            where os.oficinaId = ?1 and os.entregueEm >= ?2 and os.entregueEm < ?3
            """)
    long contarEntregues(UUID oficinaId, OffsetDateTime de, OffsetDateTime ate);

    @Query("""
            select os from OrdemServico os
              join fetch os.cliente
              join fetch os.veiculo
            where os.oficinaId = ?1 and os.entregueEm >= ?2 and os.entregueEm < ?3
            """)
    List<OrdemServico> entreguesNoPeriodo(UUID oficinaId, OffsetDateTime de, OffsetDateTime ate);

    @Query(value = "select nextval('os_numero_seq')", nativeQuery = true)
    Long proximoNumero();
}
