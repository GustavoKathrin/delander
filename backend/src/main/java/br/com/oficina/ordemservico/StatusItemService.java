package br.com.oficina.ordemservico;

import br.com.oficina.apontamento.Apontamento;
import br.com.oficina.apontamento.ApontamentoDtos;
import br.com.oficina.apontamento.ApontamentoRepository;
import br.com.oficina.apontamento.ApontamentoService;
import br.com.oficina.cadastro.MotivoParada;
import br.com.oficina.cadastro.MotivoParadaRepository;
import br.com.oficina.common.Contexto;
import br.com.oficina.common.PermissaoException;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.parada.Parada;
import br.com.oficina.parada.ParadaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Concluir, pausar e cancelar um servico, direto da tela do carro.
 *
 * Antes daqui, o status do servico era consequencia do cronometro e de mais
 * nada: mudava so dentro de `ApontamentoService`, e tanto pausar quanto
 * concluir eram enderecados pelo `apontamentoId`. Na tela da OS o servico era
 * quase inerte — dava para trocar o mecanico e apagar. Quem queria dizer que
 * acabou tinha que sair do carro e ir para o Painel do mecanico.
 *
 * Classe propria porque `OrdemServicoService` ja passa de 900 linhas, e porque
 * o caminho novo precisa do `ApontamentoService` — que nao pode depender de
 * volta sem fechar um ciclo. A conta que os dois compartilham (o que acontece
 * com a OS depois que um servico muda) mora no {@link ReconciliacaoOs}.
 */
@Service
public class StatusItemService {

    private final OsItemRepository itemRepository;
    private final OrdemServicoRepository osRepository;
    private final ApontamentoRepository apontamentoRepository;
    private final ApontamentoService apontamentoService;
    private final ParadaRepository paradaRepository;
    private final MotivoParadaRepository motivoParadaRepository;
    private final ReconciliacaoOs reconciliacao;
    private final EventoService eventoService;
    private final ConfiguracaoService config;
    private final Contexto contexto;
    private final Clock clock;

    public StatusItemService(OsItemRepository itemRepository,
                             OrdemServicoRepository osRepository,
                             ApontamentoRepository apontamentoRepository,
                             ApontamentoService apontamentoService,
                             ParadaRepository paradaRepository,
                             MotivoParadaRepository motivoParadaRepository,
                             ReconciliacaoOs reconciliacao,
                             EventoService eventoService,
                             ConfiguracaoService config,
                             Contexto contexto,
                             Clock clock) {
        this.itemRepository = itemRepository;
        this.osRepository = osRepository;
        this.apontamentoRepository = apontamentoRepository;
        this.apontamentoService = apontamentoService;
        this.paradaRepository = paradaRepository;
        this.motivoParadaRepository = motivoParadaRepository;
        this.reconciliacao = reconciliacao;
        this.eventoService = eventoService;
        this.config = config;
        this.contexto = contexto;
        this.clock = clock;
    }

    @Transactional
    public void transicionar(UUID osId, UUID itemId, OsDtos.ItemTransicaoRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);

