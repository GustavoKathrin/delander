package br.com.oficina.compartilhamento;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AcessoCompartilhamentoRepository extends JpaRepository<AcessoCompartilhamento, UUID> {
}
