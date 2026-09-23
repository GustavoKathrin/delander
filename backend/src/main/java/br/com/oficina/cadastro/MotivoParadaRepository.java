package br.com.oficina.cadastro;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MotivoParadaRepository extends JpaRepository<MotivoParada, UUID> {

    List<MotivoParada> findByOficinaIdOrderByNome(UUID oficinaId);

    List<MotivoParada> findByOficinaIdAndAtivoTrueOrderByNome(UUID oficinaId);

    Optional<MotivoParada> findByOficinaIdAndNomeIgnoreCase(UUID oficinaId, String nome);
}
