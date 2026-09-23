package br.com.oficina.veiculo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VeiculoProprietarioHistRepository extends JpaRepository<VeiculoProprietarioHist, UUID> {

    List<VeiculoProprietarioHist> findByVeiculoIdOrderByInicioDesc(UUID veiculoId);
}
