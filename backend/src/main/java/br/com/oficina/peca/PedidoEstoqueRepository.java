package br.com.oficina.peca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface PedidoEstoqueRepository extends JpaRepository<PedidoEstoque, UUID> {

    /**
     * O que ainda nao chegou.
     *
     * Ordena por previsao, com quem nao tem previsao por ultimo — o contrario
     * da fila de carros, onde "sem prazo" vai para o topo porque significa
     * carro parado. Aqui sem previsao quer dizer so que ninguem perguntou ao
     * fornecedor ainda, e isso nao e urgencia.
     */
    @Query("select p from PedidoEstoque p where p.oficinaId = ?1 "
            + "and p.status in (br.com.oficina.peca.StatusPeca.SOLICITADA, "
            + "                 br.com.oficina.peca.StatusPeca.COMPRADA) "
            + "order by case when p.previsaoChegada is null then 1 else 0 end, "
            + "         p.previsaoChegada, p.descricao")
    List<PedidoEstoque> pendentes(UUID oficinaId);
}
