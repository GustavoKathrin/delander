package br.com.oficina.cadastro;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EspecialidadeRepository extends JpaRepository<Especialidade, UUID> {

    List<Especialidade> findByOficinaIdOrderByNome(UUID oficinaId);

    List<Especialidade> findByOficinaIdAndAtivoTrueOrderByNome(UUID oficinaId);

    Optional<Especialidade> findByOficinaIdAndNomeIgnoreCase(UUID oficinaId, String nome);
}
