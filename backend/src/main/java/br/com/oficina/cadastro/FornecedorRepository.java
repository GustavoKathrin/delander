package br.com.oficina.cadastro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface FornecedorRepository extends JpaRepository<Fornecedor, UUID> {

    @Query("select f from Fornecedor f where f.oficinaId = ?1 order by f.nome")
    List<Fornecedor> listar(UUID oficinaId);

    @Query("select f from Fornecedor f where f.oficinaId = ?1 and f.ativo = true order by f.nome")
    List<Fornecedor> listarAtivos(UUID oficinaId);
}
