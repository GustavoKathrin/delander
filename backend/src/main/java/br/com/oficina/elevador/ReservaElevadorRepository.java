package br.com.oficina.elevador;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReservaElevadorRepository extends JpaRepository<ReservaElevador, UUID> {

    /** Agenda viva da oficina: e sobre ela que "livre as 14h?" e respondido. */
    @Query("""
            select r from ReservaElevador r
              join fetch r.box
             where r.oficinaId = ?1
               and r.status in (br.com.oficina.elevador.StatusReserva.RESERVADO,
                                br.com.oficina.elevador.StatusReserva.EM_USO)
             order by r.inicioPrevisto
            """)
    List<ReservaElevador> vivas(UUID oficinaId);

    /** O carro que esta em cima agora. No maximo um — uk_elevador_em_uso garante. */
    @Query("""
            select r from ReservaElevador r
              join fetch r.box
             where r.oficinaId = ?1
               and r.status = br.com.oficina.elevador.StatusReserva.EM_USO
            """)
    List<ReservaElevador> emUso(UUID oficinaId);

    @Query("""
            select r from ReservaElevador r
              join fetch r.box
             where r.ordemServicoId = ?1
               and r.status in (br.com.oficina.elevador.StatusReserva.RESERVADO,
                                br.com.oficina.elevador.StatusReserva.EM_USO)
            """)
    Optional<ReservaElevador> vivaDaOs(UUID ordemServicoId);

    @Query("""
            select r from ReservaElevador r
              join fetch r.box
             where r.ordemServicoId in ?1
               and r.status in (br.com.oficina.elevador.StatusReserva.RESERVADO,
                                br.com.oficina.elevador.StatusReserva.EM_USO)
            """)
    List<ReservaElevador> vivasDasOs(List<UUID> ordensServico);

    @Query("""
            select r from ReservaElevador r
             where r.box.id = ?1
               and r.status = br.com.oficina.elevador.StatusReserva.EM_USO
            """)
    Optional<ReservaElevador> emUsoNoBox(UUID boxId);

    List<ReservaElevador> findByOrdemServicoIdOrderByInicioPrevisto(UUID ordemServicoId);

    /** Horas de elevador efetivamente usadas no periodo, para o painel do dono. */
    @Query(value = """
            select r.box_id,
                   coalesce(sum(extract(epoch from (coalesce(r.fim_real, :agora) - r.inicio_real))), 0) / 3600.0
              from reserva_elevador r
             where r.oficina_id = :oficinaId
               and r.inicio_real is not null
               and r.inicio_real >= :de
               and r.inicio_real <  :ate
             group by r.box_id
            """, nativeQuery = true)
    List<Object[]> horasUsadasPorElevador(UUID oficinaId, OffsetDateTime de, OffsetDateTime ate,
                                          OffsetDateTime agora);
}
