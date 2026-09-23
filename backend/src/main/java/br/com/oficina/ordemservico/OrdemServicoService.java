package br.com.oficina.ordemservico;

import br.com.oficina.apontamento.Apontamento;
import br.com.oficina.apontamento.ApontamentoRepository;
import br.com.oficina.arquivo.ArquivoOsRepository;
import br.com.oficina.cadastro.Box;
import br.com.oficina.cadastro.BoxRepository;
import br.com.oficina.cadastro.CatalogoServico;
import br.com.oficina.cadastro.CatalogoServicoRepository;
import br.com.oficina.cadastro.Especialidade;
import br.com.oficina.cadastro.EspecialidadeRepository;
import br.com.oficina.cadastro.MotivoParada;
import br.com.oficina.cadastro.MotivoParadaRepository;
import br.com.oficina.cliente.Cliente;
import br.com.oficina.cliente.ClienteRepository;
import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.compartilhamento.CompartilhamentoService;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.elevador.ElevadorService;
import br.com.oficina.funcionario.Funcionario;
import br.com.oficina.funcionario.FuncionarioRepository;
import br.com.oficina.parada.Parada;
import br.com.oficina.parada.ParadaRepository;
import br.com.oficina.peca.PecaOs;
import br.com.oficina.peca.PecaOsRepository;
import br.com.oficina.veiculo.Veiculo;
import br.com.oficina.veiculo.VeiculoProprietarioHist;
import br.com.oficina.veiculo.VeiculoProprietarioHistRepository;
import br.com.oficina.veiculo.VeiculoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class OrdemServicoService {

    private final OrdemServicoRepository repository;
    private final OsItemRepository itemRepository;
    private final ChecklistItemRepository checklistRepository;
    private final ClienteRepository clienteRepository;
    private final VeiculoRepository veiculoRepository;
    private final VeiculoProprietarioHistRepository historicoProprietarioRepository;
    private final BoxRepository boxRepository;
    private final EspecialidadeRepository especialidadeRepository;
    private final CatalogoServicoRepository catalogoRepository;
    private final FuncionarioRepository funcionarioRepository;
    private final ApontamentoRepository apontamentoRepository;
    private final ParadaRepository paradaRepository;
    private final MotivoParadaRepository motivoParadaRepository;
    private final PecaOsRepository pecaRepository;
    private final ArquivoOsRepository arquivoRepository;
    private final CompartilhamentoService compartilhamentoService;
    private final ElevadorService elevadorService;
    private final EventoService eventoService;
    private final ResumoOsFactory resumoFactory;
    private final ConfiguracaoService config;
    private final Contexto contexto;
    private final Clock clock;

    public OrdemServicoService(OrdemServicoRepository repository,
                               OsItemRepository itemRepository,
                               ChecklistItemRepository checklistRepository,
                               ClienteRepository clienteRepository,
                               VeiculoRepository veiculoRepository,
                               VeiculoProprietarioHistRepository historicoProprietarioRepository,
                               BoxRepository boxRepository,
                               EspecialidadeRepository especialidadeRepository,
                               CatalogoServicoRepository catalogoRepository,
                               FuncionarioRepository funcionarioRepository,
                               ApontamentoRepository apontamentoRepository,
                               ParadaRepository paradaRepository,
                               MotivoParadaRepository motivoParadaRepository,
                               PecaOsRepository pecaRepository,
                               ArquivoOsRepository arquivoRepository,
                               CompartilhamentoService compartilhamentoService,
                               ElevadorService elevadorService,
                               EventoService eventoService,
                               ResumoOsFactory resumoFactory,
                               ConfiguracaoService config,
                               Contexto contexto,
                               Clock clock) {
        this.repository = repository;
        this.itemRepository = itemRepository;
        this.checklistRepository = checklistRepository;
        this.clienteRepository = clienteRepository;
        this.veiculoRepository = veiculoRepository;
        this.historicoProprietarioRepository = historicoProprietarioRepository;
        this.boxRepository = boxRepository;
        this.especialidadeRepository = especialidadeRepository;
        this.catalogoRepository = catalogoRepository;
        this.funcionarioRepository = funcionarioRepository;
        this.apontamentoRepository = apontamentoRepository;
        this.paradaRepository = paradaRepository;
        this.motivoParadaRepository = motivoParadaRepository;
        this.pecaRepository = pecaRepository;
        this.arquivoRepository = arquivoRepository;
        this.compartilhamentoService = compartilhamentoService;
        this.elevadorService = elevadorService;
        this.eventoService = eventoService;
        this.resumoFactory = resumoFactory;
        this.config = config;
        this.contexto = contexto;
        this.clock = clock;
    }

    // ================================================================ check-in

    /**
     * Cria cliente (se novo), veiculo (se novo), OS, itens, checklist e a
     * alocacao na agenda numa unica transacao. E a tela de poucos cliques.
     */
    @Transactional
    public OsDtos.Detalhe checkIn(OsDtos.CheckinRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        if (!contexto.gerencia() && !config.flag(oficinaId, Chaves.MECANICO_CRIA_OS)) {
            throw new AccessDeniedException("Seu perfil nao pode abrir OS. "
                    + "O dono pode liberar isso em Configuracoes > Fluxo.");
        }

        Cliente cliente = resolverCliente(req, oficinaId);
        Veiculo veiculo = resolverVeiculo(req, cliente, oficinaId);

        OrdemServico os = new OrdemServico();
        os.setOficinaId(oficinaId);
        os.setNumero(repository.proximoNumero());
        os.setCliente(cliente);
        os.setVeiculo(veiculo);
        os.setQueixa(req.queixa());
        os.setPrioridade(req.prioridade() == null ? Prioridade.NORMAL : req.prioridade());
        os.setDataAgendada(req.dataAgendada());
        os.setPrevisaoEntrega(req.previsaoEntrega());
        os.setKmEntrada(req.kmEntrada());
        os.setEntradaEm(OffsetDateTime.now(clock));
        os.setStatus(statusInicial(oficinaId, req.dataAgendada()));

        if (req.boxId() != null) {
            os.setBox(buscarBox(req.boxId(), oficinaId));
        }
        if (req.kmEntrada() != null) {
            veiculo.setKm(req.kmEntrada());
        }

        if (req.itens() != null) {
            for (OsDtos.ItemRequisicao item : req.itens()) {
                os.adicionarItem(construirItem(item, oficinaId));
            }
            recalcularMaoObra(os);
        }

        // Quem nao disse nada herda dos servicos escolhidos: marcar "alinhamento"
        // ja diz que o carro sobe, e o dono nao precisa lembrar de duas coisas.
        os.setPrecisaElevador(req.precisaElevador() != null
                ? req.precisaElevador()
                : os.getItens().stream().anyMatch(i -> i.getCatalogoServico() != null
                        && i.getCatalogoServico().isExigeElevador()));

        OrdemServico salva = repository.save(os);

        if (req.elevadorBoxId() != null) {
            elevadorService.reservar(salva.getId(), req.elevadorBoxId(),
                    req.elevadorInicio(), req.elevadorHoras());
        }

        if (req.checklist() != null && !req.checklist().isEmpty()) {
            List<ChecklistItem> itens = new ArrayList<>();
            int ordem = 0;
            for (String descricao : req.checklist()) {
                ChecklistItem item = new ChecklistItem();
                item.setOficinaId(oficinaId);
                item.setOrdemServicoId(salva.getId());
                item.setDescricao(descricao);
                item.setOrdem(ordem++);
                itens.add(item);
            }
            checklistRepository.saveAll(itens);
        }

        eventoService.registrar(oficinaId, salva.getId(), EventoService.OS_CRIADA,
                "Veiculo recebido na oficina.", true,
                Map.of("placa", veiculo.getPlaca(), "numero", salva.getNumero()));

        if (salva.getDataAgendada() != null) {
            eventoService.registrar(oficinaId, salva.getId(), EventoService.AGENDAMENTO,
                    "Servico agendado para " + salva.getDataAgendada(), true);
        }

        return detalhe(salva.getId());
    }

    private StatusOs statusInicial(UUID oficinaId, LocalDate dataAgendada) {
        if (config.flag(oficinaId, Chaves.EXIGIR_DIAGNOSTICO)) {
            return StatusOs.EM_DIAGNOSTICO;
        }
        if (config.flag(oficinaId, Chaves.EXIGIR_APROVACAO)) {
            return StatusOs.RECEBIDO;
        }
        return dataAgendada != null ? StatusOs.AGENDADO : StatusOs.RECEBIDO;
    }

    private Cliente resolverCliente(OsDtos.CheckinRequisicao req, UUID oficinaId) {
        if (req.clienteId() != null) {
            Cliente cliente = clienteRepository.findById(req.clienteId())
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Cliente", req.clienteId()));
            exigirMesmaOficina(cliente.getOficinaId(), oficinaId);
            return cliente;
        }
        if (req.novoCliente() == null) {
            throw new RegraNegocioException("Selecione um cliente existente ou cadastre um novo.");
        }
        Cliente cliente = new Cliente();
        cliente.setOficinaId(oficinaId);
        cliente.setNome(req.novoCliente().nome().trim());
        cliente.setTelefone(req.novoCliente().telefone());
        cliente.setDocumento(req.novoCliente().documento());
        cliente.setEmail(req.novoCliente().email());
        cliente.setConsentimentoContato(req.novoCliente().consentimentoContato());
        return clienteRepository.save(cliente);
    }

    private Veiculo resolverVeiculo(OsDtos.CheckinRequisicao req, Cliente cliente, UUID oficinaId) {
        if (req.veiculoId() != null) {
            Veiculo veiculo = veiculoRepository.buscarComCliente(req.veiculoId())
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Veiculo", req.veiculoId()));
            exigirMesmaOficina(veiculo.getOficinaId(), oficinaId);
            if (!veiculo.getCliente().getId().equals(cliente.getId())) {
                trocarProprietario(veiculo, cliente);
            }
            return veiculo;
        }
        if (req.novoVeiculo() == null) {
            throw new RegraNegocioException("Selecione um veiculo existente ou cadastre um novo.");
        }

        String placa = Veiculo.normalizarPlaca(req.novoVeiculo().placa());
        if (placa == null || placa.length() < 6) {
            throw new RegraNegocioException("Placa invalida. Use o formato ABC1D23 ou ABC1234.");
        }

        Optional<Veiculo> existente = veiculoRepository.findByOficinaIdAndPlaca(oficinaId, placa);
        if (existente.isPresent()) {
            Veiculo veiculo = existente.get();
            if (!veiculo.getCliente().getId().equals(cliente.getId())) {
                trocarProprietario(veiculo, cliente);
            }
            return veiculo;
        }

        Veiculo veiculo = new Veiculo();
        veiculo.setOficinaId(oficinaId);
        veiculo.setCliente(cliente);
        veiculo.setPlaca(placa);
        veiculo.setMarca(req.novoVeiculo().marca());
        veiculo.setModelo(req.novoVeiculo().modelo());
        veiculo.setAno(req.novoVeiculo().ano());
        veiculo.setCor(req.novoVeiculo().cor());
        veiculo.setKm(req.novoVeiculo().km());
        Veiculo salvo = veiculoRepository.save(veiculo);

        VeiculoProprietarioHist hist = new VeiculoProprietarioHist();
        hist.setVeiculoId(salvo.getId());
        hist.setClienteId(cliente.getId());
        hist.setInicio(OffsetDateTime.now(clock));
        historicoProprietarioRepository.save(hist);

        return salvo;
    }

    private void trocarProprietario(Veiculo veiculo, Cliente novoCliente) {
        OffsetDateTime agora = OffsetDateTime.now(clock);
        historicoProprietarioRepository.findByVeiculoIdOrderByInicioDesc(veiculo.getId()).stream()
                .filter(h -> h.getFim() == null)
                .forEach(h -> {
                    h.setFim(agora);
                    historicoProprietarioRepository.save(h);
                });

        veiculo.setCliente(novoCliente);
        veiculoRepository.save(veiculo);

        VeiculoProprietarioHist hist = new VeiculoProprietarioHist();
        hist.setVeiculoId(veiculo.getId());
        hist.setClienteId(novoCliente.getId());
        hist.setInicio(agora);
        historicoProprietarioRepository.save(hist);
    }

    // ================================================================ transicoes

    @Transactional
    public OsDtos.Detalhe transicionar(UUID id, OsDtos.TransicaoRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = buscarComItens(id, oficinaId);
        OffsetDateTime agora = OffsetDateTime.now(clock);

        StatusOs de = os.getStatus();
        StatusOs para = req.status();

        List<OsItem> ativos = os.getItens().stream()
                .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                .toList();
        boolean temItemEmAberto = ativos.stream().anyMatch(i -> i.getStatus() != StatusItem.CONCLUIDO);

        MaquinaEstadosOs.validar(de, para,
                config.flag(oficinaId, Chaves.EXIGIR_APROVACAO),
                os.getAprovadoEm() != null,
                !ativos.isEmpty(),
                temItemEmAberto);

        switch (para) {
            case AGENDADO -> {
                if (de == StatusOs.AGUARDANDO_APROVACAO) {
                    os.setAprovadoEm(agora);
                    eventoService.registrar(oficinaId, os.getId(), EventoService.ORCAMENTO_APROVADO,
                            "Orcamento aprovado pelo cliente.", true);
                }
                encerrarParadaAberta(os, agora);
            }
            case EM_EXECUCAO -> {
                if (os.getInicioExecucaoEm() == null) {
                    os.setInicioExecucaoEm(agora);
                }
                if (config.flag(oficinaId, Chaves.EXIGIR_APROVACAO) && os.getAprovadoEm() == null) {
                    os.setAprovadoEm(agora);
                }
                encerrarParadaAberta(os, agora);
                if (config.flag(oficinaId, Chaves.COMP_AUTOMATICO)) {
                    compartilhamentoService.garantirLink(os);
                }
            }
            case PAUSADO -> {
                MotivoParada motivo = resolverMotivoParada(req, oficinaId);
                encerrarApontamentosAbertos(os, agora, "OS pausada");
                abrirParada(os, motivo, req, agora);
            }
            case PRONTO_AGUARDANDO_RETIRADA -> {
                encerrarApontamentosAbertos(os, agora, "Servico concluido");
                encerrarParadaAberta(os, agora);
                os.setProntoEm(agora);
            }
            case ENTREGUE -> {
                encerrarApontamentosAbertos(os, agora, "Veiculo entregue");
                encerrarParadaAberta(os, agora);
                os.setEntregueEm(agora);
                // libera a vaga fisica: e este evento que esvazia o patio
                os.setBox(null);
            }
            case CANCELADO -> {
                encerrarApontamentosAbertos(os, agora, "OS cancelada");
                encerrarParadaAberta(os, agora);
                os.setCanceladoEm(agora);
                os.setMotivoCancelamento(req.descricao());
                os.setBox(null);
            }
            default -> {
                // RECEBIDO / EM_DIAGNOSTICO / AGUARDANDO_APROVACAO nao tem efeito colateral
            }
        }

        os.setStatus(para);
        repository.save(os);

        eventoService.registrar(oficinaId, os.getId(), EventoService.STATUS_ALTERADO,
                "%s -> %s".formatted(de.descricao(), para.descricao()),
                true, Map.of("de", de.name(), "para", para.name()));

        return detalhe(os.getId());
    }

    private MotivoParada resolverMotivoParada(OsDtos.TransicaoRequisicao req, UUID oficinaId) {
        if (req.motivoParadaId() == null) {
            if (config.flag(oficinaId, Chaves.EXIGIR_MOTIVO_PAUSA)) {
                throw new RegraNegocioException(
                        "Informe o motivo da parada (falta de peca, aprovacao, terceiro...).");
            }
            return null;
        }
        MotivoParada motivo = motivoParadaRepository.findById(req.motivoParadaId())
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Motivo de parada", req.motivoParadaId()));
        exigirMesmaOficina(motivo.getOficinaId(), oficinaId);
        return motivo;
    }

    private void abrirParada(OrdemServico os, MotivoParada motivo,
                             OsDtos.TransicaoRequisicao req, OffsetDateTime agora) {
        if (motivo == null) {
            return;
        }
        if (paradaRepository.abertaDaOs(os.getId()).isPresent()) {
            return;
        }
        boolean visivel = req.visivelCliente() != null
                ? req.visivelCliente()
                : motivo.isVisivelClientePadrao();

        Parada parada = new Parada();
        parada.setOficinaId(os.getOficinaId());
        parada.setOrdemServicoId(os.getId());
        parada.setMotivoParada(motivo);
        parada.setInicio(agora);
        parada.setDescricao(req.descricao());
        parada.setVisivelCliente(visivel);
        paradaRepository.save(parada);

        eventoService.registrar(os.getOficinaId(), os.getId(), EventoService.SERVICO_PAUSADO,
                "Servico pausado: " + motivo.getNome(), visivel,
                Map.of("motivo", motivo.getNome(), "categoria", motivo.getCategoria().name()));
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

    private void encerrarApontamentosAbertos(OrdemServico os, OffsetDateTime agora, String motivo) {
        for (OsItem item : os.getItens()) {
            apontamentoRepository.abertoDoItem(item.getId()).ifPresent(apontamento -> {
                apontamento.setFim(agora);
                apontamento.setObservacao(motivo);
                apontamentoRepository.save(apontamento);
                if (item.getStatus() == StatusItem.EM_EXECUCAO) {
                    item.setStatus(StatusItem.PAUSADO);
                    itemRepository.save(item);
                }
            });
        }
    }

    // ================================================================ edicao

    @Transactional
    public OsDtos.Detalhe atualizar(UUID id, OsDtos.AtualizacaoRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        contexto.exigirGerencia();
        OrdemServico os = buscarComItens(id, oficinaId);

        if (req.queixa() != null) {
            os.setQueixa(req.queixa());
        }
        if (req.diagnostico() != null) {
            os.setDiagnostico(req.diagnostico());
        }
        if (req.prioridade() != null) {
            os.setPrioridade(req.prioridade());
        }
        if (req.previsaoEntrega() != null) {
            os.setPrevisaoEntrega(req.previsaoEntrega());
        }
        if (req.kmEntrada() != null) {
            os.setKmEntrada(req.kmEntrada());
        }
        if (req.valorPecas() != null) {
            os.setValorPecas(req.valorPecas());
        }
        if (req.valorMaoObra() != null) {
            os.setValorMaoObra(req.valorMaoObra());
        }
        if (req.desconto() != null) {
            os.setDesconto(req.desconto());
        }
        repository.save(os);
        return detalhe(id);
    }

    @Transactional
    public OsDtos.Detalhe alocar(UUID id, OsDtos.AlocacaoRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        if (!contexto.gerencia() && !config.flag(oficinaId, Chaves.MECANICO_REALOCA)) {
            throw new AccessDeniedException("Seu perfil nao pode mexer na agenda. "
                    + "O dono pode liberar isso em Configuracoes > Fluxo.");
        }
        OrdemServico os = buscarComItens(id, oficinaId);
        if (os.getStatus().finalizada()) {
            throw new RegraNegocioException("OS ja finalizada nao pode ser reagendada.");
        }

        os.setDataAgendada(req.dataAgendada());
        os.setBox(req.boxId() == null ? null : buscarBox(req.boxId(), oficinaId));
        if (os.getStatus() == StatusOs.RECEBIDO && req.dataAgendada() != null
                && !config.flag(oficinaId, Chaves.EXIGIR_APROVACAO)) {
            os.setStatus(StatusOs.AGENDADO);
        }
        repository.save(os);

        eventoService.registrar(oficinaId, os.getId(), EventoService.AGENDAMENTO,
                req.dataAgendada() == null
                        ? "Retirado da agenda."
                        : "Agendado para %s%s".formatted(req.dataAgendada(),
                        os.getBox() == null ? "" : " no " + os.getBox().getNome()),
                true);

        return detalhe(id);
    }

    @Transactional
    public OsDtos.Detalhe adicionarItem(UUID id, OsDtos.ItemRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        contexto.exigirGerencia();
        OrdemServico os = buscarComItens(id, oficinaId);
        if (os.getStatus().finalizada()) {
            throw new RegraNegocioException("OS ja finalizada nao aceita novos servicos.");
        }

        OsItem item = construirItem(req, oficinaId);
        os.adicionarItem(item);
        recalcularMaoObra(os);
        repository.save(os);

        eventoService.registrar(oficinaId, os.getId(), EventoService.ITEM_ADICIONADO,
                "Servico adicionado: " + item.getDescricao(), true);
        return detalhe(id);
    }

    @Transactional
    public OsDtos.Detalhe removerItem(UUID id, UUID itemId) {
        UUID oficinaId = contexto.oficinaId();
        contexto.exigirGerencia();
        OrdemServico os = buscarComItens(id, oficinaId);

        OsItem item = os.getItens().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Item da OS", itemId));

        if (apontamentoRepository.abertoDoItem(itemId).isPresent()) {
            throw new RegraNegocioException("Este servico tem apontamento em andamento. Pause antes de remover.");
        }

        // servico que ja teve trabalho apontado e cancelado, nunca apagado:
        // o historico de horas precisa sobreviver.
        BigDecimal trabalhadas = apontamentoRepository.listarPorOs(id).stream()
                .filter(a -> a.getOsItem().getId().equals(itemId))
                .map(a -> a.horas(OffsetDateTime.now(clock)))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (trabalhadas.signum() > 0) {
            item.setStatus(StatusItem.CANCELADO);
            itemRepository.save(item);
        } else {
            os.getItens().remove(item);
        }
        recalcularMaoObra(os);
        repository.save(os);

        eventoService.registrar(oficinaId, os.getId(), EventoService.ITEM_REMOVIDO,
                "Servico removido: " + item.getDescricao(), false);
        return detalhe(id);
    }

    @Transactional
    public OsDtos.Detalhe atribuir(UUID id, UUID itemId, OsDtos.AtribuicaoRequisicao req) {
        UUID oficinaId = contexto.oficinaId();
        contexto.exigirGerencia();
        OrdemServico os = buscarComItens(id, oficinaId);

        OsItem item = os.getItens().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Item da OS", itemId));

        Funcionario funcionario = funcionarioRepository.findById(req.funcionarioId())
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Funcionario", req.funcionarioId()));
        exigirMesmaOficina(funcionario.getOficinaId(), oficinaId);

        if (!funcionario.isAtivo()) {
            throw new RegraNegocioException("Funcionario inativo nao pode receber servicos.");
        }
        if (item.getEspecialidade() != null && !funcionario.atende(item.getEspecialidade().getId())) {
            throw new RegraNegocioException(
                    "%s nao tem a especialidade '%s'. Ajuste o cadastro do funcionario ou escolha outro."
                            .formatted(funcionario.getNome(), item.getEspecialidade().getNome()));
        }

        item.setFuncionario(funcionario);
        itemRepository.save(item);

        eventoService.registrar(oficinaId, os.getId(), EventoService.ITEM_ATRIBUIDO,
                "%s ficou responsavel por '%s'".formatted(funcionario.getNome(), item.getDescricao()),
                false);
        return detalhe(id);
    }

    /**
     * A mao de obra da OS e a soma dos itens nao cancelados. Sem isso o dono
     * ve total zerado mesmo com servico no catalogo tendo preco.
     * Nao sobrescreve um valor informado a mao quando nenhum item tem preco.
     */
    private void recalcularMaoObra(OrdemServico os) {
        boolean algumItemComValor = os.getItens().stream()
                .anyMatch(i -> i.getStatus() != StatusItem.CANCELADO && i.getValor() != null);
        if (!algumItemComValor) {
            return;
        }
        BigDecimal total = os.getItens().stream()
                .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                .map(i -> i.getValor() == null ? BigDecimal.ZERO : i.getValor())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        os.setValorMaoObra(total);
    }

    private OsItem construirItem(OsDtos.ItemRequisicao req, UUID oficinaId) {
        OsItem item = new OsItem();
        item.setOficinaId(oficinaId);

        if (req.catalogoServicoId() != null) {
            CatalogoServico servico = catalogoRepository.findById(req.catalogoServicoId())
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Servico", req.catalogoServicoId()));
            exigirMesmaOficina(servico.getOficinaId(), oficinaId);
            // Guardar a origem: e ela que diz se o servico sobe o carro.
            item.setCatalogoServico(servico);
            item.setDescricao(req.descricao() == null || req.descricao().isBlank()
                    ? servico.getDescricao() : req.descricao());
            item.setEspecialidade(servico.getEspecialidade());
            item.setHorasEstimadas(req.horasEstimadas() != null ? req.horasEstimadas() : servico.getHorasPadrao());
            item.setValor(req.valor() != null ? req.valor() : servico.getPrecoSugerido());
        } else {
            if (req.descricao() == null || req.descricao().isBlank()) {
                throw new RegraNegocioException("Descreva o servico ou escolha um item do catalogo.");
            }
            item.setDescricao(req.descricao());
            item.setHorasEstimadas(req.horasEstimadas() != null ? req.horasEstimadas() : BigDecimal.ONE);
            item.setValor(req.valor());
        }

        if (req.especialidadeId() != null) {
            Especialidade especialidade = especialidadeRepository.findById(req.especialidadeId())
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Especialidade", req.especialidadeId()));
            exigirMesmaOficina(especialidade.getOficinaId(), oficinaId);
            item.setEspecialidade(especialidade);
        }

        if (req.funcionarioId() != null) {
            Funcionario funcionario = funcionarioRepository.findById(req.funcionarioId())
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Funcionario", req.funcionarioId()));
            exigirMesmaOficina(funcionario.getOficinaId(), oficinaId);
            item.setFuncionario(funcionario);
        }
        return item;
    }

    // ================================================================ consultas

    @Transactional(readOnly = true)
    public OsDtos.Detalhe detalhe(UUID id) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = buscarComItens(id, oficinaId);
        OffsetDateTime agora = OffsetDateTime.now(clock);

        List<Apontamento> apontamentos = apontamentoRepository.listarPorOs(id);
        Map<UUID, BigDecimal> horasPorItem = new HashMap<>();
        Map<UUID, Apontamento> abertoPorItem = new HashMap<>();
        for (Apontamento a : apontamentos) {
            UUID itemId = a.getOsItem().getId();
            horasPorItem.merge(itemId, a.horas(agora), BigDecimal::add);
            if (a.aberto()) {
                abertoPorItem.put(itemId, a);
            }
        }

        List<OsDtos.ItemResposta> itens = os.getItens().stream()
                .sorted(Comparator.comparingInt(OsItem::getOrdem))
                .map(i -> {
                    Apontamento aberto = abertoPorItem.get(i.getId());
                    return new OsDtos.ItemResposta(
                            i.getId(),
                            i.getDescricao(),
                            i.getEspecialidade() == null ? null : i.getEspecialidade().getId(),
                            i.getEspecialidade() == null ? null : i.getEspecialidade().getNome(),
                            i.getEspecialidade() == null ? null : i.getEspecialidade().getCor(),
                            i.getHorasEstimadas(),
                            horasPorItem.getOrDefault(i.getId(), BigDecimal.ZERO)
                                    .setScale(2, RoundingMode.HALF_UP),
                            i.getFuncionario() == null ? null : i.getFuncionario().getId(),
                            i.getFuncionario() == null ? null : i.getFuncionario().getNome(),
                            i.getStatus(),
                            i.getStatus().descricao(),
                            i.getValor(),
                            aberto != null,
                            aberto == null ? null : aberto.getInicio());
                })
                .toList();

        List<OsDtos.ApontamentoResposta> apontamentosDto = apontamentos.stream()
                .map(a -> new OsDtos.ApontamentoResposta(
                        a.getId(),
                        a.getOsItem().getId(),
                        a.getOsItem().getDescricao(),
                        a.getFuncionario().getId(),
                        a.getFuncionario().getNome(),
                        a.getInicio(),
                        a.getFim(),
                        a.horas(agora),
                        a.getHorasEstimadasInformadas(),
                        a.getObservacao(),
                        a.isEncerradoAutomaticamente()))
                .toList();

        List<OsDtos.ParadaResposta> paradas = paradaRepository.listarPorOs(id).stream()
                .map(p -> new OsDtos.ParadaResposta(
                        p.getId(),
                        p.getMotivoParada().getId(),
                        p.getMotivoParada().getNome(),
                        p.getMotivoParada().getCategoria(),
                        p.getInicio(),
                        p.getFim(),
                        p.horas(agora),
                        p.getDescricao(),
                        p.isVisivelCliente()))
                .toList();

        List<OsDtos.PecaResposta> pecas = pecaRepository.findByOrdemServicoIdOrderByCriadoEm(id).stream()
                .map(p -> new OsDtos.PecaResposta(
                        p.getId(), p.getDescricao(), p.getQuantidade(), p.getFornecedor(),
                        p.getStatus(), p.getStatus().descricao(), p.getPrevisaoChegada(),
                        p.getValorUnitario(), p.total()))
                .toList();

        List<OsDtos.ChecklistResposta> checklist = checklistRepository
                .findByOrdemServicoIdOrderByOrdem(id).stream()
                .map(c -> new OsDtos.ChecklistResposta(c.getId(), c.getDescricao(), c.getOk(), c.getObservacao()))
                .toList();

        List<OsDtos.ArquivoResposta> arquivos = arquivoRepository
                .findByOrdemServicoIdOrderByCriadoEm(id).stream()
                .map(a -> new OsDtos.ArquivoResposta(
                        a.getId(), a.getNomeOriginal(), "/api/os/%s/arquivos/%s".formatted(id, a.getId()),
                        a.getMomento(), a.isVisivelCliente(), a.getCriadoEm()))
                .toList();

        return new OsDtos.Detalhe(
                resumoFactory.montarUm(oficinaId, os),
                os.getDiagnostico(),
                os.getKmEntrada(),
                os.getEntradaEm(),
                os.getAprovadoEm(),
                os.getInicioExecucaoEm(),
                os.getProntoEm(),
                os.getEntregueEm(),
                os.getValorPecas(),
                os.getValorMaoObra(),
                os.getDesconto(),
                os.valorTotal(),
                List.copyOf(MaquinaEstadosOs.proximos(os.getStatus())),
                itens,
                apontamentosDto,
                paradas,
                pecas,
                checklist,
                arquivos,
                eventoService.listar(id),
                compartilhamentoService.resumoDoLink(os));
    }

    @Transactional(readOnly = true)
    public Page<OsDtos.Resumo> listar(List<StatusOs> status, String busca, Pageable pageable) {
        UUID oficinaId = contexto.oficinaId();
        List<StatusOs> filtro = status == null || status.isEmpty()
                ? List.of(StatusOs.values())
                : status;
        Page<OrdemServico> pagina = repository.buscar(oficinaId, filtro, busca, pageable);
        List<OsDtos.Resumo> conteudo = resumoFactory.montar(oficinaId, pagina.getContent());
        return new org.springframework.data.domain.PageImpl<>(conteudo, pageable, pagina.getTotalElements());
    }

    /** Radar de carros parados: o que o dono precisa ver primeiro de manha. */
    @Transactional(readOnly = true)
    public List<OsDtos.Resumo> radarParados() {
        UUID oficinaId = contexto.oficinaId();
        return resumoFactory.montar(oficinaId, repository.noPatio(oficinaId)).stream()
                .filter(r -> !r.alertas().isEmpty())
                .sorted(Comparator
                        .comparing((OsDtos.Resumo r) -> r.alertas().stream()
                                .anyMatch(a -> "ALTA".equals(a.severidade())) ? 0 : 1)
                        .thenComparing(OsDtos.Resumo::diasSemMovimentacao, Comparator.reverseOrder()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OsDtos.Resumo> noPatio() {
        UUID oficinaId = contexto.oficinaId();
        return resumoFactory.montar(oficinaId, repository.noPatio(oficinaId));
    }

    @Transactional(readOnly = true)
    public List<OsDtos.Resumo> historicoDoVeiculo(UUID veiculoId) {
        UUID oficinaId = contexto.oficinaId();
        return resumoFactory.montar(oficinaId, repository.historicoDoVeiculo(veiculoId));
    }

    // ================================================================ apoio

    public OrdemServico buscarComItens(UUID id, UUID oficinaId) {
        OrdemServico os = repository.buscarComItens(id)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Ordem de servico", id));
        exigirMesmaOficina(os.getOficinaId(), oficinaId);
        return os;
    }

    private Box buscarBox(UUID boxId, UUID oficinaId) {
        Box box = boxRepository.findById(boxId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Box", boxId));
        exigirMesmaOficina(box.getOficinaId(), oficinaId);
        if (!box.isAtivo()) {
            throw new RegraNegocioException("O box '%s' esta inativo.".formatted(box.getNome()));
        }
        return box;
    }

    private void exigirMesmaOficina(UUID daEntidade, UUID daSessao) {
        if (!daEntidade.equals(daSessao)) {
            throw new AccessDeniedException("Registro de outra oficina.");
        }
    }

    @Transactional
    public void adicionarPeca(UUID osId, PecaOs peca) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = buscarComItens(osId, oficinaId);
        peca.setOficinaId(oficinaId);
        peca.setOrdemServicoId(os.getId());
        pecaRepository.save(peca);
        eventoService.registrar(oficinaId, os.getId(), EventoService.PECA_SOLICITADA,
                "Peca solicitada: " + peca.getDescricao(), true);
    }
}
