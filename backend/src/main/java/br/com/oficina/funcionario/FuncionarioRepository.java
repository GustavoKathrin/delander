package br.com.oficina.funcionario;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FuncionarioRepository extends JpaRepository<Funcionario, UUID> {

    Optional<Funcionario> findByUsuarioId(UUID usuarioId);

    @Query("select distinct f from Funcionario f left join fetch f.especialidades "
            + "where f.oficinaId = ?1 order by f.nome")
    List<Funcionario> listarComEspecialidades(UUID oficinaId);

    @Query("select distinct f from Funcionario f left join fetch f.especialidades "
            + "where f.oficinaId = ?1 and f.ativo = true order by f.nome")
    List<Funcionario> listarAtivosComEspecialidades(UUID oficinaId);

    List<Funcionario> findByOficinaIdAndAtivoTrueOrderByNome(UUID oficinaId);

    long countByOficinaIdAndAtivoTrue(UUID oficinaId);
}
