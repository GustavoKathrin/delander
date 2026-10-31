package br.com.oficina.peca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface CotacaoPecaRepository extends JpaRepository<CotacaoPeca, UUID> {

    @Query("select c from CotacaoPeca c where c.pecaOsId in ?1 order by c.valorUnitario")
    List<CotacaoPeca> dasPecas(List<UUID> pecaIds);

    List<CotacaoPeca> findByPecaOsId(UUID pecaOsId);
}
