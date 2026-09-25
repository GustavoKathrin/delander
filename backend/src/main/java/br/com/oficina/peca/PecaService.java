package br.com.oficina.peca;

import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.ordemservico.EventoService;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import br.com.oficina.ordemservico.OsDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.List;
import java.util.UUID;

/**
 * Pecas da OS. Falta de peca e o motivo numero um de carro parado,
 * por isso a previsao de chegada aparece direto no card do quadro.
 */
@Service
public class PecaService {

    private final PecaOsRepository repository;
    private final OrdemServicoRepository osRepository;
    private final EventoService eventoService;
    private final Contexto contexto;
    private final Clock clock;

    public PecaService(PecaOsRepository repository,
                       OrdemServicoRepository osRepository,
                       EventoService eventoService,
                       Contexto contexto,
                       Clock clock) {
        this.repository = repository;
        this.osRepository = osRepository;
        this.eventoService = eventoService;
        this.contexto = contexto;
        this.clock = clock;
    }

    @Transactional
    // Adicionar e o diagnostico do mecanico: e ele quem diz o que o carro
    // precisa. Sem isto o fluxo que o dono descreveu nao existe.
    public OsDtos.PecaResposta adicionar(UUID osId, PecaDtos.Requisicao req) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = carregarOs(osId, oficinaId);

        PecaOs peca = new PecaOs();
        peca.setOficinaId(oficinaId);
        peca.setOrdemServicoId(os.getId());
        aplicar(peca, req);
        PecaOs salva = repository.save(peca);

        recalcularValorPecas(os);

        eventoService.registrar(oficinaId, osId, EventoService.PECA_SOLICITADA,
                "Peca solicitada: %s%s".formatted(salva.getDescricao(),
                        salva.getPrevisaoChegada() == null ? ""
                                : " (previsao " + salva.getPrevisaoChegada() + ")"),
                true);

