package br.com.oficina.compartilhamento;

import br.com.oficina.apontamento.ApontamentoRepository;
import br.com.oficina.arquivo.ArquivoOsRepository;
import br.com.oficina.auth.JwtService;
import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.config.AppProperties;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.ordemservico.EventoOs;
import br.com.oficina.ordemservico.EventoService;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import br.com.oficina.ordemservico.OsDtos;
import br.com.oficina.ordemservico.OsItem;
import br.com.oficina.ordemservico.StatusItem;
import br.com.oficina.ordemservico.StatusOs;
import br.com.oficina.parada.Parada;
import br.com.oficina.parada.ParadaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Link publico de acompanhamento.
 *
 * O escopo do que o cliente ve e resolvido em tres camadas, nesta ordem:
 * padrao global da oficina -> preferencia do cliente -> ajuste daquele link.
 */
@Service
public class CompartilhamentoService {

    private final CompartilhamentoOsRepository repository;
    private final AcessoCompartilhamentoRepository acessoRepository;
    private final OrdemServicoRepository osRepository;
    private final ApontamentoRepository apontamentoRepository;
    private final ParadaRepository paradaRepository;
    private final ArquivoOsRepository arquivoRepository;
    private final EventoService eventoService;
    private final ConfiguracaoService config;
    private final AppProperties props;
    private final Contexto contexto;
    private final Clock clock;

    public CompartilhamentoService(CompartilhamentoOsRepository repository,
                                   AcessoCompartilhamentoRepository acessoRepository,
                                   OrdemServicoRepository osRepository,
                                   ApontamentoRepository apontamentoRepository,
                                   ParadaRepository paradaRepository,
                                   ArquivoOsRepository arquivoRepository,
                                   EventoService eventoService,
                                   ConfiguracaoService config,
                                   AppProperties props,
                                   Contexto contexto,
                                   Clock clock) {
        this.repository = repository;
        this.acessoRepository = acessoRepository;
        this.osRepository = osRepository;
        this.apontamentoRepository = apontamentoRepository;
        this.paradaRepository = paradaRepository;
        this.arquivoRepository = arquivoRepository;
        this.eventoService = eventoService;
        this.config = config;
        this.props = props;
        this.contexto = contexto;
        this.clock = clock;
    }

    // ================================================== gestao do link

    /** Cria o link se ainda nao existir (usado quando o servico comeca). */
    @Transactional
    public Optional<CompartilhamentoOs> garantirLink(OrdemServico os) {
        if (!config.flag(os.getOficinaId(), Chaves.COMP_ATIVO_GLOBAL)) {
            return Optional.empty();
        }
        if (!clientePermite(os)) {
            return Optional.empty();
        }
        Optional<CompartilhamentoOs> existente =
                repository.findFirstByOrdemServicoIdAndAtivoTrueOrderByCriadoEmDesc(os.getId());
        if (existente.isPresent() && existente.get().valido(OffsetDateTime.now(clock))) {
            return existente;
        }
        return Optional.of(criar(os, null, null));
    }

