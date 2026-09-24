package br.com.oficina.demo;

import br.com.oficina.apontamento.Apontamento;
import br.com.oficina.apontamento.ApontamentoRepository;
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
import br.com.oficina.config.AppProperties;
import br.com.oficina.funcionario.Funcionario;
import br.com.oficina.funcionario.FuncionarioRepository;
import br.com.oficina.ordemservico.EventoOs;
import br.com.oficina.ordemservico.EventoOsRepository;
import br.com.oficina.ordemservico.EventoService;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import br.com.oficina.ordemservico.OsItem;
import br.com.oficina.ordemservico.Prioridade;
import br.com.oficina.ordemservico.StatusItem;
import br.com.oficina.ordemservico.StatusOs;
import br.com.oficina.parada.Parada;
import br.com.oficina.parada.ParadaRepository;
import br.com.oficina.peca.PecaOs;
import br.com.oficina.peca.PecaOsRepository;
import br.com.oficina.peca.StatusPeca;
import br.com.oficina.usuario.Papel;
import br.com.oficina.usuario.Usuario;
import br.com.oficina.usuario.UsuarioRepository;
import br.com.oficina.veiculo.Veiculo;
import br.com.oficina.veiculo.VeiculoProprietarioHist;
import br.com.oficina.veiculo.VeiculoProprietarioHistRepository;
import br.com.oficina.veiculo.VeiculoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dados de demonstracao: a oficina abre com o quadro cheio e o dashboard
 * com numeros reais, para o dono conseguir avaliar a ferramenta clicando.
 * Controlado por APP_CARGA_DEMO (deixe false em producao).
 */
