package br.com.oficina.wiki;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface WikiArtigoRepository extends JpaRepository<WikiArtigo, UUID> {

    /**
     * Busca por texto, marca, modelo, motor ou ano.
     *
     * O ano casa por FAIXA: um artigo de "Civic 2012-2016" tem que aparecer
     * para quem digitou 2014. E o ponto do artigo servir ao modelo e nao ao
     * carro.
     */
    @Query(value = """
            select a from WikiArtigo a
             where a.oficinaId = :oficinaId
               and (:busca is null or :busca = ''
                    or lower(a.titulo)  like lower(concat('%', :busca, '%'))
                    or lower(a.corpo)   like lower(concat('%', :busca, '%'))
                    or lower(a.marca)   like lower(concat('%', :busca, '%'))
                    or lower(a.modelo)  like lower(concat('%', :busca, '%'))
                    or lower(a.motor)   like lower(concat('%', :busca, '%')))
             order by a.atualizadoEm desc nulls last, a.criadoEm desc
            """,
            countQuery = """
            select count(a) from WikiArtigo a
             where a.oficinaId = :oficinaId
               and (:busca is null or :busca = ''
                    or lower(a.titulo)  like lower(concat('%', :busca, '%'))
                    or lower(a.corpo)   like lower(concat('%', :busca, '%'))
                    or lower(a.marca)   like lower(concat('%', :busca, '%'))
                    or lower(a.modelo)  like lower(concat('%', :busca, '%'))
                    or lower(a.motor)   like lower(concat('%', :busca, '%')))
            """)
    Page<WikiArtigo> buscar(@Param("oficinaId") UUID oficinaId,
                            @Param("busca") String busca,
                            Pageable paginacao);

    /**
     * Artigos que servem para aquele modelo e ano.
     * Artigo sem marca/modelo vale para qualquer carro (dica geral da oficina).
     */
    @Query("""
            select a from WikiArtigo a
             where a.oficinaId = :oficinaId
               and a.publicado = true
               and (a.marca  is null or lower(a.marca)  = lower(:marca))
               and (a.modelo is null or lower(:modelo) like concat('%', lower(a.modelo), '%'))
               and (a.anoDe  is null or :ano is null or a.anoDe  <= :ano)
               and (a.anoAte is null or :ano is null or a.anoAte >= :ano)
             order by a.criadoEm desc
            """)
    List<WikiArtigo> paraOModelo(@Param("oficinaId") UUID oficinaId,
                                 @Param("marca") String marca,
                                 @Param("modelo") String modelo,
                                 @Param("ano") Integer ano);

    List<WikiArtigo> findByOficinaIdAndVeiculoIdOrderByCriadoEmDesc(UUID oficinaId, UUID veiculoId);
}
