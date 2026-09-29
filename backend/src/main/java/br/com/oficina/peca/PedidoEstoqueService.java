package br.com.oficina.peca;

import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Repor a prateleira: pedir peca sem carro.
 *
 * Servico proprio, e nao um ramo do `PecaService`, porque as duas coisas so
 * parecem iguais. A peca de carro tem dono: ela entra no estoque e sai na
 * mesma transacao, e o prazo dela vem da agenda daquele carro. A peca de
 * prateleira nao tem dono, fica quando chega, e a urgencia dela e outra —
 * saldo contra minimo, e nao data de entrega.
 */
@Service
public class PedidoEstoqueService {

    private final PedidoEstoqueRepository repository;
    private final PecaCatalogoRepository catalogoRepository;
    private final PecaCatalogoService catalogoService;
    private final Contexto contexto;

    public PedidoEstoqueService(PedidoEstoqueRepository repository,
                                PecaCatalogoRepository catalogoRepository,
                                PecaCatalogoService catalogoService,
                                Contexto contexto) {
        this.repository = repository;
        this.catalogoRepository = catalogoRepository;
        this.catalogoService = catalogoService;
        this.contexto = contexto;
    }

    @Transactional(readOnly = true)
    public List<PecaDtos.PedidoEstoqueResposta> listar() {
        contexto.exigirAtendimento("A reposição de estoque é do atendente, do gerente ou do dono.");
        return repository.pendentes(contexto.oficinaId()).stream()
                .map(this::montar)
                .toList();
    }

    @Transactional
    public PecaDtos.PedidoEstoqueResposta criar(PecaDtos.PedidoEstoqueRequisicao req) {
        contexto.exigirAtendimento("Pedir peça para a prateleira é do atendente, do gerente ou do dono.");

        PedidoEstoque pedido = new PedidoEstoque();
        pedido.setOficinaId(contexto.oficinaId());
        aplicar(pedido, req);
        return montar(repository.save(pedido));
    }

    @Transactional
    public PecaDtos.PedidoEstoqueResposta atualizar(UUID id, PecaDtos.PedidoEstoqueRequisicao req) {
        contexto.exigirAtendimento("Mexer no pedido é do atendente, do gerente ou do dono.");
        PedidoEstoque pedido = carregar(id);
        aplicar(pedido, req);
        return montar(repository.save(pedido));
    }

    /**
     * A peca chegou e **fica** na prateleira.
     *
     * A diferenca para `PecaService.receber` esta na ultima linha que nao
     * existe aqui: nao ha `baixar`. La a peca tem dono e sai no mesmo instante
     * para o carro; aqui ela veio justamente para ficar.
     */
    @Transactional
    public PecaDtos.PedidoEstoqueResposta receber(UUID id, PecaCatalogoDtos.Recebimento req) {
        contexto.exigirAtendimento("Receber peça é do atendente, do gerente ou do dono.");
        PedidoEstoque pedido = carregar(id);

        if (req.vazio()) {
            throw new RegraNegocioException(
                    "Diga qual peça chegou: escolha uma do catálogo ou cadastre agora. "
                            + "Receber sem guardar no estoque é como o saldo deixa de valer.");
        }

        PecaCatalogo doCatalogo = catalogoService.receber(req, pedido.getQuantidade());
        pedido.setPecaCatalogoId(doCatalogo.getId());
        pedido.setStatus(StatusPeca.RECEBIDA);
        if (req.valorUnitario() != null) {
            pedido.setValorUnitario(req.valorUnitario());
        }
        return montar(repository.save(pedido));
    }

    @Transactional
    public void cancelar(UUID id) {
        contexto.exigirAtendimento("Cancelar o pedido é do atendente, do gerente ou do dono.");
        PedidoEstoque pedido = carregar(id);
        pedido.setStatus(StatusPeca.CANCELADA);
        repository.save(pedido);
    }

    private PedidoEstoque carregar(UUID id) {
        PedidoEstoque pedido = repository.findById(id)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Pedido", id));
        if (!pedido.getOficinaId().equals(contexto.oficinaId())) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }
        return pedido;
    }

    private void aplicar(PedidoEstoque pedido, PecaDtos.PedidoEstoqueRequisicao req) {
        pedido.setDescricao(req.descricao().trim());
        pedido.setQuantidade(req.quantidade() == null ? BigDecimal.ONE : req.quantidade());
        pedido.setFornecedor(req.fornecedor());
        pedido.setPrevisaoChegada(req.previsaoChegada());
        pedido.setObservacao(req.observacao());
        if (req.pecaCatalogoId() != null) {
            pedido.setPecaCatalogoId(req.pecaCatalogoId());
        }
        if (req.status() != null) {
            pedido.setStatus(req.status());
        }
        // Valor nulo quer dizer "nao mexe", e nao "apaga" — o mesmo defeito de
        // dinheiro que a fila de compras ja teve uma vez.
        if (req.valorUnitario() != null) {
            pedido.setValorUnitario(req.valorUnitario());
        }
    }

    private PecaDtos.PedidoEstoqueResposta montar(PedidoEstoque p) {
        BigDecimal saldo = p.getPecaCatalogoId() == null
                ? null
                : catalogoRepository.findById(p.getPecaCatalogoId())
                        .map(PecaCatalogo::getQuantidadeEstoque)
                        .orElse(null);
        return new PecaDtos.PedidoEstoqueResposta(
                p.getId(),
                p.getPecaCatalogoId(),
                p.getDescricao(),
                p.getQuantidade(),
                p.getFornecedor(),
                p.getStatus(),
                p.getStatus().descricao(),
                p.getPrevisaoChegada(),
                p.getValorUnitario(),
                p.getObservacao(),
                saldo);
    }
}
