package br.com.oficina.peca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PecaOsRepository extends JpaRepository<PecaOs, UUID> {

    List<PecaOs> findByOrdemServicoIdOrderByCriadoEm(UUID ordemServicoId);

    /**
     * A fila de compras: so o que alguem precisa ir atras.
     *
     * Peca de estoque fica de fora — ela entrou no orcamento e acabou.
     * A ordenacao final e por urgencia e acontece no servico, porque
     * depende da agenda do carro, nao da peca.
     */
    @Query("select p from PecaOs p where p.oficinaId = :oficinaId "
            + "and p.origem = :origem and p.status in :status")
    List<PecaOs> daFilaDeCompras(@Param("oficinaId") UUID oficinaId,
                                 @Param("origem") OrigemPeca origem,
                                 @Param("status") List<StatusPeca> status);

    /**
     * As pecas de COMPRA destas OS — uma consulta so para o lote inteiro.
     *
     * Devolve as pecas, e nao um conjunto de ids, porque o card precisa de
     * duas coisas diferentes: o selo (esperando / chegou) e o alerta, que
     * tem que dizer QUAL peca falta. Com ids soltos o alerta seria generico,
     * e alerta generico ninguem age em cima.
     *
     * Peca de estoque fica de fora: ela ja esta na prateleira, e acender
     * "esperando peca" por causa dela faria o patio mentir.
     */
    @Query("select p from PecaOs p where p.ordemServicoId in :ids "
            + "and p.origem = br.com.oficina.peca.OrigemPeca.COMPRAR "
            + "and p.status <> br.com.oficina.peca.StatusPeca.CANCELADA")
    List<PecaOs> pecasDeCompraDasOs(@Param("ids") List<UUID> ids);
}
