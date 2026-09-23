package br.com.oficina.cadastro;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BoxRepository extends JpaRepository<Box, UUID> {

    List<Box> findByOficinaIdOrderByNome(UUID oficinaId);

    List<Box> findByOficinaIdAndAtivoTrueOrderByNome(UUID oficinaId);

    Optional<Box> findByOficinaIdAndNomeIgnoreCase(UUID oficinaId, String nome);

    long countByOficinaIdAndAtivoTrue(UUID oficinaId);
}
