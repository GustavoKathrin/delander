package br.com.oficina.arquivo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ArquivoOsRepository extends JpaRepository<ArquivoOs, UUID> {

    List<ArquivoOs> findByOrdemServicoIdOrderByCriadoEm(UUID ordemServicoId);

    List<ArquivoOs> findByOrdemServicoIdAndVisivelClienteTrueOrderByCriadoEm(UUID ordemServicoId);

    long countByOrdemServicoIdAndMomento(UUID ordemServicoId, String momento);

    /**
     * As fotos de um punhado de servicos, numa consulta so.
     *
     * O painel do mecanico monta dez, vinte cartoes de uma vez. Buscar foto
     * por cartao sao vinte idas ao banco para mostrar uma miniatura -- e o
     * painel recarrega sozinho a cada 30 segundos.
     */
    @Query("select a from ArquivoOs a where a.osItemId in :itens order by a.criadoEm")
    List<ArquivoOs> dosServicos(@Param("itens") Collection<UUID> itens);

    /** Atalho com nome que se le no ponto de uso. */
    default long contarDoMomento(UUID ordemServicoId, String momento) {
        return countByOrdemServicoIdAndMomento(ordemServicoId, momento);
    }

    /**
     * As fotos de entrada das OUTRAS passagens deste carro pela oficina.
     *
     * Serve para apagar a foto da visita anterior quando o carro volta: a
     * oficina decidiu guardar uma so por carro, sempre a de hoje. Guardar
     * todas encheria o disco, e guardar a antiga seria pior que nao ter —
     * uma foto de seis meses atras nao prova o estado de hoje.
     */
    @Query("select a from ArquivoOs a where a.momento = 'ENTRADA' "
            + "and a.ordemServicoId <> :osAtual "
            + "and a.ordemServicoId in (select o.id from OrdemServico o where o.veiculo.id = :veiculoId)")
    List<ArquivoOs> entradasDeOutrasPassagens(@Param("veiculoId") UUID veiculoId,
                                              @Param("osAtual") UUID osAtual);
}
