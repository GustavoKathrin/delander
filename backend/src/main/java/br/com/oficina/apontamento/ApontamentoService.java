package br.com.oficina.apontamento;

import br.com.oficina.cadastro.MotivoParada;
import br.com.oficina.cadastro.MotivoParadaRepository;
import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.compartilhamento.CompartilhamentoService;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.funcionario.Funcionario;
import br.com.oficina.funcionario.FuncionarioRepository;
import br.com.oficina.ordemservico.EventoService;
import br.com.oficina.ordemservico.MaquinaEstadosOs;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import br.com.oficina.ordemservico.OsItem;
import br.com.oficina.ordemservico.OsItemRepository;
import br.com.oficina.ordemservico.StatusItem;
import br.com.oficina.ordemservico.StatusOs;
import br.com.oficina.parada.Parada;
import br.com.oficina.parada.ParadaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * O cronometro do chao de fabrica.
 *
 * Regras que protegem a metrica:
 *  - inicio e fim vem do relogio do servidor, nunca do navegador;
 *  - um item nunca tem dois apontamentos abertos (indice unico no banco);
 *  - apontamento esquecido em aberto e fechado automaticamente no fim do turno.
 */
@Service
public class ApontamentoService {

    private static final Logger log = LoggerFactory.getLogger(ApontamentoService.class);

    private final ApontamentoRepository repository;
    private final OsItemRepository itemRepository;
    private final OrdemServicoRepository osRepository;
    private final FuncionarioRepository funcionarioRepository;
    private final ParadaRepository paradaRepository;
    private final MotivoParadaRepository motivoParadaRepository;
    private final CompartilhamentoService compartilhamentoService;
    private final EventoService eventoService;
    private final ConfiguracaoService config;
    private final Contexto contexto;
    private final Clock clock;

    public ApontamentoService(ApontamentoRepository repository,
                              OsItemRepository itemRepository,
                              OrdemServicoRepository osRepository,
                              FuncionarioRepository funcionarioRepository,
                              ParadaRepository paradaRepository,
                              MotivoParadaRepository motivoParadaRepository,
                              CompartilhamentoService compartilhamentoService,
                              EventoService eventoService,
                              ConfiguracaoService config,
                              Contexto contexto,
                              Clock clock) {
        this.repository = repository;
        this.itemRepository = itemRepository;
        this.osRepository = osRepository;
        this.funcionarioRepository = funcionarioRepository;
        this.paradaRepository = paradaRepository;
        this.motivoParadaRepository = motivoParadaRepository;
        this.compartilhamentoService = compartilhamentoService;
        this.eventoService = eventoService;
        this.config = config;
        this.contexto = contexto;
        this.clock = clock;
    }

    // ================================================================ iniciar

    @Transactional
    public ApontamentoDtos.MeuServico iniciar(ApontamentoDtos.IniciarRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);

        OsItem item = itemRepository.buscarCompleto(req.osItemId())
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Servico", req.osItemId()));
        if (!item.getOficinaId().equals(oficinaId)) {
            throw new AccessDeniedException("Registro de outra oficina.");
        }

        OrdemServico os = item.getOrdemServico();
        if (os.getStatus().finalizada()) {
            throw new RegraNegocioException("Esta OS ja esta %s.".formatted(os.getStatus().descricao()));
        }
        if (item.getStatus() == StatusItem.CONCLUIDO) {
            throw new RegraNegocioException("Este servico ja foi concluido.");
        }
        if (item.getStatus() == StatusItem.CANCELADO) {
            throw new RegraNegocioException("Este servico foi cancelado.");
        }
        if (repository.abertoDoItem(item.getId()).isPresent()) {
            throw new RegraNegocioException("Este servico ja esta com o cronometro rodando.");
        }

        Funcionario funcionario = resolverFuncionario(item, oficinaId);

