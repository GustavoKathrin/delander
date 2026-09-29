package br.com.oficina.peca;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PecaCatalogoRepository extends JpaRepository<PecaCatalogo, UUID> {

    @Query("select p from PecaCatalogo p where p.oficinaId = ?1 order by p.descricao")
    List<PecaCatalogo> listar(UUID oficinaId);

    @Query("select p from PecaCatalogo p where p.oficinaId = ?1 and p.ativo = true order by p.descricao")
    List<PecaCatalogo> listarAtivas(UUID oficinaId);

    /**
     * Busca enquanto o mecanico digita, no mesmo formato do autocompletar de
     * cliente: descricao ou codigo, sem diferenciar maiuscula.
     *
     * Ordena por descricao e nao por saldo de proposito — quem digita esta
     * procurando uma peca especifica, e nao a que sobrou mais na prateleira.
     */
    @Query("select p from PecaCatalogo p where p.oficinaId = :oficinaId and p.ativo = true "
            + "and (lower(p.descricao) like lower(concat('%', :termo, '%')) "
            + "  or lower(p.codigo) like lower(concat('%', :termo, '%'))) "
            + "order by p.descricao")
    List<PecaCatalogo> autocompletar(@Param("oficinaId") UUID oficinaId,
                                     @Param("termo") String termo,
                                     PageRequest pagina);

    /** O codigo e o que impede cadastrar a mesma peca duas vezes. */
    Optional<PecaCatalogo> findByOficinaIdAndCodigoIgnoreCase(UUID oficinaId, String codigo);

    /**
     * O que acabou ou esta acabando, para quem compra.
     *
     * Zerada primeiro: e a que ja esta faltando, nao a que vai faltar.
     */
    @Query("select p from PecaCatalogo p where p.oficinaId = ?1 and p.ativo = true "
            + "and p.quantidadeEstoque <= p.estoqueMinimo "
            + "order by p.quantidadeEstoque, p.descricao")
    List<PecaCatalogo> noMinimo(UUID oficinaId);
}