        return mapear(salva);
    }

    @Transactional
    public OsDtos.PecaResposta atualizar(UUID osId, UUID pecaId, PecaDtos.Requisicao req) {
        // Comprar e receber e trabalho de quem atende, nao de quem monta.
        contexto.exigirAtendimento(
                "Comprar e receber peça é do atendente, do gerente ou do dono.");
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = carregarOs(osId, oficinaId);

        PecaOs peca = repository.findById(pecaId)
                .filter(p -> p.getOrdemServicoId().equals(osId) && p.getOficinaId().equals(oficinaId))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Peca", pecaId));

        StatusPeca anterior = peca.getStatus();
        aplicar(peca, req);
        PecaOs salva = repository.save(peca);

        recalcularValorPecas(os);

        if (anterior != salva.getStatus()) {
            eventoService.registrar(oficinaId, osId, EventoService.PECA_ATUALIZADA,
                    "%s: %s -> %s".formatted(salva.getDescricao(),
                            anterior.descricao(), salva.getStatus().descricao()),
                    salva.getStatus() == StatusPeca.RECEBIDA || salva.getStatus() == StatusPeca.APLICADA);
        }

        return mapear(salva);
    }

    @Transactional
    public void remover(UUID osId, UUID pecaId) {
        contexto.exigirGerencia();
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = carregarOs(osId, oficinaId);
        PecaOs peca = repository.findById(pecaId)
                .filter(p -> p.getOrdemServicoId().equals(osId) && p.getOficinaId().equals(oficinaId))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Peca", pecaId));
        repository.delete(peca);
        recalcularValorPecas(os);
    }

    /**
     * A fila de compras: o que precisa ser comprado, para qual carro e ate quando.
     *
     * Tres recortes, e cada um tem motivo:
     *
     * - so `origem = COMPRAR`. Peca que ja esta na prateleira entrou no
     *   orcamento e acabou; nao e trabalho de ninguem.
     * - so OS com orcamento APROVADO. Comprar peca de servico que o cliente
     *   ainda pode recusar e ficar com a peca na mao â decisao do dono.
     * - so OS viva. Carro entregue ou cancelado nao gera compra.
     *
     * A ordem e por urgencia, nao por previsao do fornecedor: primeiro o
     * carro parado sem dia marcado, depois quem ja passou do prazo, depois
     * o resto por prazo.
     */
    @Transactional(readOnly = true)
    public List<PecaDtos.Pendente> pendentes() {
        // A fila e da oficina inteira: mecanico nao ve o que os outros carros
        // custam nem com quem a oficina compra.
        contexto.exigirAtendimento(
                "A fila de compras é do atendente, do gerente ou do dono.");
        UUID oficinaId = contexto.oficinaId();
        LocalDate hoje = LocalDate.now(clock);

        List<PecaOs> pecas = repository.daFilaDeCompras(
                oficinaId, OrigemPeca.COMPRAR, List.of(StatusPeca.SOLICITADA, StatusPeca.COMPRADA));
        if (pecas.isEmpty()) {
            return List.of();
        }

        // Uma consulta para todas as OS, e nao uma por peca: esta tela lista
        // a oficina inteira e o N+1 aparecia com meia duzia de carros.
        List<UUID> osIds = pecas.stream().map(PecaOs::getOrdemServicoId).distinct().toList();
        Map<UUID, OrdemServico> ordens = osRepository.findAllById(osIds).stream()
                .collect(Collectors.toMap(OrdemServico::getId, o -> o));

        List<PecaDtos.Pendente> fila = new ArrayList<>();
        for (PecaOs p : pecas) {
            OrdemServico os = ordens.get(p.getOrdemServicoId());
            if (os == null || os.getAprovadoEm() == null || os.getStatus().finalizada()) {
                continue;
            }
            fila.add(montarPendente(p, os, hoje));
        }

        fila.sort(PecaService::maisUrgentePrimeiro);
        return fila;
    }

    private PecaDtos.Pendente montarPendente(PecaOs p, OrdemServico os, LocalDate hoje) {
        LocalDate comprarAte = p.getMomentoNecessario()
                .prazo(os.getDataAgendada(), os.getPrevisaoEntrega());

        boolean emRisco = emRisco(comprarAte, p.getPrevisaoChegada(), hoje);

        Integer folga = comprarAte == null
                ? null
                : (int) ChronoUnit.DAYS.between(hoje, comprarAte);

        return new PecaDtos.Pendente(
                p.getId(),
                p.getOrdemServicoId(),
                os.getNumero(),
                os.getVeiculo().getPlaca(),
                os.getCliente().getNome(),
                p.getDescricao(),
                p.getQuantidade(),
                p.getFornecedor(),
                p.getStatus(),
                p.getStatus().descricao(),
                p.getMomentoNecessario(),
                p.getMomentoNecessario().descricao(),
                p.getValorUnitario(),
                p.getPrevisaoChegada(),
                comprarAte,
                emRisco,
                folga,
                os.getDataAgendada() == null);
    }

    /**
     * A peca esta em risco em tres situacoes, e as tres sao a mesma coisa
     * vista de angulos diferentes: o carro vai esperar por ela.
     *
     * 1. Sem prazo — a OS nao tem dia marcado. O carro esta parado e ninguem
     *    sabe quando ele anda; e o pior caso, nao o mais folgado.
     * 2. O prazo ja passou e ela nao chegou. A fila so traz peca ainda nao
     *    recebida, entao prazo vencido aqui e problema de hoje, e nao
     *    previsao. Sem esta regra a tela se contradizia: a linha ficava
     *    vermelha com "2 dias atrasado" e o aviso do topo dizia que nada
     *    estava em risco.
     * 3. O fornecedor prometeu para depois do que precisamos — o unico caso
     *    que e sobre o futuro, e o unico que ainda da tempo de cobrar.
     */
    static boolean emRisco(LocalDate comprarAte, LocalDate previsaoChegada, LocalDate hoje) {
        if (comprarAte == null) {
            return true;
        }
        return comprarAte.isBefore(hoje)
                || (previsaoChegada != null && previsaoChegada.isAfter(comprarAte));
    }

    /**
     * Sem prazo vem primeiro — e carro parado esperando, nao folga. Depois
     * o prazo mais apertado. Empate desempata por quem trava o inicio.
     *
     * Visivel no pacote de proposito: esta ordem e a decisao de produto da
     * fila, e {@link FilaDeComprasTest} a guarda sem precisar de banco.
     */
    static int maisUrgentePrimeiro(PecaDtos.Pendente a, PecaDtos.Pendente b) {
        if ((a.comprarAte() == null) != (b.comprarAte() == null)) {
            return a.comprarAte() == null ? -1 : 1;
        }
        if (a.comprarAte() != null && !a.comprarAte().isEqual(b.comprarAte())) {
            return a.comprarAte().compareTo(b.comprarAte());
        }
        if (a.momentoNecessario() != b.momentoNecessario()) {
            return a.momentoNecessario() == MomentoDaPeca.INICIO ? -1 : 1;
        }
        return a.descricao().compareToIgnoreCase(b.descricao());
    }

    private void recalcularValorPecas(OrdemServico os) {
        BigDecimal total = repository.findByOrdemServicoIdOrderByCriadoEm(os.getId()).stream()
                .filter(p -> p.getStatus() != StatusPeca.CANCELADA)
                .map(PecaOs::total)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        os.setValorPecas(total);
        osRepository.save(os);
    }

    private OrdemServico carregarOs(UUID osId, UUID oficinaId) {
        OrdemServico os = osRepository.buscarCompleta(osId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Ordem de servico", osId));
        if (!os.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }
        return os;
    }

    private void aplicar(PecaOs peca, PecaDtos.Requisicao req) {
        peca.setDescricao(req.descricao().trim());
        peca.setQuantidade(req.quantidade() == null ? BigDecimal.ONE : req.quantidade());
        peca.setFornecedor(req.fornecedor());
        if (req.status() != null) {
            peca.setStatus(req.status());
        }
        if (req.origem() != null) {
            peca.setOrigem(req.origem());
        }
        if (req.momentoNecessario() != null) {
            peca.setMomentoNecessario(req.momentoNecessario());
        }
        peca.setPrevisaoChegada(req.previsaoChegada());

        // Valor nulo quer dizer "nao mexe", e nao "apaga".
        //
        // A tela da fila de compras reenvia a peca sem o valor ao clicar em
        // "Comprei"/"Chegou", e este metodo apagava o preco â o valor da OS
        // encolhia a cada clique de rotina. Sumir dinheiro do orcamento por
        // apertar um botao e o tipo de defeito que ninguem liga ao botao.
        if (req.valorUnitario() != null) {
            peca.setValorUnitario(req.valorUnitario());
        }

        // Se temos a peca aqui, ela chegou: nao faz sentido ficar "solicitada",
        // e sem isto ela acenderia "esperando peca" no card do patio.
        if (peca.getOrigem() == OrigemPeca.ESTOQUE
                && (peca.getStatus() == StatusPeca.SOLICITADA
                || peca.getStatus() == StatusPeca.COMPRADA)) {
            peca.setStatus(StatusPeca.RECEBIDA);
        }
    }

    private OsDtos.PecaResposta mapear(PecaOs p) {
        return new OsDtos.PecaResposta(p.getId(), p.getDescricao(), p.getQuantidade(),
                p.getFornecedor(), p.getStatus(), p.getStatus().descricao(),
                p.getOrigem(), p.getOrigem().descricao(),
                p.getMomentoNecessario(), p.getMomentoNecessario().descricao(),
                p.getPrevisaoChegada(), p.getValorUnitario(), p.total());
    }
}
