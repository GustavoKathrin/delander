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
 * Cotar peca: pedir preco em varios lugares e escolher um.
 *
 * O preco escolhido e COPIADO para a peca da OS -- valor e fornecedor. Nao e
 * duplicacao por descuido: o total do orcamento ja sai de peca_os e continua
 * saindo de la, entao somar cotacao em outro lugar criaria duas verdades
 * sobre quanto custa o mesmo carro. Aqui mora o historico; na peca, a
 * decisao.
 *
 * Quem cota e o balcao, nao o mecanico. Isso nao e detalhe de permissao: o
 * mecanico nem ve valor na tela dele, e pedir que ele chute um preco para
 * depois alguem corrigir seria pedir trabalho que vai ser jogado fora.
 */
@Service
public class CotacaoService {

    private final CotacaoPecaRepository repository;
    private final PecaOsRepository pecaRepository;
    private final Contexto contexto;

    public CotacaoService(CotacaoPecaRepository repository,
                          PecaOsRepository pecaRepository,
                          Contexto contexto) {
        this.repository = repository;
        this.pecaRepository = pecaRepository;
        this.contexto = contexto;
    }

    @Transactional(readOnly = true)
    public List<PecaDtos.CotacaoResposta> daPeca(UUID pecaId) {
        contexto.exigirAtendimento();
        exigirPeca(pecaId);
        return repository.findByPecaOsId(pecaId).stream()
                .sorted((a, b) -> a.getValorUnitario().compareTo(b.getValorUnitario()))
                .map(PecaDtos.CotacaoResposta::de)
                .toList();
    }

    @Transactional
    public PecaDtos.CotacaoResposta registrar(UUID pecaId, PecaDtos.CotacaoRequisicao req) {
        contexto.exigirAtendimento();
        PecaOs peca = exigirPeca(pecaId);

        if (req.valorUnitario() == null || req.valorUnitario().signum() < 0) {
            throw new RegraNegocioException("Informe quanto o fornecedor cobrou.");
        }

        CotacaoPeca c = new CotacaoPeca();
        c.setOficinaId(contexto.oficinaId());
        c.setPecaOsId(peca.getId());
        c.setFornecedorId(req.fornecedorId());
        c.setFornecedorNome(req.fornecedorNome().trim());
        c.setValorUnitario(req.valorUnitario());
        c.setPrazoDias(req.prazoDias());
        c.setObservacao(req.observacao() == null || req.observacao().isBlank()
                ? null : req.observacao().trim());

        /*
         * A primeira cotacao ja nasce escolhida.
         *
         * Quem cota um lugar so -- que e o caso comum -- nao deveria precisar
         * de um segundo clique para dizer "e esse mesmo". Quando chega a
         * segunda, a pessoa escolhe de verdade.
         */
        boolean primeira = repository.findByPecaOsId(peca.getId()).isEmpty();
        c.setEscolhida(primeira);
        CotacaoPeca salva = repository.save(c);

        if (primeira) {
            aplicarNaPeca(peca, salva);
        }
        return PecaDtos.CotacaoResposta.de(salva);
    }

    @Transactional
    public PecaDtos.CotacaoResposta escolher(UUID cotacaoId) {
        contexto.exigirAtendimento();
        CotacaoPeca escolhida = repository.findById(cotacaoId)
                .filter(x -> x.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Cotacao", cotacaoId));

        PecaOs peca = exigirPeca(escolhida.getPecaOsId());

        // Desmarca as outras ANTES de marcar esta: o indice unico do banco so
        // aceita uma escolhida por peca, e marcar antes de limpar estoura.
        for (CotacaoPeca outra : repository.findByPecaOsId(peca.getId())) {
            if (outra.isEscolhida() && !outra.getId().equals(cotacaoId)) {
                outra.setEscolhida(false);
                repository.save(outra);
            }
        }
        repository.flush();

        escolhida.setEscolhida(true);
        CotacaoPeca salva = repository.save(escolhida);
        aplicarNaPeca(peca, salva);
        return PecaDtos.CotacaoResposta.de(salva);
    }

    @Transactional
    public void apagar(UUID cotacaoId) {
        contexto.exigirAtendimento();
        CotacaoPeca c = repository.findById(cotacaoId)
                .filter(x -> x.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Cotacao", cotacaoId));
        if (c.isEscolhida()) {
            throw new RegraNegocioException(
                    "Esta é a cotação escolhida e é dela que sai o valor do orçamento. "
                            + "Escolha outra antes de apagar esta.");
        }
        repository.delete(c);
    }

    /** Copia preco e fornecedor para a peca, que e de onde o orcamento soma. */
    private void aplicarNaPeca(PecaOs peca, CotacaoPeca c) {
        peca.setValorUnitario(c.getValorUnitario());
        peca.setFornecedor(c.getFornecedorNome());
        pecaRepository.save(peca);
    }

    private PecaOs exigirPeca(UUID pecaId) {
        return pecaRepository.findById(pecaId)
                .filter(p -> p.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Peca", pecaId));
    }

    /** Soma do que foi escolhido, para a tela mostrar o total da cotacao. */
    public static BigDecimal total(List<PecaDtos.CotacaoResposta> cotacoes) {
        return cotacoes.stream()
                .filter(PecaDtos.CotacaoResposta::escolhida)
                .map(PecaDtos.CotacaoResposta::valorUnitario)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
