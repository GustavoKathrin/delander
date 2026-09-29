package br.com.oficina.arquivo;

import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.ordemservico.EventoService;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Fotos e documentos da OS.
 *
 * As regras de disco (tipo pelos bytes iniciais, nome gerado pelo servidor,
 * limite de tamanho, caminho preso na raiz de uploads) moram em
 * {@link ArmazenamentoArquivos}, porque as leituras do scanner precisam das
 * mesmas. A API publica deste servico nao mudou.
 */
@Service
public class ArquivoService {

    private static final Logger log = LoggerFactory.getLogger(ArquivoService.class);

    private final ArquivoOsRepository repository;
    private final OrdemServicoRepository osRepository;
    private final EventoService eventoService;
    private final ArmazenamentoArquivos armazenamento;
    private final Contexto contexto;

    public ArquivoService(ArquivoOsRepository repository,
                          OrdemServicoRepository osRepository,
                          EventoService eventoService,
                          ArmazenamentoArquivos armazenamento,
                          Contexto contexto) {
        this.repository = repository;
        this.osRepository = osRepository;
        this.eventoService = eventoService;
        this.armazenamento = armazenamento;
        this.contexto = contexto;
    }

    @Transactional
    public ArquivoOs salvar(UUID osId, MultipartFile arquivo, String momento, boolean visivelCliente) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = osRepository.buscarCompleta(osId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Ordem de servico", osId));
        if (!os.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }

        String momentoValidado = List.of("ENTRADA", "EXECUCAO", "SAIDA").contains(momento)
                ? momento : "EXECUCAO";

        // A subpasta continua sendo o id da OS: os caminhos ja gravados no
        // banco precisam continuar resolvendo.
        ArmazenamentoArquivos.Guardado guardado = armazenamento.guardar(arquivo, osId.toString());

        ArquivoOs registro = new ArquivoOs();
        registro.setOficinaId(oficinaId);
        registro.setOrdemServicoId(osId);
        registro.setNomeOriginal(guardado.nomeOriginal());
        registro.setCaminho(guardado.caminhoRelativo());
        registro.setContentType(guardado.contentType());
        registro.setTamanho(guardado.tamanho());
        registro.setMomento(momentoValidado);
        registro.setVisivelCliente(visivelCliente);
        registro.setCriadoEm(OffsetDateTime.now());
        registro.setCriadoPor(contexto.usuario().email());
        ArquivoOs salvo = repository.save(registro);

        if ("ENTRADA".equals(momentoValidado)) {
            apagarEntradasAntigas(os);
        }

        eventoService.registrar(oficinaId, osId, EventoService.FOTO_ANEXADA,
                "Arquivo anexado: " + salvo.getNomeOriginal(), visivelCliente);

        return salvo;
    }

    /**
     * Cada carro guarda uma foto de entrada so: a de agora.
     *
     * Decisao da oficina, e ela tem duas razoes. A primeira e disco: foto de
     * entrada de todo carro em toda passagem cresce sem parar e ninguem volta
     * para limpar. A segunda e mais importante: a foto da visita passada nao
     * prova o estado de hoje. Guardada, ela viraria prova contra a propria
     * oficina numa discussao sobre um risco que apareceu depois.
     *
     * Apaga do disco e do banco. Silencioso de proposito: falhar aqui
     * derrubaria o upload que acabou de dar certo, e o que importa — a foto
     * de hoje — ja esta gravada.
     */
    private void apagarEntradasAntigas(OrdemServico os) {
        List<ArquivoOs> antigas =
                repository.entradasDeOutrasPassagens(os.getVeiculo().getId(), os.getId());
        if (antigas.isEmpty()) {
            return;
        }
        for (ArquivoOs antiga : antigas) {
            try {
                armazenamento.apagar(antiga.getCaminho());
            } catch (RuntimeException e) {
                log.warn("Nao foi possivel apagar a foto de entrada {}: {}",
                        antiga.getCaminho(), e.getMessage());
            }
        }
        repository.deleteAll(antigas);
        log.info("Foto de entrada do veiculo {} substituida ({} arquivo(s) antigo(s) removido(s)).",
                os.getVeiculo().getPlaca(), antigas.size());
    }

    @Transactional(readOnly = true)
    public ArquivoOs metadados(UUID osId, UUID arquivoId) {
        ArquivoOs arquivo = repository.findById(arquivoId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Arquivo", arquivoId));
        if (!arquivo.getOrdemServicoId().equals(osId)
                || !arquivo.getOficinaId().equals(contexto.oficinaId())) {
            throw RecursoNaoEncontradoException.de("Arquivo", arquivoId);
        }
        return arquivo;
    }

    /** Usado pela pagina publica: valida se a foto foi liberada para o cliente. */
    @Transactional(readOnly = true)
    public ArquivoOs metadadosPublicos(UUID osId, UUID arquivoId) {
        ArquivoOs arquivo = repository.findById(arquivoId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Arquivo", arquivoId));
        if (!arquivo.getOrdemServicoId().equals(osId) || !arquivo.isVisivelCliente()) {
            throw RecursoNaoEncontradoException.de("Arquivo", arquivoId);
        }
        return arquivo;
    }

    public Resource conteudo(ArquivoOs arquivo) {
        return armazenamento.conteudo(arquivo.getCaminho());
    }
}
