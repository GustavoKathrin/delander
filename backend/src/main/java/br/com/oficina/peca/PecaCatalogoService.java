package br.com.oficina.peca;

import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * O catalogo de pecas e o saldo da prateleira.
 *
 * O saldo so muda por dois caminhos, e os dois sao consequencia de algo que
 * aconteceu no carro — nunca de alguem "ajustando o estoque":
 *
 * - **entra** quando uma peca comprada chega (PecaService, ao receber);
 * - **sai** quando uma peca do catalogo vai para uma OS.
 *
 * Editar a quantidade a mao existe no cadastro, para o dia em que a oficina
 * conta a prateleira e acerta o que o sistema errou. Fora isso, mexer no
 * numero direto e o jeito mais rapido de o saldo virar ficcao.
 */
@Service
public class PecaCatalogoService {

    private final PecaCatalogoRepository repository;
    private final Contexto contexto;

    public PecaCatalogoService(PecaCatalogoRepository repository, Contexto contexto) {
        this.repository = repository;
        this.contexto = contexto;
    }

    @Transactional(readOnly = true)
    public List<PecaCatalogoDtos.Resposta> listar(boolean apenasAtivas) {
        UUID oficinaId = contexto.oficinaId();
        List<PecaCatalogo> pecas = apenasAtivas
                ? repository.listarAtivas(oficinaId)
                : repository.listar(oficinaId);
        return pecas.stream().map(PecaCatalogoDtos.Resposta::de).toList();
    }

    /**
     * Busca enquanto digita. Abaixo de dois caracteres devolve vazio: com uma
     * letra so, a lista inteira aparece e nao ajuda ninguem a escolher.
     */
    @Transactional(readOnly = true)
    public List<PecaCatalogoDtos.Resposta> autocompletar(String termo) {
        if (termo == null || termo.trim().length() < 2) {
            return List.of();
        }
        return repository
                .autocompletar(contexto.oficinaId(), termo.trim(), PageRequest.of(0, 10))
                .stream()
                .map(PecaCatalogoDtos.Resposta::de)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PecaCatalogoDtos.Resposta> noMinimo() {
        contexto.exigirAtendimento("O estoque e do atendente, do gerente ou do dono.");
        return repository.noMinimo(contexto.oficinaId()).stream()
                .map(PecaCatalogoDtos.Resposta::de)
                .toList();
    }

    @Transactional
    public PecaCatalogoDtos.Resposta criar(PecaCatalogoDtos.Requisicao req) {
        contexto.exigirAtendimento("Cadastrar peca e do atendente, do gerente ou do dono.");
        PecaCatalogo peca = new PecaCatalogo();
        peca.setOficinaId(contexto.oficinaId());
        aplicar(peca, req);
        return PecaCatalogoDtos.Resposta.de(repository.save(peca));
    }

    @Transactional
    public PecaCatalogoDtos.Resposta atualizar(UUID id, PecaCatalogoDtos.Requisicao req) {
        contexto.exigirAtendimento("Editar peca e do atendente, do gerente ou do dono.");
        PecaCatalogo peca = carregar(id);
        aplicar(peca, req);
        return PecaCatalogoDtos.Resposta.de(repository.save(peca));
    }

    /**
     * Guarda no estoque o que chegou. Chamado quando uma compra e recebida.
     *
     * Devolve a peca do catalogo para quem chamou amarrar na linha da OS: e
     * esse vinculo que faz a proxima vez ser so escolher da lista.
     */
    @Transactional
    public PecaCatalogo receber(PecaCatalogoDtos.Recebimento req, BigDecimal quantidade) {
        UUID oficinaId = contexto.oficinaId();

        PecaCatalogo peca;
        if (req.catalogoId() != null) {
            peca = carregar(req.catalogoId());
        } else {
            // Codigo repetido nao cria peca nova: seria a mesma peca com dois
            // saldos, e a partir dai nenhum dos dois esta certo.
            peca = (req.codigo() != null && !req.codigo().isBlank()
                    ? repository.findByOficinaIdAndCodigoIgnoreCase(oficinaId, req.codigo().trim())
                    : java.util.Optional.<PecaCatalogo>empty())
                    .orElseGet(PecaCatalogo::new);
            if (peca.getOficinaId() == null) {
                peca.setOficinaId(oficinaId);
                peca.setDescricao(req.novaDescricao().trim());
                peca.setCodigo(req.codigo() == null || req.codigo().isBlank()
                        ? null : req.codigo().trim());
            }
        }

        if (req.valorUnitario() != null) {
            peca.setValorSugerido(req.valorUnitario());
        }
        peca.setQuantidadeEstoque(peca.getQuantidadeEstoque().add(quantidade));
        return repository.save(peca);
    }

    /**
     * Tira da prateleira o que foi para o carro.
     *
     * Nao deixa negativar: o banco tem um check, mas falhar aqui com uma frase
     * em portugues e melhor do que devolver violacao de constraint. Quando o
     * saldo nao cobre, guarda zero — a peca saiu de verdade, e o numero errado
     * era o de antes.
     */
    @Transactional
    public void baixar(UUID catalogoId, BigDecimal quantidade) {
        PecaCatalogo peca = repository.findById(catalogoId).orElse(null);
        if (peca == null || quantidade == null || quantidade.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        BigDecimal novo = peca.getQuantidadeEstoque().subtract(quantidade);
        peca.setQuantidadeEstoque(novo.max(BigDecimal.ZERO));
        repository.save(peca);
    }

    /** Devolve para a prateleira o que nao foi usado (peca cancelada/removida). */
    @Transactional
    public void devolver(UUID catalogoId, BigDecimal quantidade) {
        PecaCatalogo peca = repository.findById(catalogoId).orElse(null);
        if (peca == null || quantidade == null || quantidade.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        peca.setQuantidadeEstoque(peca.getQuantidadeEstoque().add(quantidade));
        repository.save(peca);
    }

    private PecaCatalogo carregar(UUID id) {
        PecaCatalogo peca = repository.findById(id)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Peca", id));
        if (!peca.getOficinaId().equals(contexto.oficinaId())) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }
        return peca;
    }

    private void aplicar(PecaCatalogo peca, PecaCatalogoDtos.Requisicao req) {
        peca.setDescricao(req.descricao().trim());
        peca.setCodigo(req.codigo() == null || req.codigo().isBlank() ? null : req.codigo().trim());
        peca.setFabricante(req.fabricante());
        peca.setValorSugerido(req.valorSugerido());
        if (req.quantidadeEstoque() != null) {
            peca.setQuantidadeEstoque(req.quantidadeEstoque());
        }
        if (req.estoqueMinimo() != null) {
            peca.setEstoqueMinimo(req.estoqueMinimo());
        }
        if (req.ativo() != null) {
            peca.setAtivo(req.ativo());
        }
    }
}