        if (config.flag(oficinaId, Chaves.EXIGIR_ESTIMATIVA) && req.horasEstimadas() == null) {
            throw new RegraNegocioException(
                    "Informe quanto tempo voce pretende gastar neste servico antes de iniciar.");
        }
        if (!config.flag(oficinaId, Chaves.APONTAMENTO_SIMULTANEO)) {
            List<Apontamento> abertos = repository.abertosDoFuncionario(funcionario.getId());
            if (!abertos.isEmpty()) {
                Apontamento outro = abertos.get(0);
                throw new RegraNegocioException(
                        "Voce ja esta com o cronometro rodando em '%s' (OS %d). Pause antes de comecar outro."
                                .formatted(outro.getOsItem().getDescricao(),
                                        outro.getOsItem().getOrdemServico().getNumero()));
            }
        }
        if (!config.flag(oficinaId, Chaves.MULTIPLOS_MECANICOS)) {
            boolean outroMecanicoNaOs = repository.listarPorOs(os.getId()).stream()
                    .anyMatch(a -> a.aberto() && !a.getFuncionario().getId().equals(funcionario.getId()));
            if (outroMecanicoNaOs) {
                throw new RegraNegocioException(
                        "Outro mecanico ja esta trabalhando nesta OS e a oficina esta configurada "
                                + "para um mecanico por OS.");
            }
        }

        garantirOsEmExecucao(os, oficinaId, agora);

        if (item.getFuncionario() == null) {
            item.setFuncionario(funcionario);
        }

        Apontamento apontamento = new Apontamento();
        apontamento.setOficinaId(oficinaId);
        apontamento.setOrdemServicoId(os.getId());
        apontamento.setOsItem(item);
        apontamento.setFuncionario(funcionario);
        apontamento.setInicio(agora);
        apontamento.setHorasEstimadasInformadas(req.horasEstimadas());
        apontamento.setObservacao(req.observacao());
        repository.save(apontamento);

        item.setStatus(StatusItem.EM_EXECUCAO);
        itemRepository.save(item);

        eventoService.registrar(oficinaId, os.getId(), EventoService.SERVICO_INICIADO,
                "%s comecou '%s'%s".formatted(
                        funcionario.getNome(),
                        item.getDescricao(),
                        req.horasEstimadas() == null ? ""
                                : " (previsao de %sh)".formatted(req.horasEstimadas())),
                true, Map.of("item", item.getDescricao()));

