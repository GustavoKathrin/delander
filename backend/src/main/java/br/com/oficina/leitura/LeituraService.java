package br.com.oficina.leitura;

import br.com.oficina.arquivo.ArmazenamentoArquivos;
import br.com.oficina.arquivo.ArquivoLeitura;
import br.com.oficina.arquivo.ArquivoLeituraRepository;
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

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * As leituras do scanner.
 *
 * Regra central do fluxo: importar NAO grava leitura. O PDF e guardado, o
 * texto vira rascunho, e a leitura so nasce quando alguem confere na tela e
 * informa o que o PDF nao diz — motor ligado, ignicao, e se aquela e a leitura
 * boa do carro ou uma anomalia com nome ("carro com problema no frio").
 */
@Service
public class LeituraService {

    private final LeituraRepository repository;
    private final VeiculoRepository veiculoRepository;
    private final ArquivoLeituraRepository arquivoRepository;
    private final ArmazenamentoArquivos armazenamento;
    private final LeitorPdfAutel leitor;
    private final AnalisadorRelatorioAutel analisador;
    private final Contexto contexto;

    public LeituraService(LeituraRepository repository,
                          VeiculoRepository veiculoRepository,
                          ArquivoLeituraRepository arquivoRepository,
                          ArmazenamentoArquivos armazenamento,
                          LeitorPdfAutel leitor,
                          AnalisadorRelatorioAutel analisador,
                          Contexto contexto) {
        this.repository = repository;
        this.veiculoRepository = veiculoRepository;
        this.arquivoRepository = arquivoRepository;
        this.armazenamento = armazenamento;
        this.leitor = leitor;
        this.analisador = analisador;
        this.contexto = contexto;
    }

    // ============================================================ importacao

    /**
     * PDF -> rascunho na tela. Guarda so o arquivo; nenhuma linha de leitura
     * e criada aqui.
     */
    @Transactional
    public LeituraDtos.Previa importar(MultipartFile arquivo) {
        UUID oficinaId = contexto.oficinaId();

        byte[] conteudo;
        try {
            conteudo = arquivo == null ? null : arquivo.getBytes();
        } catch (IOException e) {
            throw new RegraNegocioException("Nao foi possivel ler o arquivo enviado.");
        }

        RelatorioScanner.Previa previa = analisador.analisar(leitor.extrairTexto(conteudo));

        ArmazenamentoArquivos.Guardado guardado = armazenamento.guardarPdf(arquivo, "leituras");
        ArquivoLeitura registro = new ArquivoLeitura();
        registro.setOficinaId(oficinaId);
        registro.setNomeOriginal(guardado.nomeOriginal());
        registro.setCaminho(guardado.caminhoRelativo());
        registro.setContentType(guardado.contentType());
        registro.setTamanho(guardado.tamanho());
        registro.setCriadoPor(contexto.usuario().email());
        ArquivoLeitura salvo = arquivoRepository.save(registro);

        List<String> avisos = new ArrayList<>(previa.avisos());

        // Placa do relatorio e sugestao: pode vir em formato de outro pais.
        Veiculo sugerido = null;
        if (previa.cabecalho().placaSugerida() != null) {
            sugerido = veiculoRepository
                    .findByOficinaIdAndPlaca(oficinaId,
                            Veiculo.normalizarPlaca(previa.cabecalho().placaSugerida()))
                    .orElse(null);
            if (sugerido == null) {
                avisos.add("A placa %s nao esta cadastrada. Escolha o carro na lista."
                        .formatted(previa.cabecalho().placaSugerida()));
            }
        }

        if (previa.cabecalho().numeroRelatorio() != null) {
            repository.findByOficinaIdAndNumeroRelatorio(oficinaId, previa.cabecalho().numeroRelatorio())
                    .ifPresent(ja -> avisos.add(
                            "Este relatorio ja foi importado em %s.".formatted(ja.getCriadoEm())));
        }

        return new LeituraDtos.Previa(
                salvo.getId(),
                previa.cabecalho().marca(),
                previa.cabecalho().modelo(),
                previa.cabecalho().ano(),
                previa.cabecalho().km(),
                previa.cabecalho().placaSugerida(),
                sugerido == null ? null : sugerido.getId(),
                sugerido == null ? null : sugerido.descricaoCurta(),
                previa.cabecalho().ferramenta(),
                previa.cabecalho().ferramentaVersao(),
                previa.cabecalho().numeroRelatorio(),
                previa.cabecalho().momentoTeste(),
                previa.modulos().stream().map(this::paraModuloResposta).toList(),
                avisos);
    }