        OsItem item = itemRepository.buscarCompleto(itemId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Servico", itemId));
        if (!item.getOficinaId().equals(oficinaId)
                || !item.getOrdemServico().getId().equals(osId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }

        MaquinaEstadosItem.validar(item.getStatus(), req.status());

        switch (req.status()) {
            // Delegar, nunca reimplementar: `iniciar` carrega a exigencia de
            // estimativa, apontamento simultaneo, multiplos mecanicos por OS,
            // a resolucao de qual funcionario e o `garantirOsEmExecucao` que
            // valida a maquina de estados da OS e gera o link do cliente.
            case EM_EXECUCAO -> apontamentoService.iniciar(new ApontamentoDtos.IniciarRequisicao(
                    itemId, req.horasEstimadas(), req.descricao()));
            case PAUSADO -> pausar(item, req, oficinaId, agora);
            case CONCLUIDO -> concluir(item, req, oficinaId, agora);
            case CANCELADO -> cancelar(item, req, oficinaId, agora);
            default -> throw new RegraNegocioException(
                    "Status '%s' não pode ser definido pela tela.".formatted(req.status().descricao()));
        }
    }

    // ---------------------------------------------------------------- pausar

    private void pausar(OsItem item, OsDtos.ItemTransicaoRequisicao req,
                        UUID oficinaId, OffsetDateTime agora) {
        exigirDonoDoItemOuGerencia(item);
        MotivoParada motivo = resolverMotivo(req, oficinaId);

        // A exigencia de motivo vale nos dois caminhos: quem pausa pela tela da
        // OS nao pode escapar de uma regra que quem pausa pelo painel cumpre.
        if (motivo == null && config.flag(oficinaId, Chaves.EXIGIR_MOTIVO_PAUSA)) {
            throw new RegraNegocioException(
                    "Diga por que o serviço parou. É desse motivo que sai o relatório do que "
                            + "trava a oficina.");
        }

        OrdemServico os = item.getOrdemServico();
        fecharApontamentoAberto(item, req.descricao(), agora);

        item.setStatus(StatusItem.PAUSADO);
        itemRepository.save(item);

        boolean visivel = req.visivelCliente() != null
                ? req.visivelCliente()
                : motivo != null && motivo.isVisivelClientePadrao();

        // A parada e deste servico, e nao do carro: e isso que deixa dois
        // mecanicos pausarem dois servicos do mesmo carro com motivos
        // diferentes sem um apagar o outro.
        if (motivo != null && paradaRepository.abertaDoServico(item.getId()).isEmpty()) {
            Parada parada = new Parada();
            parada.setOficinaId(oficinaId);
            parada.setOrdemServicoId(os.getId());
            parada.setOsItemId(item.getId());
            parada.setMotivoParada(motivo);
            parada.setInicio(agora);
            parada.setDescricao(req.descricao());
            parada.setVisivelCliente(visivel);
            paradaRepository.save(parada);
        }

        eventoService.doServico(oficinaId, os.getId(), item.getId(), EventoService.SERVICO_PAUSADO,
                motivo == null
                        ? "Serviço pausado: " + item.getDescricao()
                        : "Serviço pausado (%s): %s".formatted(motivo.getNome(), item.getDescricao()),
                visivel,
                motivo == null ? null : Map.of("motivo", motivo.getNome(),
                        "categoria", motivo.getCategoria().name()));

        reconciliacao.reconciliar(os, oficinaId, agora);
    }

    // -------------------------------------------------------------- concluir

    private void concluir(OsItem item, OsDtos.ItemTransicaoRequisicao req,
                          UUID oficinaId, OffsetDateTime agora) {
        exigirDonoDoItemOuGerencia(item);
        OrdemServico os = item.getOrdemServico();

        fecharApontamentoAberto(item, req.descricao(), agora);
        // O servico acabou: se ele estava travado, parou de estar.
        encerrarParadaDoServico(item, os, agora);
        item.setStatus(StatusItem.CONCLUIDO);
        itemRepository.save(item);

        BigDecimal trabalhadas = apontamentoRepository.listarPorOs(os.getId()).stream()
                .filter(a -> a.getOsItem().getId().equals(item.getId()))
                .map(a -> a.horas(agora))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        // Servico de dois minutos existe e ninguem cronometra. Entra com zero
        // hora e o evento diz isso, em vez de inventar as horas estimadas — que
        // seria fabricar mao de obra e estragar o indicador de aproveitamento.
        // Hora so vem do relogio.
        boolean semCronometro = trabalhadas.compareTo(BigDecimal.ZERO) == 0;

        eventoService.doServico(oficinaId, os.getId(), item.getId(), EventoService.SERVICO_CONCLUIDO,
                semCronometro
                        ? "'%s' concluído sem cronômetro (0h trabalhadas)".formatted(item.getDescricao())
                        : "'%s' concluído (%sh trabalhadas, %sh estimadas)"
                                .formatted(item.getDescricao(), trabalhadas, item.getHorasEstimadas()),
                true, Map.of("trabalhadas", trabalhadas, "estimadas", item.getHorasEstimadas()));

        reconciliacao.reconciliar(os, oficinaId, agora);
    }

    // -------------------------------------------------------------- cancelar

    private void cancelar(OsItem item, OsDtos.ItemTransicaoRequisicao req,
                          UUID oficinaId, OffsetDateTime agora) {
        // Cancelar mexe no valor da OS: e decisao comercial, nao de bancada.
        contexto.exigirGerencia();
        OrdemServico os = item.getOrdemServico();

        // Nao recusa por causa do cronometro. O caminho antigo (`removerItem`)
        // mandava "pause antes de remover" — exatamente a danca de duas telas
        // que estes botoes existem para matar. As horas ja trabalhadas ficam
        // no historico com o `fim` real.
        fecharApontamentoAberto(item, "Serviço cancelado", agora);
        // Servico cancelado nao espera mais nada; a parada dele para de contar.
        encerrarParadaDoServico(item, os, agora);

        item.setStatus(StatusItem.CANCELADO);
        item.setCanceladoEm(agora);
        item.setMotivoCancelamento(
                req.descricao() == null || req.descricao().isBlank() ? null : req.descricao().trim());
        itemRepository.save(item);

        eventoService.doServico(oficinaId, os.getId(), item.getId(), EventoService.ITEM_REMOVIDO,
                item.getMotivoCancelamento() == null
                        ? "Serviço cancelado: " + item.getDescricao()
                        : "Serviço cancelado: %s (%s)"
                                .formatted(item.getDescricao(), item.getMotivoCancelamento()),
                Boolean.TRUE.equals(req.visivelCliente()), null);

        // Servico cancelado nao se cobra. Esquecer isto deixa a OS cobrando um
        // servico que nao vai ser feito — e e o tipo de defeito que ninguem
        // liga ao botao que o causou.
        recalcularMaoObra(os);
        reconciliacao.reconciliar(os, oficinaId, agora);
    }

    // ----------------------------------------------------------------- apoio

    /** Fecha a parada daquele servico, se houver. As dos outros continuam. */
    private void encerrarParadaDoServico(OsItem item, OrdemServico os, OffsetDateTime agora) {
        paradaRepository.abertaDoServico(item.getId()).ifPresent(parada -> {
            parada.setFim(agora);
            paradaRepository.save(parada);
            eventoService.registrar(os.getOficinaId(), os.getId(), EventoService.SERVICO_RETOMADO,
                    "Parada encerrada: " + parada.getMotivoParada().getNome(),
                    parada.isVisivelCliente());
        });
    }

    private void fecharApontamentoAberto(OsItem item, String observacao, OffsetDateTime agora) {
        apontamentoRepository.abertoDoItem(item.getId()).ifPresent(aberto -> {
            aberto.setFim(agora);
            if (observacao != null && !observacao.isBlank()) {
                aberto.setObservacao(observacao);
            }
            apontamentoRepository.save(aberto);
        });
    }

    private MotivoParada resolverMotivo(OsDtos.ItemTransicaoRequisicao req, UUID oficinaId) {
        if (req.motivoParadaId() == null) {
            return null;
        }
        return motivoParadaRepository.findById(req.motivoParadaId())
                .filter(m -> m.getOficinaId().equals(oficinaId))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Motivo de parada", req.motivoParadaId()));
    }

    /**
     * Quem trabalha no servico, ou quem manda.
     *
     * A recepcao fica de fora: ela nao tem como saber se o servico acabou. Nao
     * e desconfianca — e que a resposta certa esta com quem estava com a mao
     * no carro.
     */
    private void exigirDonoDoItemOuGerencia(OsItem item) {
        if (contexto.papel().gerencia()) {
            return;
        }
        UUID meuFuncionarioId = contexto.funcionarioId();
        boolean doItem = item.getFuncionario() != null && meuFuncionarioId != null
                && item.getFuncionario().getId().equals(meuFuncionarioId);
        boolean apontandoAgora = apontamentoRepository.abertoDoItem(item.getId())
                .map(Apontamento::getFuncionario)
                .map(f -> f.getId().equals(meuFuncionarioId))
                .orElse(false);
        if (!doItem && !apontandoAgora) {
            throw new PermissaoException(
                    "Este serviço é de outro mecânico. Quem está com o carro é quem diz que ele andou.");
        }
    }

    private void recalcularMaoObra(OrdemServico os) {
        BigDecimal total = os.getItens().stream()
                .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                .map(i -> i.getValor() == null ? BigDecimal.ZERO : i.getValor())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        os.setValorMaoObra(total);
        osRepository.save(os);
    }
}