        return montarCard(item, apontamento, agora);
    }

    /** Sobe a OS para EM_EXECUCAO se ainda nao estiver, respeitando a maquina de estados. */
    private void garantirOsEmExecucao(OrdemServico os, UUID oficinaId, OffsetDateTime agora) {
        if (os.getStatus() == StatusOs.EM_EXECUCAO) {
            encerrarParadaAberta(os, agora);
            return;
        }

        StatusOs de = os.getStatus();
        List<OsItem> ativos = os.getItens().stream()
                .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                .toList();

        MaquinaEstadosOs.validar(de, StatusOs.EM_EXECUCAO,
                config.flag(oficinaId, Chaves.EXIGIR_APROVACAO),
                os.getAprovadoEm() != null,
                !ativos.isEmpty(),
                true);

        if (os.getInicioExecucaoEm() == null) {
            os.setInicioExecucaoEm(agora);
        }
        os.setStatus(StatusOs.EM_EXECUCAO);
        osRepository.save(os);
        encerrarParadaAberta(os, agora);

        eventoService.registrar(oficinaId, os.getId(), EventoService.STATUS_ALTERADO,
                "%s -> %s".formatted(de.descricao(), StatusOs.EM_EXECUCAO.descricao()), true);

        if (config.flag(oficinaId, Chaves.COMP_AUTOMATICO)) {
            compartilhamentoService.garantirLink(os);
        }
    }

    // ================================================================ pausar

    @Transactional
    public ApontamentoDtos.MeuServico pausar(UUID apontamentoId, ApontamentoDtos.PausarRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);

        Apontamento apontamento = buscarAberto(apontamentoId, oficinaId);
        OsItem item = itemRepository.buscarCompleto(apontamento.getOsItem().getId()).orElseThrow();
        OrdemServico os = item.getOrdemServico();

        MotivoParada motivo = null;
        if (req.motivoParadaId() != null) {
            motivo = motivoParadaRepository.findById(req.motivoParadaId())
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Motivo de parada", req.motivoParadaId()));
            if (!motivo.getOficinaId().equals(oficinaId)) {
                throw new AccessDeniedException("Registro de outra oficina.");
            }
        } else if (config.flag(oficinaId, Chaves.EXIGIR_MOTIVO_PAUSA)) {
            throw new RegraNegocioException(
                    "Informe o motivo da parada (falta de peca, aprovacao, terceiro...). "
                            + "E isso que vira metrica para o dono.");
        }

        apontamento.setFim(agora);
        if (req.descricao() != null && !req.descricao().isBlank()) {
            apontamento.setObservacao(req.descricao());
        }
        repository.save(apontamento);

        item.setStatus(StatusItem.PAUSADO);
        itemRepository.save(item);

        boolean visivel = req.visivelCliente() != null
                ? req.visivelCliente()
                : motivo != null && motivo.isVisivelClientePadrao();

        if (motivo != null && paradaRepository.abertaDaOs(os.getId()).isEmpty()) {
            Parada parada = new Parada();
            parada.setOficinaId(oficinaId);
            parada.setOrdemServicoId(os.getId());
            parada.setMotivoParada(motivo);
            parada.setInicio(agora);
            parada.setDescricao(req.descricao());
            parada.setVisivelCliente(visivel);
            paradaRepository.save(parada);
        }

        eventoService.registrar(oficinaId, os.getId(), EventoService.SERVICO_PAUSADO,
                motivo == null
                        ? "Servico pausado: " + item.getDescricao()
                        : "Servico pausado (%s): %s".formatted(motivo.getNome(), item.getDescricao()),
                visivel,
                motivo == null ? null : Map.of("motivo", motivo.getNome(),
                        "categoria", motivo.getCategoria().name()));

        // se ninguem mais esta trabalhando na OS e o motivo bloqueia, a OS fica PAUSADA
        boolean alguemTrabalhando = repository.listarPorOs(os.getId()).stream().anyMatch(Apontamento::aberto);
        if (!alguemTrabalhando && os.getStatus() == StatusOs.EM_EXECUCAO) {
            os.setStatus(StatusOs.PAUSADO);
            osRepository.save(os);
            eventoService.registrar(oficinaId, os.getId(), EventoService.STATUS_ALTERADO,
                    "Em execucao -> Pausado", true);
        }

        return montarCard(item, null, agora);
    }

    // ================================================================ concluir

    @Transactional
    public ApontamentoDtos.MeuServico concluir(UUID apontamentoId, ApontamentoDtos.ConcluirRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);

        Apontamento apontamento = buscarAberto(apontamentoId, oficinaId);
        OsItem item = itemRepository.buscarCompleto(apontamento.getOsItem().getId()).orElseThrow();
        OrdemServico os = item.getOrdemServico();

        apontamento.setFim(agora);
        if (req != null && req.observacao() != null && !req.observacao().isBlank()) {
            apontamento.setObservacao(req.observacao());
        }
        repository.save(apontamento);

        item.setStatus(StatusItem.CONCLUIDO);
        itemRepository.save(item);

        BigDecimal trabalhadas = repository.listarPorOs(os.getId()).stream()
                .filter(a -> a.getOsItem().getId().equals(item.getId()))
                .map(a -> a.horas(agora))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        eventoService.registrar(oficinaId, os.getId(), EventoService.SERVICO_CONCLUIDO,
                "'%s' concluido (%sh trabalhadas, %sh estimadas)"
                        .formatted(item.getDescricao(), trabalhadas, item.getHorasEstimadas()),
                true, Map.of("trabalhadas", trabalhadas, "estimadas", item.getHorasEstimadas()));

        // todos os itens concluidos -> o carro esta pronto e passa a contar
        // o tempo de "aguardando retirada", que e o que entope o patio.
        boolean todosConcluidos = os.getItens().stream()
                .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                .allMatch(i -> i.getStatus() == StatusItem.CONCLUIDO);

        if (todosConcluidos && !os.getStatus().finalizada()
                && os.getStatus() != StatusOs.PRONTO_AGUARDANDO_RETIRADA) {
            encerrarParadaAberta(os, agora);
            StatusOs de = os.getStatus();
            os.setStatus(StatusOs.PRONTO_AGUARDANDO_RETIRADA);
            os.setProntoEm(agora);
            osRepository.save(os);
            eventoService.registrar(oficinaId, os.getId(), EventoService.STATUS_ALTERADO,
                    "%s -> %s".formatted(de.descricao(), StatusOs.PRONTO_AGUARDANDO_RETIRADA.descricao()),
                    true);
        } else if (os.getStatus() == StatusOs.EM_EXECUCAO) {
            boolean alguemTrabalhando = repository.listarPorOs(os.getId()).stream()
                    .anyMatch(Apontamento::aberto);
            if (!alguemTrabalhando) {
                os.setStatus(StatusOs.PAUSADO);
                osRepository.save(os);
            }
        }

        return montarCard(item, null, agora);
    }

    // ================================================================ consultas

    @Transactional(readOnly = true)
    public List<ApontamentoDtos.MeuServico> meusServicos() {
        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);

        UUID funcionarioId = contexto.funcionarioId();
        // Dono e gerente veem a oficina inteira, mesmo quando tambem estao
        // cadastrados como funcionario — e o caso normal da oficina pequena,
        // onde o dono pega em chave. Sem isto, ele abria "Meus servicos" e
        // via so o proprio carro, achando que o resto tinha sumido.
        List<OsItem> itens = (funcionarioId == null || contexto.gerencia())
                ? itemRepository.abertosDaOficina(oficinaId)
                : itemRepository.abertosDoFuncionario(funcionarioId);

        return montarCards(itens, agora, funcionarioId);
    }

    /** Todos os servicos abertos da oficina: usado pelo dono e pelo modo TV. */
    @Transactional(readOnly = true)
    public List<ApontamentoDtos.MeuServico> servicosAbertos() {
        UUID oficinaId = contexto.oficinaId();
        return montarCards(itemRepository.abertosDaOficina(oficinaId),
                OffsetDateTime.now(clock), contexto.funcionarioId());
    }

    private List<ApontamentoDtos.MeuServico> montarCards(List<OsItem> itens,
                                                         OffsetDateTime agora,
                                                         UUID funcionarioId) {
        if (itens.isEmpty()) {
            return List.of();
        }
        Map<UUID, Apontamento> abertos = new HashMap<>();
        Map<UUID, BigDecimal> horas = new HashMap<>();

        for (OsItem item : itens) {
            for (Apontamento a : repository.listarPorOs(item.getOrdemServico().getId())) {
                horas.merge(a.getOsItem().getId(), a.horas(agora), BigDecimal::add);
                if (a.aberto()) {
                    abertos.put(a.getOsItem().getId(), a);
                }
            }
        }

        List<ApontamentoDtos.MeuServico> cards = new ArrayList<>();
        for (OsItem item : itens) {
            cards.add(montarCard(item, abertos.get(item.getId()),
                    horas.getOrDefault(item.getId(), BigDecimal.ZERO), agora, funcionarioId));
        }
        return cards;
    }

    private ApontamentoDtos.MeuServico montarCard(OsItem item, Apontamento aberto, OffsetDateTime agora) {
        BigDecimal trabalhadas = repository.listarPorOs(item.getOrdemServico().getId()).stream()
                .filter(a -> a.getOsItem().getId().equals(item.getId()))
                .map(a -> a.horas(agora))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return montarCard(item, aberto, trabalhadas, agora, contexto.funcionarioId());
    }

    private ApontamentoDtos.MeuServico montarCard(OsItem item,
                                                  Apontamento aberto,
                                                  BigDecimal trabalhadas,
                                                  OffsetDateTime agora,
                                                  UUID funcionarioId) {
        OrdemServico os = item.getOrdemServico();
        return new ApontamentoDtos.MeuServico(
                item.getId(),
                os.getId(),
                os.getNumero(),
                os.getVeiculo().getPlaca(),
                os.getVeiculo().descricaoCurta(),
                os.getVeiculo().getCor(),
                os.getCliente().getNome(),
                os.getQueixa(),
                item.getDescricao(),
                item.getEspecialidade() == null ? null : item.getEspecialidade().getNome(),
                item.getEspecialidade() == null ? null : item.getEspecialidade().getCor(),
                item.getHorasEstimadas(),
                trabalhadas.setScale(2, RoundingMode.HALF_UP),
                item.getStatus(),
                item.getStatus().descricao(),
                os.getStatus(),
                os.getPrioridade(),
                os.getDataAgendada(),
                os.getPrevisaoEntrega(),
                os.getBox() == null ? null : os.getBox().getNome(),
                aberto == null ? null : aberto.getId(),
                aberto == null ? null : aberto.getInicio(),
                aberto == null ? null : aberto.getHorasEstimadasInformadas(),
                item.getFuncionario() == null ? null : item.getFuncionario().getNome(),
                item.getFuncionario() != null && item.getFuncionario().getId().equals(funcionarioId),
                os.isPrecisaElevador());
    }

    // ================================================================ apoio

    private Funcionario resolverFuncionario(OsItem item, UUID oficinaId) {
        UUID funcionarioId = contexto.funcionarioId();

        if (funcionarioId == null) {
            // dono/recepcao sem cadastro de funcionario: so pode apontar em item ja atribuido
            if (item.getFuncionario() == null) {
                throw new RegraNegocioException(
                        "Este servico ainda nao tem mecanico responsavel. Atribua um mecanico antes de iniciar.");
            }
            if (!contexto.gerencia()) {
                throw new AccessDeniedException("Seu perfil nao pode apontar horas.");
            }
            return item.getFuncionario();
        }

        Funcionario eu = funcionarioRepository.findById(funcionarioId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Funcionario", funcionarioId));
        if (!eu.getOficinaId().equals(oficinaId)) {
            throw new AccessDeniedException("Registro de outra oficina.");
        }
        if (!eu.isAtivo()) {
            throw new RegraNegocioException("Seu cadastro esta inativo. Fale com o dono da oficina.");
        }

        if (item.getFuncionario() != null
                && !item.getFuncionario().getId().equals(funcionarioId)
                && !contexto.gerencia()) {
            throw new RegraNegocioException(
                    "Este servico esta atribuido a %s.".formatted(item.getFuncionario().getNome()));
        }
        if (item.getFuncionario() != null && contexto.gerencia()) {
            return item.getFuncionario();
        }
        if (item.getEspecialidade() != null && !eu.atende(item.getEspecialidade().getId())) {
            throw new RegraNegocioException(
                    "Voce nao tem a especialidade '%s' no cadastro."
                            .formatted(item.getEspecialidade().getNome()));
        }
        return eu;
    }

    private Apontamento buscarAberto(UUID apontamentoId, UUID oficinaId) {
        Apontamento apontamento = repository.findById(apontamentoId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Apontamento", apontamentoId));
        if (!apontamento.getOficinaId().equals(oficinaId)) {
            throw new AccessDeniedException("Registro de outra oficina.");
        }
        if (!apontamento.aberto()) {
            throw new RegraNegocioException("Este apontamento ja foi encerrado.");
        }
        UUID funcionarioId = contexto.funcionarioId();
        if (funcionarioId != null
                && !apontamento.getFuncionario().getId().equals(funcionarioId)
                && !contexto.gerencia()) {
            throw new AccessDeniedException("Este apontamento e de outro mecanico.");
        }
        return apontamento;
    }

    private void encerrarParadaAberta(OrdemServico os, OffsetDateTime agora) {
        paradaRepository.abertaDaOs(os.getId()).ifPresent(parada -> {
            parada.setFim(agora);
            paradaRepository.save(parada);
            eventoService.registrar(os.getOficinaId(), os.getId(), EventoService.SERVICO_RETOMADO,
                    "Parada encerrada: " + parada.getMotivoParada().getNome(),
                    parada.isVisivelCliente());
        });
    }

    // ================================================================ job

    /**
     * Fecha apontamentos que ficaram abertos depois do horario de encerramento.
     * Sem isso, um cronometro esquecido na sexta vira 72 horas de mao de obra na segunda.
     */
    @Scheduled(cron = "0 */10 * * * *")
    @Transactional
    public void fecharApontamentosEsquecidos() {
        UUID oficinaId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        if (!config.flag(oficinaId, Chaves.FECHAR_APONTAMENTO_ESQUECIDO)) {
            return;
        }

        OffsetDateTime agora = OffsetDateTime.now(clock);
        LocalTime limite = config.hora(oficinaId, Chaves.HORA_FECHAMENTO_AUTOMATICO, LocalTime.of(18, 30));

        for (Apontamento apontamento : repository.abertos(oficinaId)) {
            OffsetDateTime fechamentoDoDia = apontamento.getInicio().with(limite);
            if (apontamento.getInicio().isAfter(fechamentoDoDia)) {
                fechamentoDoDia = fechamentoDoDia.plusDays(1);
            }
            if (agora.isBefore(fechamentoDoDia)) {
                continue;
            }

            apontamento.setFim(fechamentoDoDia);
            apontamento.setEncerradoAutomaticamente(true);
            if (apontamento.getObservacao() == null) {
                apontamento.setObservacao("Encerrado automaticamente no fim do turno");
            }
            repository.save(apontamento);

            Optional<OsItem> item = itemRepository.findById(apontamento.getOsItem().getId());
            item.ifPresent(i -> {
                if (i.getStatus() == StatusItem.EM_EXECUCAO) {
                    i.setStatus(StatusItem.PAUSADO);
                    itemRepository.save(i);
                }
            });

            eventoService.registrar(oficinaId, apontamento.getOrdemServicoId(),
                    EventoService.SERVICO_PAUSADO,
                    "Apontamento encerrado automaticamente no fim do turno.", false);

            log.info("Apontamento {} encerrado automaticamente.", apontamento.getId());
        }
    }
}
