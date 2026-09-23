package br.com.oficina.veiculo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VeiculoRepository extends JpaRepository<Veiculo, UUID> {

    Optional<Veiculo> findByOficinaIdAndPlaca(UUID oficinaId, String placa);

    @Query("select v from Veiculo v join fetch v.cliente where v.id = ?1")
    Optional<Veiculo> buscarComCliente(UUID id);

    @Query("""
            select v from Veiculo v join fetch v.cliente c
            where v.oficinaId = :oficinaId and v.ativo = true
              and (:busca is null or :busca = ''
                   or v.placa like upper(concat('%', :busca, '%'))
                   or lower(v.modelo) like lower(concat('%', :busca, '%'))
                   or lower(v.marca) like lower(concat('%', :busca, '%'))
                   or lower(c.nome) like lower(concat('%', :busca, '%')))
            order by v.placa
            """)
    Page<Veiculo> buscar(@Param("oficinaId") UUID oficinaId, @Param("busca") String busca, Pageable pageable);

    @Query("select v from Veiculo v join fetch v.cliente where v.cliente.id = ?1 and v.ativo = true order by v.placa")
    List<Veiculo> listarPorCliente(UUID clienteId);

    long countByOficinaIdAndAtivoTrue(UUID oficinaId);
}
