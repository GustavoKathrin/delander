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

    public PecaService(PecaOsRepository repository,
                       OrdemServicoRepository osRepository,
                       EventoService eventoService,
                       Contexto contexto) {
        this.repository = repository;
        this.osRepository = osRepository;
        this.eventoService = eventoService;
        this.contexto = contexto;
    }

    @Transactional
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
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = carregarOs(osId, oficinaId);
        PecaOs peca = repository.findById(pecaId)
                .filter(p -> p.getOrdemServicoId().equals(osId) && p.getOficinaId().equals(oficinaId))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Peca", pecaId));
        repository.delete(peca);
        recalcularValorPecas(os);
    }

    @Transactional(readOnly = true)
    public List<PecaDtos.Pendente> pendentes() {
        UUID oficinaId = contexto.oficinaId();
        return repository.findByOficinaIdAndStatusInOrderByPrevisaoChegada(
                        oficinaId, List.of(StatusPeca.SOLICITADA, StatusPeca.COMPRADA))
                .stream()
                .map(p -> {
                    OrdemServico os = osRepository.buscarCompleta(p.getOrdemServicoId()).orElse(null);
                    return new PecaDtos.Pendente(
                            p.getId(),
                            p.getOrdemServicoId(),
                            os == null ? 0 : os.getNumero(),
                            os == null ? "" : os.getVeiculo().getPlaca(),
                            os == null ? "" : os.getCliente().getNome(),
                            p.getDescricao(),
                            p.getQuantidade(),
                            p.getFornecedor(),
                            p.getStatus(),
                            p.getStatus().descricao(),
                            p.getPrevisaoChegada());
                })
                .toList();
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
        peca.setPrevisaoChegada(req.previsaoChegada());
        peca.setValorUnitario(req.valorUnitario());
    }

    private OsDtos.PecaResposta mapear(PecaOs p) {
        return new OsDtos.PecaResposta(p.getId(), p.getDescricao(), p.getQuantidade(),
                p.getFornecedor(), p.getStatus(), p.getStatus().descricao(),
                p.getPrevisaoChegada(), p.getValorUnitario(), p.total());
    }
}
