package br.com.oficina.wiki;

import br.com.oficina.arquivo.ArmazenamentoArquivos;
import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.veiculo.Veiculo;
import br.com.oficina.veiculo.VeiculoRepository;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * A wiki da oficina: o livro da empresa.
 *
 * O artigo e amarrado ao MODELO, nao ao carro — e isso que faz a solucao de um
 * Civic 2014 aparecer para o proximo Civic 2014 que entrar. Carro, OS e
 * leitura ficam como procedencia, para voltar ao caso concreto.
 */
@Service
public class WikiService {

    private static final int TAMANHO_PREVIA = 180;

    private final WikiArtigoRepository repository;
    private final WikiArquivoRepository arquivoRepository;
    private final VeiculoRepository veiculoRepository;
    private final ArmazenamentoArquivos armazenamento;
    private final Contexto contexto;

    public WikiService(WikiArtigoRepository repository,
                       WikiArquivoRepository arquivoRepository,
                       VeiculoRepository veiculoRepository,
                       ArmazenamentoArquivos armazenamento,
                       Contexto contexto) {
        this.repository = repository;
        this.arquivoRepository = arquivoRepository;
        this.veiculoRepository = veiculoRepository;
        this.armazenamento = armazenamento;
        this.contexto = contexto;
    }

    // ============================================================ escrita

    @Transactional
    public WikiDtos.Detalhe criar(WikiDtos.Requisicao req) {
        WikiArtigo artigo = new WikiArtigo();
        artigo.setOficinaId(contexto.oficinaId());
        aplicar(artigo, req);
        WikiArtigo salvo = repository.save(artigo);
        vincularFotos(req.arquivos(), salvo.getId());
        return detalhe(salvo.getId());
    }

    @Transactional
    public WikiDtos.Detalhe atualizar(UUID id, WikiDtos.Requisicao req) {
        WikiArtigo artigo = buscar(id);
        aplicar(artigo, req);
        repository.save(artigo);
        vincularFotos(req.arquivos(), id);
        return detalhe(id);
    }

    @Transactional
    public void remover(UUID id) {
        contexto.exigirGerencia();
        WikiArtigo artigo = buscar(id);
        arquivoRepository.findByWikiArtigoIdOrderByOrdem(id)
                .forEach(a -> armazenamento.apagar(a.getCaminho()));
        repository.delete(artigo);
    }

    /** Foto enviada antes de o artigo existir; vincula no salvar. */
    @Transactional
    public WikiDtos.FotoEnviada enviarFoto(MultipartFile arquivo, UUID artigoId) {
        UUID oficinaId = contexto.oficinaId();
        if (artigoId != null) {
            buscar(artigoId);
        }

        ArmazenamentoArquivos.Guardado guardado = armazenamento.guardar(arquivo, "wiki");
        if (guardado.contentType() != null && !guardado.contentType().startsWith("image/")) {
            armazenamento.apagar(guardado.caminhoRelativo());
            throw new RegraNegocioException("Envie uma imagem (JPG, PNG ou WEBP).");
        }

        WikiArquivo foto = new WikiArquivo();
        foto.setOficinaId(oficinaId);
        foto.setWikiArtigoId(artigoId);
        foto.setNomeOriginal(guardado.nomeOriginal());
        foto.setCaminho(guardado.caminhoRelativo());
        foto.setContentType(guardado.contentType());
        foto.setTamanho(guardado.tamanho());
        foto.setCriadoPor(contexto.usuario().email());
        if (artigoId != null) {
            foto.setOrdem(arquivoRepository.findByWikiArtigoIdOrderByOrdem(artigoId).size());
        }
        WikiArquivo salvo = arquivoRepository.save(foto);

        return new WikiDtos.FotoEnviada(salvo.getId(), "/api/wiki/fotos/" + salvo.getId());
    }

    @Transactional
    public void removerFoto(UUID fotoId) {
        WikiArquivo foto = arquivoRepository.findByIdAndOficinaId(fotoId, contexto.oficinaId())
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Foto", fotoId));
        armazenamento.apagar(foto.getCaminho());
        arquivoRepository.delete(foto);
    }

    // ============================================================ consulta

    @Transactional(readOnly = true)
    public Page<WikiDtos.Resumo> listar(String busca, Pageable paginacao) {
        return repository.buscar(contexto.oficinaId(), busca, paginacao).map(this::resumo);
    }