@Component
@Order(2)
public class CargaDemo implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CargaDemo.class);
    private static final UUID OFICINA = CargaInicial.OFICINA_PADRAO;
    private static final String SENHA_DEMO = "123";

    private final AppProperties props;
    private final PasswordEncoder passwordEncoder;
    private final UsuarioRepository usuarioRepository;
    private final FuncionarioRepository funcionarioRepository;
    private final EspecialidadeRepository especialidadeRepository;
    private final BoxRepository boxRepository;
    private final MotivoParadaRepository motivoRepository;
    private final CatalogoServicoRepository catalogoRepository;
    private final ClienteRepository clienteRepository;
    private final VeiculoRepository veiculoRepository;
    private final VeiculoProprietarioHistRepository historicoRepository;
    private final OrdemServicoRepository osRepository;
    private final ApontamentoRepository apontamentoRepository;
    private final ParadaRepository paradaRepository;
    private final PecaOsRepository pecaRepository;
    private final EventoOsRepository eventoRepository;
    private final TransactionTemplate transacao;

    public CargaDemo(AppProperties props,
                     PasswordEncoder passwordEncoder,
                     UsuarioRepository usuarioRepository,
                     FuncionarioRepository funcionarioRepository,
                     EspecialidadeRepository especialidadeRepository,
                     BoxRepository boxRepository,
                     MotivoParadaRepository motivoRepository,
                     CatalogoServicoRepository catalogoRepository,
                     ClienteRepository clienteRepository,
                     VeiculoRepository veiculoRepository,
                     VeiculoProprietarioHistRepository historicoRepository,
                     OrdemServicoRepository osRepository,
                     ApontamentoRepository apontamentoRepository,
                     ParadaRepository paradaRepository,
                     PecaOsRepository pecaRepository,
                     EventoOsRepository eventoRepository,
                     PlatformTransactionManager gerenciadorTransacao) {
        this.props = props;
        this.passwordEncoder = passwordEncoder;
        this.usuarioRepository = usuarioRepository;
        this.funcionarioRepository = funcionarioRepository;
        this.especialidadeRepository = especialidadeRepository;
        this.boxRepository = boxRepository;
        this.motivoRepository = motivoRepository;
        this.catalogoRepository = catalogoRepository;
        this.clienteRepository = clienteRepository;
        this.veiculoRepository = veiculoRepository;
        this.historicoRepository = historicoRepository;
        this.osRepository = osRepository;
        this.apontamentoRepository = apontamentoRepository;
        this.paradaRepository = paradaRepository;
        this.pecaRepository = pecaRepository;
        this.eventoRepository = eventoRepository;
        this.transacao = new TransactionTemplate(gerenciadorTransacao);
    }

    /**
     * Um problema nos dados de exemplo nunca deve impedir o sistema de subir:
     * se a carga falhar, ela e desfeita e a aplicacao continua normalmente.
     */
    @Override
    public void run(ApplicationArguments args) {
        if (!props.cargaDemo()) {
            return;
        }
        try {
            transacao.executeWithoutResult(status -> carregar());
        } catch (RuntimeException e) {
            log.warn("Nao foi possivel carregar os dados de demonstracao ({}). "
                    + "O sistema subiu normalmente, sem eles.", e.getMessage(), e);
        }
        // Fora do carregar(): aquele para na primeira linha se ja houver dados,
        // e o dono de demonstracao precisa existir mesmo numa base ja carregada.
        try {
            transacao.executeWithoutResult(status -> garantirDonoDeDemonstracao());
        } catch (RuntimeException e) {
            log.warn("Nao foi possivel criar o usuario de demonstracao ({}).", e.getMessage(), e);
        }
    }

    /**
     * A demonstracao precisa de uma visao de dono.
     *
     * Ate aqui a carga criava so mecanicos, e o unico DONO nascia de
     * APP_ADMIN_SENHA — a senha de producao. Resultado: mostrar o patio, o
     * painel e as configuracoes exigia a senha real, que quem esta na oficina
     * com o cliente na frente normalmente nao tem a mao. Mostrar um sistema
     * nao deveria custar a credencial de producao.
     *
     * Idempotente, e preso ao APP_CARGA_DEMO: numa instalacao de verdade, com
     * a carga desligada, este usuario nunca nasce.
     */
    private void garantirDonoDeDemonstracao() {
        String email = "demo@oficina.local";
        if (usuarioRepository.existsByEmailIgnoreCase(email)) {
            return;
        }

        Usuario dono = new Usuario();
        dono.setOficinaId(OFICINA);
        dono.setNome("Dono (demonstracao)");
        dono.setEmail(email);
        dono.setSenhaHash(passwordEncoder.encode(SENHA_DEMO));
        dono.setPapel(Papel.DONO);
        dono.setAtivo(true);
        usuarioRepository.save(dono);

        log.info("Usuario de demonstracao criado: {} (senha {})", email, SENHA_DEMO);
    }

    private void carregar() {
        if (clienteRepository.countByOficinaIdAndAtivoTrue(OFICINA) > 0) {
            return;
        }

        log.info("Carregando dados de demonstracao...");

        List<Especialidade> especialidades = especialidadeRepository.findByOficinaIdOrderByNome(OFICINA);
        List<Box> boxes = boxRepository.findByOficinaIdOrderByNome(OFICINA);
        List<MotivoParada> motivos = motivoRepository.findByOficinaIdOrderByNome(OFICINA);
        List<CatalogoServico> catalogo = catalogoRepository.listar(OFICINA);

        List<Funcionario> mecanicos = List.of(
                criarMecanico("Carlos Mendes", "carlos@oficina.local", "(11) 98811-0001",
                        especialidades, List.of("Motor", "Cambio")),
                criarMecanico("Rafael Souza", "rafael@oficina.local", "(11) 98811-0002",
                        especialidades, List.of("Eletrica", "Ar-condicionado")),
                criarMecanico("Bruno Lima", "bruno@oficina.local", "(11) 98811-0003",
                        especialidades, List.of("Suspensao", "Freios", "Revisao Geral")));

        LocalDate hoje = LocalDate.now();
        LocalDate segunda = hoje.minusDays(hoje.getDayOfWeek().getValue() - 1L);

        // ---------------------------------------------- clientes e veiculos
        Object[][] dados = {
                {"Ana Paula Ribeiro", "(11) 99120-4471", "ANA1A23", "Volkswagen", "Gol 1.6", 2018, "Prata", 78400},
                {"Marcos Antonio Silva", "(11) 99233-1180", "MAS2B34", "Chevrolet", "Onix LT", 2020, "Branco", 51200},
                {"Juliana Costa", "(11) 99411-8823", "JUC3C45", "Fiat", "Argo Drive", 2021, "Vermelho", 39800},
                {"Roberto Carvalho", "(11) 99788-2210", "ROB4D56", "Toyota", "Corolla XEi", 2019, "Preto", 96300},
                {"Fernanda Alves", "(11) 99655-7719", "FER5E67", "Hyundai", "HB20 Comfort", 2022, "Azul", 28100},
                {"Transportes Vale Ltda", "(11) 3322-4455", "TVL6F78", "Fiat", "Fiorino", 2017, "Branco", 184500},
                {"Transportes Vale Ltda", "(11) 3322-4455", "TVL7G89", "Renault", "Master", 2019, "Branco", 142300},
                {"Diego Nakamura", "(11) 99010-3344", "DIG8H90", "Honda", "Civic EXL", 2020, "Cinza", 64200},
                {"Patricia Gomes", "(11) 99544-6677", "PAT9I01", "Jeep", "Renegade", 2021, "Verde", 43900},
                {"Luiz Fernando Rocha", "(11) 99877-1122", "LUI0J12", "Ford", "Ka SE", 2016, "Prata", 121400},
                {"Camila Ferreira", "(11) 99366-8899", "CAM1K23", "Nissan", "Kicks SV", 2022, "Branco", 22700},
                {"Sergio Bastos", "(11) 99722-3355", "SER2L34", "Volkswagen", "Saveiro", 2018, "Branco", 108600}
        };

        List<Veiculo> veiculos = new ArrayList<>();
        Cliente ultimoCliente = null;
        for (Object[] linha : dados) {
            String nome = (String) linha[0];
            Cliente cliente = ultimoCliente != null && ultimoCliente.getNome().equals(nome)
                    ? ultimoCliente
                    : criarCliente(nome, (String) linha[1]);
            ultimoCliente = cliente;
            veiculos.add(criarVeiculo(cliente, (String) linha[2], (String) linha[3], (String) linha[4],
                    (Integer) linha[5], (String) linha[6], (Integer) linha[7]));
        }

        // ---------------------------------------------- OS entregues (metricas)
        entregue(veiculos.get(0), catalogo, mecanicos.get(2), boxes, hoje.minusDays(12), hoje.minusDays(10),
                "Revisao dos 80 mil km", 4.5);
        entregue(veiculos.get(3), catalogo, mecanicos.get(0), boxes, hoje.minusDays(20), hoje.minusDays(13),
                "Barulho na correia e troca de oleo", 6.0);
        entregue(veiculos.get(9), catalogo, mecanicos.get(1), boxes, hoje.minusDays(9), hoje.minusDays(8),
                "Bateria descarregando", 2.0);
        entregue(veiculos.get(10), catalogo, mecanicos.get(2), boxes, hoje.minusDays(6), hoje.minusDays(4),
                "Freio fazendo barulho", 3.0);

        // ---------------------------------------------- pronto aguardando retirada
        OrdemServico pronto = criarOs(veiculos.get(4), "Ar-condicionado sem gelar", Prioridade.NORMAL,
                hoje.minusDays(4), hoje.minusDays(1), boxes.get(4), hoje.minusDays(5));
        adicionarItem(pronto, catalogo, "Higienizacao do ar-condicionado", mecanicos.get(1),
                StatusItem.CONCLUIDO);
        adicionarItem(pronto, catalogo, "Recarga de gas do ar-condicionado", mecanicos.get(1),
                StatusItem.CONCLUIDO);
        pronto.setStatus(StatusOs.PRONTO_AGUARDANDO_RETIRADA);
        pronto.setAprovadoEm(instante(hoje.minusDays(5), 11, 0));
        pronto.setInicioExecucaoEm(instante(hoje.minusDays(4), 8, 30));
        // pronto ha 3 dias: e este contador que denuncia o patio entupido
        pronto.setProntoEm(instante(hoje.minusDays(3), 16, 20));
        osRepository.save(pronto);
        apontar(pronto, mecanicos.get(1), hoje.minusDays(4), 8, 30, 2.5);
        apontar(pronto, mecanicos.get(1), hoje.minusDays(3), 14, 0, 1.5);
        evento(pronto, EventoService.STATUS_ALTERADO, "Em execucao -> Pronto - aguardando retirada",
                instante(hoje.minusDays(3), 16, 20), true);

        // ---------------------------------------------- em execucao com cronometro rodando
        OrdemServico emExecucao = criarOs(veiculos.get(1), "Troca de embreagem", Prioridade.ALTA,
                hoje, hoje.plusDays(1), boxes.get(0), hoje.minusDays(1));
        OsItem itemEmbreagem = adicionarItem(emExecucao, catalogo, "Troca de embreagem",
                mecanicos.get(0), StatusItem.EM_EXECUCAO);
        emExecucao.setStatus(StatusOs.EM_EXECUCAO);
        emExecucao.setAprovadoEm(instante(hoje.minusDays(1), 15, 0));
        emExecucao.setInicioExecucaoEm(instante(hoje, 8, 10));
        osRepository.save(emExecucao);
        apontamentoAberto(emExecucao, itemEmbreagem, mecanicos.get(0),
                OffsetDateTime.now().minusHours(2).minusMinutes(20), new BigDecimal("6.0"));
        evento(emExecucao, EventoService.SERVICO_INICIADO,
                "Carlos Mendes comecou 'Troca de embreagem' (previsao de 6.0h)",
                OffsetDateTime.now().minusHours(2).minusMinutes(20), true);

        OrdemServico emExecucao2 = criarOs(veiculos.get(7), "Revisao completa", Prioridade.NORMAL,
                hoje, hoje.plusDays(1), boxes.get(1), hoje.minusDays(1));
        OsItem itemRevisao = adicionarItem(emExecucao2, catalogo, "Revisao completa (30 itens)",
                mecanicos.get(2), StatusItem.EM_EXECUCAO);
        emExecucao2.setStatus(StatusOs.EM_EXECUCAO);
        emExecucao2.setAprovadoEm(instante(hoje.minusDays(1), 17, 0));
        emExecucao2.setInicioExecucaoEm(instante(hoje, 9, 0));
        osRepository.save(emExecucao2);
        apontamentoAberto(emExecucao2, itemRevisao, mecanicos.get(2),
                OffsetDateTime.now().minusMinutes(50), new BigDecimal("3.0"));

        // ---------------------------------------------- pausado por falta de peca (radar)
        OrdemServico semPeca = criarOs(veiculos.get(5), "Motor perdendo forca - trocar correia",
                Prioridade.ALTA, hoje.minusDays(2), hoje.plusDays(2), boxes.get(2), hoje.minusDays(8));
        OsItem itemCorreia = adicionarItem(semPeca, catalogo, "Troca de correia dentada",
                mecanicos.get(0), StatusItem.PAUSADO);
        semPeca.setStatus(StatusOs.PAUSADO);
        semPeca.setAprovadoEm(instante(hoje.minusDays(7), 10, 0));
        semPeca.setInicioExecucaoEm(instante(hoje.minusDays(6), 8, 0));
        osRepository.save(semPeca);
        apontar(semPeca, mecanicos.get(0), hoje.minusDays(6), 8, 0, 2.0);
        abrirParada(semPeca, motivo(motivos, "Falta de peca"),
                instante(hoje.minusDays(6), 10, 0),
                "Kit de correia do Fiorino em falta no fornecedor", true);
        peca(semPeca, "Kit correia dentada + tensor", "Auto Pecas Vale",
                StatusPeca.COMPRADA, hoje.plusDays(1), new BigDecimal("420.00"));
        evento(semPeca, EventoService.SERVICO_PAUSADO,
                "Servico pausado (Falta de peca): Troca de correia dentada",
                instante(hoje.minusDays(6), 10, 0), true);

        // ---------------------------------------------- aguardando aprovacao
        OrdemServico aprovacao = criarOs(veiculos.get(8), "Suspensao batendo na frente",
                Prioridade.NORMAL, null, null, boxes.get(5), hoje.minusDays(3));
        adicionarItem(aprovacao, catalogo, "Troca de amortecedores (par)", null, StatusItem.PENDENTE);
        adicionarItem(aprovacao, catalogo, "Alinhamento e balanceamento", null, StatusItem.PENDENTE);
        aprovacao.setStatus(StatusOs.AGUARDANDO_APROVACAO);
        osRepository.save(aprovacao);
        abrirParada(aprovacao, motivo(motivos, "Aguardando aprovacao do cliente"),
                instante(hoje.minusDays(3), 14, 30),
                "Orcamento de R$ 1.180 enviado por WhatsApp", true);

        // ---------------------------------------------- agendados na semana
        agendado(veiculos.get(2), catalogo, "Troca de oleo e filtros", mecanicos.get(2),
                "Revisao preventiva", segunda.plusDays(2), boxes.get(3), hoje.minusDays(1), Prioridade.BAIXA);
        agendado(veiculos.get(6), catalogo, "Diagnostico eletronico (scanner)", mecanicos.get(1),
                "Luz de injecao acesa", segunda.plusDays(3), boxes.get(0), hoje, Prioridade.NORMAL);
        agendado(veiculos.get(11), catalogo, "Troca de discos e pastilhas", mecanicos.get(2),
                "Freio vibrando ao frear forte", segunda.plusDays(4), boxes.get(1), hoje, Prioridade.ALTA);
        agendado(veiculos.get(0), catalogo, "Reparo de chicote eletrico", mecanicos.get(1),
                "Vidro eletrico nao funciona", segunda.plusDays(4), boxes.get(2), hoje, Prioridade.NORMAL);

        // ---------------------------------------------- fila sem dia definido (backlog)
        OrdemServico fila = criarOs(veiculos.get(3), "Cliente relata consumo alto de combustivel",
                Prioridade.NORMAL, null, null, null, hoje);
        adicionarItem(fila, catalogo, "Diagnostico eletronico (scanner)", null, StatusItem.PENDENTE);
        fila.setStatus(StatusOs.RECEBIDO);
        osRepository.save(fila);

        log.info("Dados de demonstracao carregados. Acessos: {} / carlos@oficina.local / "
                + "rafael@oficina.local / bruno@oficina.local (senha {})", props.admin().email(), SENHA_DEMO);
    }

    // ================================================================ helpers

    private Funcionario criarMecanico(String nome, String email, String telefone,
                                      List<Especialidade> todas, List<String> nomesEspecialidades) {
        Usuario usuario = new Usuario();
        usuario.setOficinaId(OFICINA);
        usuario.setNome(nome);
        usuario.setEmail(email);
        usuario.setSenhaHash(passwordEncoder.encode(SENHA_DEMO));
        usuario.setPapel(Papel.MECANICO);
        usuarioRepository.save(usuario);

        Funcionario funcionario = new Funcionario();
        funcionario.setOficinaId(OFICINA);
        funcionario.setUsuarioId(usuario.getId());
        funcionario.setNome(nome);
        funcionario.setTelefone(telefone);
        funcionario.setHorasPorDia(new BigDecimal("8"));
        funcionario.setCustoHora(new BigDecimal("45.00"));
        todas.stream()
                .filter(e -> nomesEspecialidades.contains(e.getNome()))
                .forEach(e -> funcionario.getEspecialidades().add(e));
        return funcionarioRepository.save(funcionario);
    }

    private Cliente criarCliente(String nome, String telefone) {
        Cliente cliente = new Cliente();
        cliente.setOficinaId(OFICINA);
        cliente.setNome(nome);
        cliente.setTelefone(telefone);
        cliente.setConsentimentoContato(true);
        return clienteRepository.save(cliente);
    }

    private Veiculo criarVeiculo(Cliente cliente, String placa, String marca, String modelo,
                                 Integer ano, String cor, Integer km) {
        Veiculo veiculo = new Veiculo();
        veiculo.setOficinaId(OFICINA);
        veiculo.setCliente(cliente);
        veiculo.setPlaca(placa);
        veiculo.setMarca(marca);
        veiculo.setModelo(modelo);
        veiculo.setAno(ano);
        veiculo.setCor(cor);
        veiculo.setKm(km);
        Veiculo salvo = veiculoRepository.save(veiculo);

        VeiculoProprietarioHist hist = new VeiculoProprietarioHist();
        hist.setVeiculoId(salvo.getId());
        hist.setClienteId(cliente.getId());
        historicoRepository.save(hist);
        return salvo;
    }

    private OrdemServico criarOs(Veiculo veiculo, String queixa, Prioridade prioridade,
                                 LocalDate dataAgendada, LocalDate previsao, Box box, LocalDate entrada) {
        OrdemServico os = new OrdemServico();
        os.setOficinaId(OFICINA);
        os.setNumero(osRepository.proximoNumero());
        os.setCliente(veiculo.getCliente());
        os.setVeiculo(veiculo);
        os.setQueixa(queixa);
        os.setPrioridade(prioridade);
        os.setDataAgendada(dataAgendada);
        os.setPrevisaoEntrega(previsao);
        os.setBox(box);
        os.setKmEntrada(veiculo.getKm());
        os.setEntradaEm(instante(entrada, 8, 45));
        os.setStatus(StatusOs.RECEBIDO);
        OrdemServico salva = osRepository.save(os);

        evento(salva, EventoService.OS_CRIADA, "Veiculo recebido na oficina.",
                salva.getEntradaEm(), true);
        return salva;
    }

    private OsItem adicionarItem(OrdemServico os, List<CatalogoServico> catalogo,
                                 String descricao, Funcionario funcionario, StatusItem status) {
        CatalogoServico servico = catalogo.stream()
                .filter(c -> c.getDescricao().equals(descricao))
                .findFirst()
                .orElse(null);

        OsItem item = new OsItem();
        item.setDescricao(descricao);
        item.setHorasEstimadas(servico == null ? BigDecimal.ONE : servico.getHorasPadrao());
        item.setValor(servico == null ? null : servico.getPrecoSugerido());
        item.setEspecialidade(servico == null ? null : servico.getEspecialidade());
        item.setFuncionario(funcionario);
        item.setStatus(status);
        os.adicionarItem(item);

        BigDecimal maoObra = os.getItens().stream()
                .map(i -> i.getValor() == null ? BigDecimal.ZERO : i.getValor())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        os.setValorMaoObra(maoObra);
        osRepository.save(os);
        return item;
    }

    private void agendado(Veiculo veiculo, List<CatalogoServico> catalogo, String servico,
                          Funcionario mecanico, String queixa, LocalDate dia, Box box,
                          LocalDate entrada, Prioridade prioridade) {
        OrdemServico os = criarOs(veiculo, queixa, prioridade, dia, dia.plusDays(1), box, entrada);
        adicionarItem(os, catalogo, servico, mecanico, StatusItem.PENDENTE);
        os.setStatus(StatusOs.AGENDADO);
        os.setAprovadoEm(instante(entrada, 16, 0));
        osRepository.save(os);
        evento(os, EventoService.AGENDAMENTO, "Servico agendado para " + dia,
                instante(entrada, 16, 5), true);
    }

    private void entregue(Veiculo veiculo, List<CatalogoServico> catalogo, Funcionario mecanico,
                          List<Box> boxes, LocalDate entrada, LocalDate saida,
                          String queixa, double horasTrabalhadas) {
        OrdemServico os = criarOs(veiculo, queixa, Prioridade.NORMAL, entrada, saida,
                boxes.get(0), entrada);
        OsItem item = adicionarItem(os, catalogo, catalogo.get(1).getDescricao(), mecanico,
                StatusItem.CONCLUIDO);
        os.setStatus(StatusOs.ENTREGUE);
        os.setAprovadoEm(instante(entrada, 10, 0));
        os.setInicioExecucaoEm(instante(entrada, 11, 0));
        os.setProntoEm(instante(saida, 15, 0));
        os.setEntregueEm(instante(saida, 17, 30));
        os.setBox(null);
        osRepository.save(os);

        apontar(os, item, mecanico, entrada, 11, 0, horasTrabalhadas);
        evento(os, EventoService.STATUS_ALTERADO, "Pronto - aguardando retirada -> Entregue",
                instante(saida, 17, 30), true);
    }

    private void apontar(OrdemServico os, Funcionario mecanico, LocalDate dia,
                         int hora, int minuto, double horas) {
        apontar(os, os.getItens().get(0), mecanico, dia, hora, minuto, horas);
    }

    private void apontar(OrdemServico os, OsItem item, Funcionario mecanico, LocalDate dia,
                         int hora, int minuto, double horas) {
        Apontamento apontamento = new Apontamento();
        apontamento.setOficinaId(OFICINA);
        apontamento.setOrdemServicoId(os.getId());
        apontamento.setOsItem(item);
        apontamento.setFuncionario(mecanico);
        apontamento.setInicio(instante(dia, hora, minuto));
        apontamento.setFim(instante(dia, hora, minuto).plusMinutes((long) (horas * 60)));
        apontamento.setHorasEstimadasInformadas(item.getHorasEstimadas());
        apontamentoRepository.save(apontamento);
    }

    private void apontamentoAberto(OrdemServico os, OsItem item, Funcionario mecanico,
                                   OffsetDateTime inicio, BigDecimal estimativa) {
        Apontamento apontamento = new Apontamento();
        apontamento.setOficinaId(OFICINA);
        apontamento.setOrdemServicoId(os.getId());
        apontamento.setOsItem(item);
        apontamento.setFuncionario(mecanico);
        apontamento.setInicio(inicio);
        apontamento.setHorasEstimadasInformadas(estimativa);
        apontamentoRepository.save(apontamento);
    }

    private void abrirParada(OrdemServico os, MotivoParada motivo, OffsetDateTime inicio,
                             String descricao, boolean visivelCliente) {
        Parada parada = new Parada();
        parada.setOficinaId(OFICINA);
        parada.setOrdemServicoId(os.getId());
        parada.setMotivoParada(motivo);
        parada.setInicio(inicio);
        parada.setDescricao(descricao);
        parada.setVisivelCliente(visivelCliente);
        paradaRepository.save(parada);
    }

    private void peca(OrdemServico os, String descricao, String fornecedor, StatusPeca status,
                      LocalDate previsao, BigDecimal valor) {
        PecaOs peca = new PecaOs();
        peca.setOficinaId(OFICINA);
        peca.setOrdemServicoId(os.getId());
        peca.setDescricao(descricao);
        peca.setQuantidade(BigDecimal.ONE);
        peca.setFornecedor(fornecedor);
        peca.setStatus(status);
        peca.setPrevisaoChegada(previsao);
        peca.setValorUnitario(valor);
        pecaRepository.save(peca);

        os.setValorPecas(os.getValorPecas().add(valor));
        osRepository.save(os);
    }

    private void evento(OrdemServico os, String tipo, String descricao,
                        OffsetDateTime quando, boolean visivelCliente) {
        EventoOs evento = new EventoOs();
        evento.setOficinaId(OFICINA);
        evento.setOrdemServicoId(os.getId());
        evento.setTipo(tipo);
        evento.setDescricao(descricao);
        evento.setAutor("sistema");
        evento.setVisivelCliente(visivelCliente);
        evento.setCriadoEm(quando);
        evento.setDados(Map.of("demo", true));
        eventoRepository.save(evento);
    }

    private MotivoParada motivo(List<MotivoParada> motivos, String nome) {
        return motivos.stream()
                .filter(m -> m.getNome().equals(nome))
                .findFirst()
                .orElse(motivos.get(0));
    }

    private OffsetDateTime instante(LocalDate dia, int hora, int minuto) {
        return dia.atTime(LocalTime.of(hora, minuto)).atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