    @Transactional
    public CompartilhamentoDtos.Resposta criarOuRecuperar(UUID osId, CompartilhamentoDtos.Requisicao req) {
        UUID oficinaId = contexto.oficinaId();
        contexto.exigirGerencia();

        if (!config.flag(oficinaId, Chaves.COMP_ATIVO_GLOBAL)) {
            throw new RegraNegocioException("O compartilhamento com clientes esta desligado. "
                    + "Ative em Configuracoes > Compartilhamento.");
        }

        OrdemServico os = osRepository.buscarCompleta(osId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Ordem de servico", osId));
        if (!os.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }
        if (!clientePermite(os)) {
            throw new RegraNegocioException("Este cliente esta marcado para nao receber link de acompanhamento.");
        }

        CompartilhamentoOs link = repository
                .findFirstByOrdemServicoIdAndAtivoTrueOrderByCriadoEmDesc(osId)
                .filter(c -> c.valido(OffsetDateTime.now(clock)))
                .orElseGet(() -> criar(os, req == null ? null : req.escopo(), req == null ? null : req.pin()));

        if (req != null && req.escopo() != null && !req.escopo().isEmpty()) {
            link.setEscopo(new LinkedHashMap<>(req.escopo()));
            repository.save(link);
        }
        return montarResposta(os, link);
    }

    @Transactional
    public CompartilhamentoDtos.Resposta atualizar(UUID linkId, CompartilhamentoDtos.AtualizacaoRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        contexto.exigirGerencia();

        CompartilhamentoOs link = repository.findById(linkId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Compartilhamento", linkId));
        if (!link.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }

        if (req.ativo() != null) {
            link.setAtivo(req.ativo());
        }
        if (req.escopo() != null) {
            link.setEscopo(new LinkedHashMap<>(req.escopo()));
        }
        if (req.diasValidade() != null) {
            link.setExpiraEm(req.diasValidade() <= 0
                    ? null
                    : OffsetDateTime.now(clock).plusDays(req.diasValidade()));
        }
        if (req.pin() != null) {
            link.setPin(req.pin().isBlank() ? null : req.pin().trim());
        }
        repository.save(link);

        OrdemServico os = osRepository.buscarCompleta(link.getOrdemServicoId()).orElseThrow();
        return montarResposta(os, link);
    }

    /** Gera um token novo e invalida o anterior. */
    @Transactional
    public CompartilhamentoDtos.Resposta rotacionar(UUID osId) {
        UUID oficinaId = contexto.oficinaId();
        contexto.exigirGerencia();

        OrdemServico os = osRepository.buscarCompleta(osId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Ordem de servico", osId));
        if (!os.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }

        repository.findFirstByOrdemServicoIdAndAtivoTrueOrderByCriadoEmDesc(osId).ifPresent(antigo -> {
            antigo.setAtivo(false);
            repository.save(antigo);
        });
        return montarResposta(os, criar(os, null, null));
    }

    @Transactional(readOnly = true)
    public OsDtos.CompartilhamentoResposta resumoDoLink(OrdemServico os) {
        return repository.findFirstByOrdemServicoIdAndAtivoTrueOrderByCriadoEmDesc(os.getId())
                .map(link -> new OsDtos.CompartilhamentoResposta(
                        link.getId(),
                        urlPublica(link.getToken()),
                        link.getToken(),
                        link.getExpiraEm(),
                        link.isAtivo(),
                        link.getTotalAcessos(),
                        link.getUltimoAcessoEm(),
                        escopoEfetivo(os, link)))
                .orElse(null);
    }

    private CompartilhamentoOs criar(OrdemServico os, Map<String, Boolean> escopo, String pin) {
        String token = JwtService.gerarTokenOpaco();
        int dias = config.inteiro(os.getOficinaId(), Chaves.COMP_DIAS_VALIDADE, 30);

        CompartilhamentoOs link = new CompartilhamentoOs();
        link.setOficinaId(os.getOficinaId());
        link.setOrdemServicoId(os.getId());
        link.setToken(token);
        link.setTokenHash(JwtService.hash(token));
        link.setExpiraEm(dias <= 0 ? null : OffsetDateTime.now(clock).plusDays(dias));
        link.setAtivo(true);
        if (escopo != null && !escopo.isEmpty()) {
            link.setEscopo(new LinkedHashMap<>(escopo));
        }
        if (config.flag(os.getOficinaId(), Chaves.COMP_EXIGIR_PIN)) {
            // PIN padrao: os 4 ultimos caracteres da placa, facil de ditar por telefone
            String placa = os.getVeiculo().getPlaca();
            link.setPin(pin != null && !pin.isBlank()
                    ? pin.trim()
                    : placa.substring(Math.max(0, placa.length() - 4)));
        }
        CompartilhamentoOs salvo = repository.save(link);

        eventoService.registrar(os.getOficinaId(), os.getId(), EventoService.LINK_GERADO,
                "Link de acompanhamento gerado para o cliente.", false);
        return salvo;
    }

    private boolean clientePermite(OrdemServico os) {
        Boolean preferencia = os.getCliente().getCompartilhamentoHabilitado();
        return preferencia == null || preferencia;
    }

    private CompartilhamentoDtos.Resposta montarResposta(OrdemServico os, CompartilhamentoOs link) {
        return new CompartilhamentoDtos.Resposta(
                link.getId(),
                urlPublica(link.getToken()),
                link.getToken(),
                link.getPin(),
                link.getExpiraEm(),
                link.isAtivo(),
                link.getTotalAcessos(),
                link.getUltimoAcessoEm(),
                escopoEfetivo(os, link));
    }

    private String urlPublica(String token) {
        return "%s/acompanhar/%s".formatted(props.urlPublica().replaceAll("/+$", ""), token);
    }

    /** Padrao global -> preferencia do cliente -> ajuste do link. */
    public Map<String, Boolean> escopoEfetivo(OrdemServico os, CompartilhamentoOs link) {
        Map<String, Boolean> escopo = new LinkedHashMap<>(config.escopoPadrao(os.getOficinaId()));
        aplicar(escopo, os.getCliente().getEscopoCompartilhamento());
        if (link != null) {
            aplicar(escopo, link.getEscopo());
        }
        return escopo;
    }

    private void aplicar(Map<String, Boolean> destino, Map<String, Object> override) {
        if (override == null) {
            return;
        }
        override.forEach((chave, valor) -> {
            if (destino.containsKey(chave) && valor != null) {
                destino.put(chave, Boolean.parseBoolean(String.valueOf(valor)));
            }
        });
    }

    // ================================================== visao publica

    @Transactional
    public PublicoDtos.Acompanhamento acompanhar(String token, String pin, String ip, String userAgent) {
        OffsetDateTime agora = OffsetDateTime.now(clock);

        CompartilhamentoOs link = repository.findByTokenHash(JwtService.hash(token))
                .orElseThrow(() -> new RecursoNaoEncontradoException(
                        "Link invalido ou removido. Peca um novo link para a oficina."));

        if (!link.valido(agora)) {
            throw new RegraNegocioException("Este link expirou. Peca um novo link para a oficina.");
        }
        if (link.getPin() != null && !link.getPin().equalsIgnoreCase(pin == null ? "" : pin.trim())) {
            throw new RegraNegocioException("Codigo de acesso incorreto.");
        }

        OrdemServico os = osRepository.buscarComItens(link.getOrdemServicoId())
                .orElseThrow(() -> new RecursoNaoEncontradoException("Ordem de servico nao encontrada."));

        link.setTotalAcessos(link.getTotalAcessos() + 1);
        link.setUltimoAcessoEm(agora);
        repository.save(link);

        AcessoCompartilhamento acesso = new AcessoCompartilhamento();
        acesso.setCompartilhamentoId(link.getId());
        acesso.setQuando(agora);
        acesso.setIp(truncarIp(ip));
        acesso.setUserAgent(userAgent == null ? null
                : userAgent.substring(0, Math.min(userAgent.length(), 300)));
        acessoRepository.save(acesso);

        return montarAcompanhamento(os, link, agora);
    }

    private PublicoDtos.Acompanhamento montarAcompanhamento(OrdemServico os,
                                                            CompartilhamentoOs link,
                                                            OffsetDateTime agora) {
        Map<String, Boolean> escopo = escopoEfetivo(os, link);

        BigDecimal estimadas = os.horasEstimadas();
        Double segundos = apontamentoRepository.segundosTrabalhadosNaOs(os.getId(), agora);
        BigDecimal trabalhadas = BigDecimal.valueOf(segundos == null ? 0 : segundos)
                .divide(BigDecimal.valueOf(3600), 2, RoundingMode.HALF_UP);

        int progresso = calcularProgresso(os, estimadas, trabalhadas);

        List<PublicoDtos.ItemPublico> itens = List.of();
        if (Boolean.TRUE.equals(escopo.get(Chaves.COMP_MOSTRAR_ITENS))) {
            itens = os.getItens().stream()
                    .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                    .sorted(java.util.Comparator.comparingInt(OsItem::getOrdem))
                    .map(i -> new PublicoDtos.ItemPublico(
                            i.getDescricao(),
                            i.getStatus().descricao(),
                            i.getStatus() == StatusItem.CONCLUIDO,
                            Boolean.TRUE.equals(escopo.get(Chaves.COMP_MOSTRAR_MECANICO))
                                    && i.getFuncionario() != null
                                    ? i.getFuncionario().getNome() : null))
                    .toList();
        }

        PublicoDtos.ParadaPublica parada = null;
        if (Boolean.TRUE.equals(escopo.get(Chaves.COMP_MOSTRAR_PARADAS))) {
            Optional<Parada> aberta = paradaRepository.abertaDaOs(os.getId());
            if (aberta.isPresent() && aberta.get().isVisivelCliente()) {
                Parada p = aberta.get();
                parada = new PublicoDtos.ParadaPublica(
                        Boolean.TRUE.equals(escopo.get(Chaves.COMP_MOSTRAR_MOTIVO_PARADA))
                                ? p.getMotivoParada().getNome()
                                : "Aguardando etapa externa",
                        p.getInicio(),
                        p.horas(agora));
            }
        }

        List<PublicoDtos.EventoPublico> timeline = new ArrayList<>();
        for (EventoOs evento : eventoService.listarPublicos(os.getId())) {
            timeline.add(new PublicoDtos.EventoPublico(
                    evento.getTipo(), evento.getDescricao(), evento.getCriadoEm()));
        }

        List<PublicoDtos.FotoPublica> fotos = List.of();
        if (Boolean.TRUE.equals(escopo.get(Chaves.COMP_MOSTRAR_FOTOS))) {
            fotos = arquivoRepository.findByOrdemServicoIdAndVisivelClienteTrueOrderByCriadoEm(os.getId())
                    .stream()
                    .map(a -> new PublicoDtos.FotoPublica(
                            "/api/publico/os/%s/fotos/%s".formatted(link.getToken(), a.getId()),
                            a.getMomento()))
                    .toList();
        }

        return new PublicoDtos.Acompanhamento(
                config.texto(os.getOficinaId(), Chaves.NOME_OFICINA, "Oficina"),
                os.getNumero(),
                os.getVeiculo().getPlaca(),
                os.getVeiculo().descricaoCurta(),
                os.getCliente().primeiroNome(),
                os.getStatus(),
                os.getStatus().descricao(),
                mensagemDeStatus(os, parada != null),
                progresso,
                Boolean.TRUE.equals(escopo.get(Chaves.COMP_MOSTRAR_PREVISAO)) ? os.getPrevisaoEntrega() : null,
                Boolean.TRUE.equals(escopo.get(Chaves.COMP_MOSTRAR_TEMPO)) ? trabalhadas : null,
                Boolean.TRUE.equals(escopo.get(Chaves.COMP_MOSTRAR_VALORES)) ? os.valorTotal() : null,
                itens,
                parada,
                timeline,
                fotos,
                os.getEntradaEm(),
                os.getProntoEm());
    }

    private int calcularProgresso(OrdemServico os, BigDecimal estimadas, BigDecimal trabalhadas) {
        return switch (os.getStatus()) {
            case RECEBIDO, EM_DIAGNOSTICO -> 10;
            case AGUARDANDO_APROVACAO -> 20;
            case ORCAMENTO_APROVADO -> 30;
            case AGENDADO -> 30;
            case EM_EXECUCAO, PAUSADO -> {
                if (estimadas.signum() == 0) {
                    yield 60;
                }
                int pct = trabalhadas.multiply(BigDecimal.valueOf(60))
                        .divide(estimadas, 0, RoundingMode.HALF_UP).intValue();
                yield Math.min(40 + pct, 90);
            }
            case PRONTO_AGUARDANDO_RETIRADA -> 95;
            case ENTREGUE -> 100;
            case CANCELADO -> 0;
        };
    }

    /**
     * A mensagem so promete "veja o motivo abaixo" quando existe de fato uma
     * parada liberada para o cliente ver.
     */
    private String mensagemDeStatus(OrdemServico os, boolean temParadaVisivel) {
        return switch (os.getStatus()) {
            case RECEBIDO -> "Recebemos seu veiculo. Em breve iniciamos a avaliacao.";
            case EM_DIAGNOSTICO -> "Estamos avaliando seu veiculo para identificar o problema.";
            case AGUARDANDO_APROVACAO -> "O orcamento foi enviado e aguarda sua aprovacao.";
            case ORCAMENTO_APROVADO -> "Orcamento aprovado. Seu veiculo esta na fila para comecar.";
            case AGENDADO -> "Servico aprovado e na fila de execucao.";
            case EM_EXECUCAO -> "Seu veiculo esta em atendimento agora.";
            case PAUSADO -> temParadaVisivel
                    ? "O servico esta temporariamente parado. Veja o motivo abaixo."
                    : "O servico esta temporariamente parado. A oficina retoma assim que possivel.";
            case PRONTO_AGUARDANDO_RETIRADA -> "Seu veiculo esta pronto para retirada!";
            case ENTREGUE -> "Servico concluido e veiculo entregue. Obrigado!";
            case CANCELADO -> "Este atendimento foi cancelado.";
        };
    }

    /** LGPD: guardamos o IP truncado, o suficiente para detectar abuso. */
    private String truncarIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return null;
        }
        if (ip.contains(".")) {
            String[] partes = ip.split("\\.");
            if (partes.length == 4) {
                return "%s.%s.%s.0".formatted(partes[0], partes[1], partes[2]);
            }
        }
        if (ip.contains(":")) {
            String[] partes = ip.split(":");
            return partes.length > 2 ? "%s:%s::".formatted(partes[0], partes[1]) : ip;
        }
        return ip;
    }

    @Transactional(readOnly = true)
    public Optional<CompartilhamentoOs> porToken(String token) {
        return repository.findByTokenHash(JwtService.hash(token))
                .filter(link -> link.valido(OffsetDateTime.now(clock)));
    }

    /** Usado no card do quadro: a OS tem link ativo? */
    @Transactional(readOnly = true)
    public boolean temLinkAtivo(UUID osId) {
        return repository.findFirstByOrdemServicoIdAndAtivoTrueOrderByCriadoEmDesc(osId)
                .filter(link -> link.valido(OffsetDateTime.now(clock)))
                .isPresent();
    }

    public boolean statusPermiteCompartilhar(StatusOs status) {
        return status != StatusOs.CANCELADO;
    }
}
