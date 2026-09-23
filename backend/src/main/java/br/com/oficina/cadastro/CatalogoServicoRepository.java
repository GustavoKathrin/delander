package br.com.oficina.cadastro;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface CatalogoServicoRepository extends JpaRepository<CatalogoServico, UUID> {

    @Query("select c from CatalogoServico c left join fetch c.especialidade "
            + "where c.oficinaId = ?1 order by c.descricao")
    List<CatalogoServico> listar(UUID oficinaId);

    @Query("select c from CatalogoServico c left join fetch c.especialidade "
            + "where c.oficinaId = ?1 and c.ativo = true order by c.descricao")
    List<CatalogoServico> listarAtivos(UUID oficinaId);
}
