package br.com.oficina.cliente;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ClienteRepository extends JpaRepository<Cliente, UUID> {

    @Query("""
            select c from Cliente c
            where c.oficinaId = :oficinaId
              and c.ativo = true
              and (:busca is null or :busca = ''
                   or lower(c.nome) like lower(concat('%', :busca, '%'))
                   or c.telefone like concat('%', :busca, '%')
                   or c.documento like concat('%', :busca, '%'))
            order by c.nome
            """)
    Page<Cliente> buscar(@Param("oficinaId") UUID oficinaId, @Param("busca") String busca, Pageable pageable);

    @Query("""
            select c from Cliente c
            where c.oficinaId = :oficinaId and c.ativo = true
              and (lower(c.nome) like lower(concat('%', :termo, '%'))
                   or c.telefone like concat('%', :termo, '%')
                   or c.documento like concat('%', :termo, '%'))
            order by c.nome
            """)
    List<Cliente> autocompletar(@Param("oficinaId") UUID oficinaId, @Param("termo") String termo, Pageable pageable);

    long countByOficinaIdAndAtivoTrue(UUID oficinaId);
}