    /** Artigos que servem para aquele carro — casando ano por faixa. */
    @Transactional(readOnly = true)
    public List<WikiDtos.Resumo> paraOVeiculo(UUID veiculoId) {
        UUID oficinaId = contexto.oficinaId();
        Veiculo veiculo = veiculoRepository.findById(veiculoId)
                .filter(v -> v.getOficinaId().equals(oficinaId))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Veiculo", veiculoId));

        return repository.paraOModelo(oficinaId, veiculo.getMarca(), veiculo.getModelo(), veiculo.getAno())
                .stream().map(this::resumo).toList();
    }

    @Transactional(readOnly = true)
    public WikiDtos.Detalhe detalhe(UUID id) {
        WikiArtigo artigo = buscar(id);
        return new WikiDtos.Detalhe(
                resumo(artigo),
                artigo.getCorpo(),
                artigo.getVeiculoId(),
                artigo.getOrdemServicoId(),
                artigo.getLeituraId(),
                arquivoRepository.findByWikiArtigoIdOrderByOrdem(id).stream()
                        .map(f -> new WikiDtos.FotoResposta(
                                f.getId(), "/api/wiki/fotos/" + f.getId(), f.getLegenda(), f.getOrdem()))
                        .toList());
    }

    @Transactional(readOnly = true)
    public Resource foto(UUID fotoId) {
        WikiArquivo foto = arquivoRepository.findByIdAndOficinaId(fotoId, contexto.oficinaId())
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Foto", fotoId));
        return armazenamento.conteudo(foto.getCaminho());
    }

    @Transactional(readOnly = true)
    public String tipoDaFoto(UUID fotoId) {
        return arquivoRepository.findByIdAndOficinaId(fotoId, contexto.oficinaId())
                .map(WikiArquivo::getContentType)
                .orElse("application/octet-stream");
    }

    // ============================================================ apoio

    private void aplicar(WikiArtigo artigo, WikiDtos.Requisicao req) {
        if (req.anoDe() != null && req.anoAte() != null && req.anoDe() > req.anoAte()) {
            throw new RegraNegocioException("O ano inicial nao pode ser maior que o final.");
        }
        artigo.setTitulo(req.titulo().strip());
        artigo.setCorpo(req.corpo());
        artigo.setMarca(vazioParaNulo(req.marca()));
        artigo.setModelo(vazioParaNulo(req.modelo()));
        artigo.setMotor(vazioParaNulo(req.motor()));
        artigo.setAnoDe(req.anoDe());
        artigo.setAnoAte(req.anoAte());
        artigo.setTags(req.tags() == null ? List.of() : req.tags().stream()
                .map(String::strip).filter(t -> !t.isEmpty()).distinct().toList());
        artigo.setVeiculoId(req.veiculoId());
        artigo.setOrdemServicoId(req.ordemServicoId());
        artigo.setLeituraId(req.leituraId());
        artigo.setPublicado(req.publicado() == null || req.publicado());
    }

    private void vincularFotos(List<UUID> fotos, UUID artigoId) {
        if (fotos == null || fotos.isEmpty()) {
            return;
        }
        UUID oficinaId = contexto.oficinaId();
        int ordem = 0;
        for (UUID fotoId : fotos) {
            WikiArquivo foto = arquivoRepository.findByIdAndOficinaId(fotoId, oficinaId)
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Foto", fotoId));
            foto.setWikiArtigoId(artigoId);
            foto.setOrdem(ordem++);
            arquivoRepository.save(foto);
        }
    }

    private WikiArtigo buscar(UUID id) {
        WikiArtigo artigo = repository.findById(id)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Artigo", id));
        if (!artigo.getOficinaId().equals(contexto.oficinaId())) {
            throw RecursoNaoEncontradoException.de("Artigo", id);
        }
        return artigo;
    }

    private WikiDtos.Resumo resumo(WikiArtigo a) {
        String corpo = a.getCorpo() == null ? "" : a.getCorpo().strip();
        String previa = corpo.length() > TAMANHO_PREVIA
                ? corpo.substring(0, TAMANHO_PREVIA) + "..."
                : corpo;

        return new WikiDtos.Resumo(
                a.getId(), a.getTitulo(), a.alcance(),
                a.getMarca(), a.getModelo(), a.getMotor(), a.getAnoDe(), a.getAnoAte(),
                a.getTags(), a.isPublicado(), a.getCriadoPor(),
                a.getCriadoEm() == null ? null : a.getCriadoEm().atOffset(java.time.ZoneOffset.UTC),
                a.getAtualizadoEm() == null ? null : a.getAtualizadoEm().atOffset(java.time.ZoneOffset.UTC),
                arquivoRepository.findByWikiArtigoIdOrderByOrdem(a.getId()).size(),
                previa.replaceAll("\\s+", " "));
    }

    private static String vazioParaNulo(String valor) {
        return valor == null || valor.isBlank() ? null : valor.strip();
    }
}
