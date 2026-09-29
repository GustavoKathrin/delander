package br.com.oficina.ordemservico;

import br.com.oficina.apontamento.Apontamento;
import br.com.oficina.apontamento.ApontamentoRepository;
import br.com.oficina.parada.Parada;
import br.com.oficina.parada.ParadaRepository;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Depois que um servico muda, a OS precisa acompanhar.
 *
 * Duas contas, e as duas sao invisiveis para quem aperta o botao:
 *
 * - pausou o ultimo servico que estava rodando -> o carro esta parado;
 * - acabaram todos os servicos -> o carro esta pronto, e comeca a contar o
 *   tempo de "aguardando retirada", que e o que entope o patio.
 *
 * Isto morava dentro de `ApontamentoService.pausar` e `.concluir`. Com os
 * botoes de servico na tela da OS existe um segundo caminho para as mesmas
 * mudancas, e duas copias dessa conta divergiriam no primeiro ajuste. Classe
 * propria tambem evita a dependencia circular: `StatusItemService` precisa do
 * `ApontamentoService` para iniciar, e o contrario tornaria o grafo ciclico.
 */
@Component
public class ReconciliacaoOs {

    private final ApontamentoRepository apontamentoRepository;
    private final OrdemServicoRepository osRepository;
    private final ParadaRepository paradaRepository;
    private final EventoService eventoService;

    public ReconciliacaoOs(ApontamentoRepository apontamentoRepository,
                           OrdemServicoRepository osRepository,
                           ParadaRepository paradaRepository,
                           EventoService eventoService) {
        this.apontamentoRepository = apontamentoRepository;
        this.osRepository = osRepository;
        this.paradaRepository = paradaRepository;
        this.eventoService = eventoService;
    }

    /**
     * Ajusta o status da OS ao que os servicos dela dizem agora.
     *
     * Chamar sempre que um servico muda de estado — inclusive ao cancelar, que
     * e o caso que hoje nao reconcilia nada: cancelar o ultimo servico pendente
     * deixa o carro "em execucao" sem ter o que fazer, e ele some do radar de
     * carros parados por estar tecnicamente em andamento.
     */
    public void reconciliar(OrdemServico os, UUID oficinaId, OffsetDateTime agora) {
        if (os.getStatus().finalizada()) {
            return;
        }

        List<OsItem> vivos = os.getItens().stream()
                .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                .toList();

        // A guarda que faltava. `allMatch` sobre lista vazia devolve `true`:
        // sem isto, cancelar o ultimo servico da OS mandava o carro para
        // "Pronto - aguardando retirada" com zero servicos feitos. Era
        // inalcancavel enquanto concluir exigia apontamento aberto; com o
        // botao de cancelar na linha do servico, deixa de ser.
        boolean todosConcluidos = !vivos.isEmpty()
                && vivos.stream().allMatch(i -> i.getStatus() == StatusItem.CONCLUIDO);

        if (todosConcluidos && os.getStatus() != StatusOs.PRONTO_AGUARDANDO_RETIRADA) {
            encerrarParadaAberta(os, agora);
            StatusOs de = os.getStatus();
            os.setStatus(StatusOs.PRONTO_AGUARDANDO_RETIRADA);
            os.setProntoEm(agora);
            osRepository.save(os);
            eventoService.registrar(oficinaId, os.getId(), EventoService.STATUS_ALTERADO,
                    "%s -> %s".formatted(de.descricao(), StatusOs.PRONTO_AGUARDANDO_RETIRADA.descricao()),
                    true);
            return;
        }

        // Ninguem mais com a mao no carro: ele esta parado, e o quadro precisa
        // dizer isso. Sem esta parte, um carro sem ninguem trabalhando continua
        // "em execucao" e nao aparece no radar.
        if (os.getStatus() == StatusOs.EM_EXECUCAO && !alguemTrabalhando(os)) {
            os.setStatus(StatusOs.PAUSADO);
            osRepository.save(os);
            eventoService.registrar(oficinaId, os.getId(), EventoService.STATUS_ALTERADO,
                    "%s -> %s".formatted(StatusOs.EM_EXECUCAO.descricao(), StatusOs.PAUSADO.descricao()),
                    true);
        }
    }

    public boolean alguemTrabalhando(OrdemServico os) {
        return apontamentoRepository.listarPorOs(os.getId()).stream().anyMatch(Apontamento::aberto);
    }

    public void encerrarParadaAberta(OrdemServico os, OffsetDateTime agora) {
        paradaRepository.abertaDaOs(os.getId()).ifPresent(parada -> fechar(parada, os, agora));
    }

    private void fechar(Parada parada, OrdemServico os, OffsetDateTime agora) {
        parada.setFim(agora);
        paradaRepository.save(parada);
        eventoService.registrar(os.getOficinaId(), os.getId(), EventoService.SERVICO_RETOMADO,
                "Parada encerrada: " + parada.getMotivoParada().getNome(),
                parada.isVisivelCliente());
    }
}