    /**
     * Entrada automatica: o PDF chegou por e-mail e ninguem conferiu ainda.
     *
     * Nasce PENDENTE, sem carro. Motor ligado/desligado, ignicao e se aquela
     * e a leitura boa do carro nao estao no PDF — chutar esses campos
     * envenenaria justamente o dado que a ferramenta existe para guardar.
     * Fica na lista com "Falta completar" ate alguem dizer.
     *
     * Sem Contexto: quem chama e um job, nao uma requisicao com usuario.
     */
    @Transactional
    public UUID registrarPendente(UUID oficinaId,
                                  RelatorioScanner.Previa previa,
                                  byte[] pdf,
                                  String nomeArquivo,
                                  String remetente) {
        String numero = previa.cabecalho().numeroRelatorio();
        if (numero != null && !numero.isBlank()
                && repository.findByOficinaIdAndNumeroRelatorio(oficinaId, numero).isPresent()) {
            return null;
        }

        ArmazenamentoArquivos.Guardado guardado = armazenamento.guardarPdf(pdf, nomeArquivo, "leituras");
        ArquivoLeitura registro = new ArquivoLeitura();
        registro.setOficinaId(oficinaId);
        registro.setNomeOriginal(guardado.nomeOriginal());
        registro.setCaminho(guardado.caminhoRelativo());
        registro.setContentType(guardado.contentType());
        registro.setTamanho(guardado.tamanho());
        registro.setCriadoPor(remetente);
        ArquivoLeitura arquivo = arquivoRepository.save(registro);

        Leitura leitura = new Leitura();
        leitura.setOficinaId(oficinaId);
        leitura.setMarca(previa.cabecalho().marca());
        leitura.setModelo(previa.cabecalho().modelo());
        leitura.setAno(previa.cabecalho().ano());
        leitura.setKm(previa.cabecalho().km());
        leitura.setTipo(TipoLeitura.ANOMALIA);
        leitura.setOrigem(OrigemLeitura.EMAIL);
        leitura.setSituacao(SituacaoLeitura.PENDENTE);
        leitura.setFerramenta(previa.cabecalho().ferramenta());
        leitura.setFerramentaVersao(previa.cabecalho().ferramentaVersao());
        leitura.setNumeroRelatorio(numero);
        leitura.setMomentoTeste(previa.cabecalho().momentoTeste() != null
                ? previa.cabecalho().momentoTeste()
                : OffsetDateTime.now());
        // De onde veio fica escrito na descricao: criado_por e preenchido pelo
        // auditing com "sistema", que e verdade mas nao diz quem mandou.
        leitura.setDescricao("Recebida por e-mail de " + remetente + ".");

        for (RelatorioScanner.Modulo m : previa.modulos()) {
            leitura.adicionarModulo(montarModuloDoRelatorio(m));
        }

        Leitura salva = repository.save(leitura);
        arquivo.setLeituraId(salva.getId());
        arquivoRepository.save(arquivo);
        return salva.getId();
    }

    // ============================================================ gravacao

    @Transactional
    public LeituraDtos.Detalhe criar(LeituraDtos.Requisicao req) {
        UUID oficinaId = contexto.oficinaId();

        if (req.anexarEm() != null) {
            return anexarModulos(req);
        }

        Veiculo veiculo = exigirVeiculo(req.veiculoId(), oficinaId);
        TipoLeitura tipo = req.tipo() == null ? TipoLeitura.ANOMALIA : req.tipo();
        validarCondicao(tipo, req.condicao());
        exigirModulos(req.modulos());
        exigirRelatorioInedito(oficinaId, req.numeroRelatorio(), null);

        Leitura leitura = new Leitura();
        leitura.setOficinaId(oficinaId);
        leitura.setVeiculo(veiculo);
        aplicar(leitura, req, veiculo, tipo);

        for (LeituraDtos.ModuloRequisicao m : req.modulos()) {
            leitura.adicionarModulo(montarModulo(m));
        }

        // Promover ja na criacao: "esta e a leitura boa agora" e o que o
        // usuario quis dizer, e o indice unico recusaria duas oficiais.
        if (tipo == TipoLeitura.OFICIAL) {
            repository.rebaixarOficiais(veiculo.getId(), leitura.getId());
        }

        Leitura salva = repository.save(leitura);
        vincularArquivo(req.arquivoId(), salva, oficinaId);
        return detalhe(salva.getId());
    }

