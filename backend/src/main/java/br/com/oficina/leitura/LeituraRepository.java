package br.com.oficina.leitura;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LeituraRepository extends JpaRepository<Leitura, UUID> {

    @Query("""
            select l from Leitura l
              left join fetch l.veiculo
             where l.id = ?1
            """)
    Optional<Leitura> buscarCompleta(UUID id);

    /** As leituras daquele carro: oficial primeiro, anomalias depois. */
    @Query("""
            select l from Leitura l
              left join fetch l.veiculo v
             where l.oficinaId = ?1 and v.id = ?2
             order by l.tipo, l.momentoTeste desc nulls last, l.criadoEm desc
            """)
    List<Leitura> doVeiculo(UUID oficinaId, UUID veiculoId);

    /**
     * Busca por placa OU modelo: e o que faz a leitura de um Civic servir
     * para outro Civic.
     */
    @Query(value = """
            select l from Leitura l
              left join fetch l.veiculo v
             where l.oficinaId = :oficinaId
               and (:tipo is null or l.tipo = :tipo)
               and (:busca is null or :busca = ''
                    or v.placa like upper(concat('%', :busca, '%'))
                    or lower(l.marca) like lower(concat('%', :busca, '%'))
                    or lower(l.modelo) like lower(concat('%', :busca, '%'))
                    or lower(l.motor) like lower(concat('%', :busca, '%'))
                    or cast(l.ano as string) like concat('%', :busca, '%'))
             order by l.momentoTeste desc nulls last, l.criadoEm desc
            """,
            countQuery = """
            select count(l) from Leitura l
              left join l.veiculo v
             where l.oficinaId = :oficinaId
               and (:tipo is null or l.tipo = :tipo)
               and (:busca is null or :busca = ''
                    or v.placa like upper(concat('%', :busca, '%'))
                    or lower(l.marca) like lower(concat('%', :busca, '%'))
                    or lower(l.modelo) like lower(concat('%', :busca, '%'))
                    or lower(l.motor) like lower(concat('%', :busca, '%'))
                    or cast(l.ano as string) like concat('%', :busca, '%'))
            """)
    Page<Leitura> buscar(@Param("oficinaId") UUID oficinaId,
                         @Param("busca") String busca,
                         @Param("tipo") TipoLeitura tipo,
                         Pageable paginacao);

    Optional<Leitura> findByOficinaIdAndNumeroRelatorio(UUID oficinaId, String numeroRelatorio);

    long countByOficinaIdAndSituacao(UUID oficinaId, SituacaoLeitura situacao);

    /**
     * Rebaixa a oficial anterior daquele carro.
     *
     * Duas instrucoes (rebaixa, depois promove) em vez de uma troca: o indice
     * unico parcial e conferido por linha dentro da instrucao, entao a troca
     * num UPDATE so tropecaria nela mesma.
     *
     * O coalesce e obrigatorio: sem condicao a linha rebaixada viola
     * ck_leitura_anomalia. E o clearAutomatically tambem: sem ele uma
     * instancia ja carregada continua OFICIAL na memoria e volta no flush.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update Leitura l
               set l.tipo = br.com.oficina.leitura.TipoLeitura.ANOMALIA,
                   l.condicao = coalesce(l.condicao, 'Leitura anterior')
             where l.veiculo.id = :veiculoId
               and l.tipo = br.com.oficina.leitura.TipoLeitura.OFICIAL
               and l.situacao = br.com.oficina.leitura.SituacaoLeitura.COMPLETA
               and l.id <> :id
            """)
    int rebaixarOficiais(@Param("veiculoId") UUID veiculoId, @Param("id") UUID id);
}
