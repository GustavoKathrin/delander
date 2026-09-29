package br.com.oficina.parada;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ParadaRepository extends JpaRepository<Parada, UUID> {

    @Query("select p from Parada p join fetch p.motivoParada where p.ordemServicoId = ?1 order by p.inicio")
    List<Parada> listarPorOs(UUID ordemServicoId);

    /**
     * A parada aberta do CARRO — a que nasce quando a OS inteira e pausada.
     *
     * Antes chamava-se `abertaDaOs` e devolvia a primeira que achasse, de
     * qualquer servico. Com paradas por servico isso viraria uma loteria: o
     * primeiro mecanico a retomar fecharia o "esperando peca" do segundo.
     */
    @Query("select p from Parada p join fetch p.motivoParada "
            + "where p.ordemServicoId = ?1 and p.fim is null and p.osItemId is null")
    Optional<Parada> abertaDoCarro(UUID ordemServicoId);

    /** A parada aberta de um servico especifico. */
    @Query("select p from Parada p join fetch p.motivoParada where p.osItemId = ?1 and p.fim is null")
    Optional<Parada> abertaDoServico(UUID osItemId);

    /**
     * Todas as paradas abertas da OS, do carro e dos servicos.
     *
     * Para quando a OS inteira anda: entregue, cancelada, pronta. Ai nao ha
     * mais servico travado que faca sentido continuar aberto.
     */
    @Query("select p from Parada p join fetch p.motivoParada "
            + "where p.ordemServicoId = ?1 and p.fim is null")
    List<Parada> abertasDaOs(UUID ordemServicoId);

    @Query("select p from Parada p join fetch p.motivoParada where p.oficinaId = ?1 and p.fim is null")
    List<Parada> abertas(UUID oficinaId);

    /** Pareto: horas perdidas por motivo no periodo. */
    @Query(value = """
            select m.nome as motivo,
                   m.categoria as categoria,
                   count(*) as ocorrencias,
                   coalesce(sum(extract(epoch from (coalesce(p.fim, :agora) - p.inicio))), 0) / 3600.0 as horas
            from parada p
            join motivo_parada m on m.id = p.motivo_parada_id
            where p.oficina_id = :oficinaId
              and p.inicio >= :de and p.inicio < :ate
            group by m.nome, m.categoria
            order by horas desc
            """, nativeQuery = true)
    List<Object[]> paretoPorMotivo(@Param("oficinaId") UUID oficinaId,
                                   @Param("de") OffsetDateTime de,
                                   @Param("ate") OffsetDateTime ate,
                                   @Param("agora") OffsetDateTime agora);

    /**
     * Horas de parada por OS.
     *
     * Limitacao conhecida: soma os intervalos, sem unir os que se sobrepoem.
     * Dois servicos do mesmo carro parados as mesmas 3h somam 6h aqui, quando
     * o CARRO ficou parado 3h. Para o Pareto isso esta certo — ele mede
     * trabalho bloqueado, e dois servicos estavam. Para este numero, que a
     * tela le como "horas do carro parado", esta superestimado.
     *
     * Corrigir exige uniao de intervalos em SQL, e o numero e usado numa
     * frase de texto como ordem de grandeza, nao em decisao fina. Fica
     * anotado aqui em vez de escondido.
     */
    @Query(value = """
            select ordem_servico_id as osId,
                   coalesce(sum(extract(epoch from (coalesce(fim, :agora) - inicio))), 0) / 3600.0 as horas
            from parada
            where ordem_servico_id in (:osIds)
            group by ordem_servico_id
            """, nativeQuery = true)
    List<Object[]> horasParadasPorOs(@Param("osIds") List<UUID> osIds, @Param("agora") OffsetDateTime agora);
}