    /** Segundo PDF do mesmo carro: empilha modulos na leitura que ja existe. */
    private LeituraDtos.Detalhe anexarModulos(LeituraDtos.Requisicao req) {
        UUID oficinaId = contexto.oficinaId();
        Leitura leitura = buscar(req.anexarEm(), oficinaId);
        exigirModulos(req.modulos());
        exigirRelatorioInedito(oficinaId, req.numeroRelatorio(), leitura.getId());

        for (LeituraDtos.ModuloRequisicao m : req.modulos()) {
            leitura.adicionarModulo(montarModulo(m));
        }
        repository.save(leitura);
        vincularArquivo(req.arquivoId(), leitura, oficinaId);
        return detalhe(leitura.getId());
    }

    /**
     * Fecha uma leitura que entrou sozinha: alguem diz o carro, o motor e se
     * e a leitura boa ou uma anomalia com nome.
     *
     * Os modulos nao sao tocados — eles vieram do PDF e ja estao gravados.
     * A origem tambem fica: a leitura continua sendo uma que chegou por
     * e-mail, e esconder isso apagaria o rastro.
     */
    @Transactional
    public LeituraDtos.Detalhe completar(UUID id, LeituraDtos.Requisicao req) {
        UUID oficinaId = contexto.oficinaId();
        Leitura leitura = buscar(id, oficinaId);

        if (leitura.getSituacao() != SituacaoLeitura.PENDENTE) {
            throw new RegraNegocioException("Esta leitura ja foi completada.");
        }

        Veiculo veiculo = exigirVeiculo(req.veiculoId(), oficinaId);
        TipoLeitura tipo = req.tipo() == null ? TipoLeitura.ANOMALIA : req.tipo();
        validarCondicao(tipo, req.condicao());

        leitura.setVeiculo(veiculo);
        leitura.setMarca(preferir(req.marca(), preferir(leitura.getMarca(), veiculo.getMarca())));
        leitura.setModelo(preferir(req.modelo(), preferir(leitura.getModelo(), veiculo.getModelo())));
        leitura.setAno(req.ano() != null ? req.ano()
                : leitura.getAno() != null ? leitura.getAno() : veiculo.getAno());
        leitura.setMotor(preferir(req.motor(), preferir(leitura.getMotor(), veiculo.getMotor())));
        leitura.setTipo(tipo);
        leitura.setCondicao(tipo == TipoLeitura.ANOMALIA ? req.condicao() : null);
        if (req.descricao() != null && !req.descricao().isBlank()) {
            leitura.setDescricao(req.descricao());
        }
        leitura.setMotorLigado(Boolean.TRUE.equals(req.motorLigado()));
        leitura.setIgnicaoLigada(req.ignicaoLigada() == null || req.ignicaoLigada());
        if (req.km() != null) {
            leitura.setKm(req.km());
        }
        leitura.setOrdemServicoId(req.ordemServicoId());
        leitura.setSituacao(SituacaoLeitura.COMPLETA);

        // Rebaixa a oficial anterior antes de promover: o indice unico
        // parcial e conferido por linha e recusaria duas ao mesmo tempo.
        if (tipo == TipoLeitura.OFICIAL) {
            repository.rebaixarOficiais(veiculo.getId(), leitura.getId());
        }

        repository.save(leitura);
        return detalhe(id);
    }

    @Transactional
    public LeituraDtos.Detalhe oficializar(UUID id) {
        UUID oficinaId = contexto.oficinaId();
        Leitura leitura = buscar(id, oficinaId);
        if (leitura.getVeiculo() == null) {
            throw new RegraNegocioException("Escolha o carro antes de marcar a leitura como oficial.");
        }
        if (leitura.oficial()) {
            return detalhe(id);
        }
        // Rebaixa a atual antes de promover: o indice unico parcial e
        // conferido por linha, entao trocar as duas de uma vez tropecaria.
        repository.rebaixarOficiais(leitura.getVeiculo().getId(), leitura.getId());

        // A condicao era da anomalia ("carro com problema no frio"). Numa
        // leitura oficial ela se contradiz, mas jogar fora perderia contexto:
        // vai para a descricao.
        if (leitura.getCondicao() != null && !leitura.getCondicao().isBlank()) {
            String antes = leitura.getDescricao();
            String nota = "Era anomalia: " + leitura.getCondicao();
            leitura.setDescricao(antes == null || antes.isBlank() ? nota : nota + " — " + antes);
            leitura.setCondicao(null);
        }

        leitura.setTipo(TipoLeitura.OFICIAL);
        leitura.setSituacao(SituacaoLeitura.COMPLETA);
        repository.save(leitura);
        return detalhe(id);
    }

    @Transactional
    public void remover(UUID id) {
        contexto.exigirGerencia();
        Leitura leitura = buscar(id, contexto.oficinaId());
        arquivoRepository.findByLeituraId(leitura.getId())
                .forEach(a -> armazenamento.apagar(a.getCaminho()));
        repository.delete(leitura);
    }

    // ============================================================ consulta

    @Transactional(readOnly = true)
    public Page<LeituraDtos.Resumo> listar(String busca, TipoLeitura tipo, Pageable paginacao) {
        return repository.buscar(contexto.oficinaId(), busca, tipo, paginacao).map(this::resumo);
    }

    @Transactional(readOnly = true)
    public List<LeituraDtos.Resumo> doVeiculo(UUID veiculoId) {
        return repository.doVeiculo(contexto.oficinaId(), veiculoId).stream().map(this::resumo).toList();
    }

    @Transactional(readOnly = true)
    public LeituraDtos.Detalhe detalhe(UUID id) {
        Leitura leitura = buscar(id, contexto.oficinaId());
        UUID arquivoId = arquivoRepository.findByLeituraId(leitura.getId()).stream()
                .findFirst().map(ArquivoLeitura::getId).orElse(null);

        return new LeituraDtos.Detalhe(
                resumo(leitura),
                leitura.getDescricao(),
                leitura.getFerramenta(),
                leitura.getFerramentaVersao(),
                leitura.getNumeroRelatorio(),
                leitura.getOrdemServicoId(),
                arquivoId,
                leitura.getModulos().stream()
                        .map(m -> new LeituraDtos.ModuloResposta(
                                m.getId(), m.getNome(), m.getCaminho(),
                                m.getItens().stream().map(this::item).toList()))
                        .toList());
    }

    @Transactional(readOnly = true)
    public Resource pdf(UUID leituraId) {
        Leitura leitura = buscar(leituraId, contexto.oficinaId());
        ArquivoLeitura arquivo = arquivoRepository.findByLeituraId(leitura.getId()).stream()
                .findFirst()
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Arquivo da leitura", leituraId));
        return armazenamento.conteudo(arquivo.getCaminho());
    }

    // ============================================================ apoio

    private void aplicar(Leitura leitura, LeituraDtos.Requisicao req, Veiculo veiculo, TipoLeitura tipo) {
        // A copia de marca/modelo/ano fica solta na leitura de proposito: e o
        // que faz a leitura de um Civic 2014 servir para outro Civic 2014.
        leitura.setMarca(preferir(req.marca(), veiculo.getMarca()));
        leitura.setModelo(preferir(req.modelo(), veiculo.getModelo()));
        leitura.setAno(req.ano() != null ? req.ano() : veiculo.getAno());
        leitura.setMotor(preferir(req.motor(), veiculo.getMotor()));
        leitura.setTipo(tipo);
        leitura.setCondicao(tipo == TipoLeitura.ANOMALIA ? req.condicao() : null);
        leitura.setDescricao(req.descricao());
        leitura.setMotorLigado(Boolean.TRUE.equals(req.motorLigado()));
        leitura.setIgnicaoLigada(req.ignicaoLigada() == null || req.ignicaoLigada());
        leitura.setOrigem(req.arquivoId() != null ? OrigemLeitura.PDF : OrigemLeitura.MANUAL);
        leitura.setSituacao(SituacaoLeitura.COMPLETA);
        leitura.setFerramenta(req.ferramenta());
        leitura.setFerramentaVersao(req.ferramentaVersao());
        leitura.setNumeroRelatorio(req.numeroRelatorio());
        leitura.setMomentoTeste(req.momentoTeste() != null ? req.momentoTeste() : OffsetDateTime.now());
        leitura.setKm(req.km() != null ? req.km() : veiculo.getKm());
        leitura.setOrdemServicoId(req.ordemServicoId());
    }

    private LeituraModulo montarModulo(LeituraDtos.ModuloRequisicao req) {
        LeituraModulo modulo = new LeituraModulo();
        modulo.setNome(req.nome());
        modulo.setCaminho(req.caminho());
        if (req.itens() != null) {
            for (LeituraDtos.ItemRequisicao i : req.itens()) {
                LeituraItem item = new LeituraItem();
                item.setNumero(i.numero());
                item.setNome(i.nome());
                item.setValor(i.valor());
                item.setValorNumerico(i.valorNumerico());
                item.setMinimo(i.minimo());
                item.setMaximo(i.maximo());
                item.setUnidade(i.unidade());
                modulo.adicionarItem(item);
            }
        }
        return modulo;
    }

    /** O mesmo modulo, vindo direto do parser em vez da tela. */
    private LeituraModulo montarModuloDoRelatorio(RelatorioScanner.Modulo m) {
        LeituraModulo modulo = new LeituraModulo();
        modulo.setNome(m.nome());
        modulo.setCaminho(m.caminho());
        for (RelatorioScanner.Item i : m.itens()) {
            LeituraItem item = new LeituraItem();
            item.setNumero(i.numero());
            item.setNome(i.nome());
            item.setValor(i.valor());
            item.setValorNumerico(i.valorNumerico());
            item.setMinimo(i.minimo());
            item.setMaximo(i.maximo());
            item.setUnidade(i.unidade());
            modulo.adicionarItem(item);
        }
        return modulo;
    }

    private void vincularArquivo(UUID arquivoId, Leitura leitura, UUID oficinaId) {
        if (arquivoId == null) {
            return;
        }
        ArquivoLeitura arquivo = arquivoRepository.findByIdAndOficinaId(arquivoId, oficinaId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Arquivo", arquivoId));
        arquivo.setLeituraId(leitura.getId());
        arquivoRepository.save(arquivo);
    }

    private Leitura buscar(UUID id, UUID oficinaId) {
        Leitura leitura = repository.buscarCompleta(id)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Leitura", id));
        if (!leitura.getOficinaId().equals(oficinaId)) {
            throw RecursoNaoEncontradoException.de("Leitura", id);
        }
        return leitura;
    }

    private Veiculo exigirVeiculo(UUID veiculoId, UUID oficinaId) {
        if (veiculoId == null) {
            throw new RegraNegocioException("Escolha o carro desta leitura.");
        }
        Veiculo veiculo = veiculoRepository.findById(veiculoId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Veiculo", veiculoId));
        if (!veiculo.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }
        return veiculo;
    }

    /** Anomalia sem nome nao e informacao: "leitura ruim" nao ajuda ninguem. */
    private void validarCondicao(TipoLeitura tipo, String condicao) {
        if (tipo == TipoLeitura.ANOMALIA && (condicao == null || condicao.isBlank())) {
            throw new RegraNegocioException(
                    "Diga em que condicao esta leitura foi feita "
                            + "(ex.: \"carro com problema no frio\").");
        }
    }

    private void exigirModulos(List<LeituraDtos.ModuloRequisicao> modulos) {
        if (modulos == null || modulos.isEmpty()
                || modulos.stream().allMatch(m -> m.itens() == null || m.itens().isEmpty())) {
            throw new RegraNegocioException("A leitura precisa de pelo menos um item.");
        }
    }

    private void exigirRelatorioInedito(UUID oficinaId, String numero, UUID ignorar) {
        if (numero == null || numero.isBlank()) {
            return;
        }
        repository.findByOficinaIdAndNumeroRelatorio(oficinaId, numero).ifPresent(ja -> {
            if (ignorar == null || !ja.getId().equals(ignorar)) {
                throw new RegraNegocioException(
                        "O relatorio %s ja foi importado.".formatted(numero));
            }
        });
    }

    private LeituraDtos.Resumo resumo(Leitura l) {
        return new LeituraDtos.Resumo(
                l.getId(),
                l.getVeiculo() == null ? null : l.getVeiculo().getId(),
                l.getVeiculo() == null ? null : l.getVeiculo().getPlaca(),
                l.getMarca(), l.getModelo(), l.getAno(), l.getMotor(),
                l.descricaoDoModelo(),
                l.getTipo(), l.getTipo().descricao(),
                l.getCondicao(),
                l.isMotorLigado(), l.isIgnicaoLigada(),
                l.getOrigem(), l.getSituacao(),
                l.getMomentoTeste(), l.getKm(),
                l.getModulos().size(), l.totalDeItens(),
                !arquivoRepository.findByLeituraId(l.getId()).isEmpty());
    }

    private LeituraDtos.ItemResposta item(LeituraItem i) {
        return new LeituraDtos.ItemResposta(
                i.getId(), i.getNumero(), i.getNome(), i.getValor(), i.getValorNumerico(),
                i.getMinimo(), i.getMaximo(), i.getUnidade(), i.foraDaFaixa());
    }

    private LeituraDtos.ModuloResposta paraModuloResposta(RelatorioScanner.Modulo m) {
        return new LeituraDtos.ModuloResposta(null, m.nome(), m.caminho(),
                m.itens().stream()
                        .map(i -> new LeituraDtos.ItemResposta(
                                null, i.numero(), i.nome(), i.valor(), i.valorNumerico(),
                                i.minimo(), i.maximo(), i.unidade(), false))
                        .toList());
    }

    private static String preferir(String informado, String doVeiculo) {
        return informado != null && !informado.isBlank() ? informado : doVeiculo;
    }
}
