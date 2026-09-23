package br.com.oficina.agenda;

import br.com.oficina.cadastro.Box;
import br.com.oficina.cadastro.BoxRepository;
import br.com.oficina.common.Contexto;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.elevador.ElevadorService;
import br.com.oficina.elevador.ReservaElevador;
import br.com.oficina.elevador.StatusReserva;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import br.com.oficina.ordemservico.OsDtos;
import br.com.oficina.ordemservico.ResumoOsFactory;
import br.com.oficina.ordemservico.StatusOs;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Monta a planta do patio e o quadro da semana. */
@Service
public class AgendaService {

    private final OrdemServicoRepository osRepository;
    private final BoxRepository boxRepository;
    private final ResumoOsFactory resumoFactory;
    private final CapacidadeService capacidadeService;
    private final ElevadorService elevadorService;
    private final ConfiguracaoService config;
    private final Contexto contexto;
    private final Clock clock;

    public AgendaService(OrdemServicoRepository osRepository,
                         BoxRepository boxRepository,
                         ResumoOsFactory resumoFactory,
                         CapacidadeService capacidadeService,
                         ElevadorService elevadorService,
                         ConfiguracaoService config,
                         Contexto contexto,
                         Clock clock) {
        this.osRepository = osRepository;
        this.boxRepository = boxRepository;
        this.resumoFactory = resumoFactory;
        this.capacidadeService = capacidadeService;
        this.elevadorService = elevadorService;
        this.config = config;
        this.contexto = contexto;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AgendaDtos.Quadro quadro(LocalDate inicioSolicitado, int dias) {
        UUID oficinaId = contexto.oficinaId();
        LocalDate hoje = LocalDate.now(clock);
        int quantidade = dias <= 0 || dias > 31 ? 7 : dias;

        LocalDate inicio = inicioSolicitado != null
                ? inicioSolicitado
                : hoje.minusDays(hoje.getDayOfWeek().getValue() - 1L);
        LocalDate fim = inicio.plusDays(quantidade - 1L);

        List<OrdemServico> ordens = osRepository.doPeriodo(oficinaId, inicio, fim);
        Map<LocalDate, List<OsDtos.Resumo>> porDia = resumoFactory.montar(oficinaId, ordens).stream()
                .collect(Collectors.groupingBy(OsDtos.Resumo::dataAgendada));

        Map<LocalDate, AgendaDtos.CapacidadeDia> capacidades =
                capacidadeService.capacidadeDoPeriodo(oficinaId, inicio, fim);

        List<AgendaDtos.Dia> listaDias = new ArrayList<>();
        BigDecimal horasDisponiveisSemana = BigDecimal.ZERO;
        BigDecimal horasAlocadasSemana = BigDecimal.ZERO;
        int carrosSemana = 0;

        for (LocalDate data = inicio; !data.isAfter(fim); data = data.plusDays(1)) {
            AgendaDtos.CapacidadeDia capacidade = capacidades.get(data);
            List<OsDtos.Resumo> doDia = porDia.getOrDefault(data, List.of()).stream()
                    .sorted(Comparator
                            .comparingInt((OsDtos.Resumo r) -> r.alertas().stream()
                                    .anyMatch(a -> "ALTA".equals(a.severidade())) ? 0 : 1)
                            .thenComparing(r -> -r.prioridade().peso())
                            .thenComparing(OsDtos.Resumo::numero))
                    .toList();

            horasDisponiveisSemana = horasDisponiveisSemana.add(capacidade.horasDisponiveis());
            horasAlocadasSemana = horasAlocadasSemana.add(capacidade.horasAlocadas());
            carrosSemana += capacidade.carros();

            listaDias.add(new AgendaDtos.Dia(
                    data,
                    CapacidadeService.nomeDoDia(data),
                    capacidadeService.funcionaEm(oficinaId, data),
                    data.equals(hoje),
                    capacidade,
                    doDia));
        }

        List<AgendaDtos.ItemFila> fila = montarFila(oficinaId);

        // Backlog em horas: tudo que entrou e ainda nao foi trabalhado.
        BigDecimal backlog = fila.stream()
                .map(AgendaDtos.ItemFila::horasNecessarias)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        int maxCarrosSemana = config.inteiro(oficinaId, Chaves.MAX_CARROS_SEMANA, 0);
        int pctSemana = horasDisponiveisSemana.signum() == 0 ? 0
                : horasAlocadasSemana.multiply(BigDecimal.valueOf(100))
                .divide(horasDisponiveisSemana, 0, RoundingMode.HALF_UP).intValue();

        AgendaDtos.ResumoSemana semana = new AgendaDtos.ResumoSemana(
                horasDisponiveisSemana.setScale(2, RoundingMode.HALF_UP),
                horasAlocadasSemana.setScale(2, RoundingMode.HALF_UP),
                carrosSemana,
                maxCarrosSemana,
                pctSemana,
                pctSemana >= 100 ? "vermelho" : pctSemana >= 75 ? "amarelo" : "verde");

        return new AgendaDtos.Quadro(
                inicio,
                fim,
                "%02d/%02d a %02d/%02d".formatted(
                        inicio.getDayOfMonth(), inicio.getMonthValue(),
                        fim.getDayOfMonth(), fim.getMonthValue()),
                listaDias,
                fila,
                backlog,
                semana);
    }

    /**
     * Fila de espera com a data prevista de entrada de cada carro.
     * A ordem e prioridade e depois chegada; a data vem da simulacao de
     * capacidade — quando um carro sai, a vaga dele aparece para o proximo.
     */
    @Transactional(readOnly = true)
    public List<AgendaDtos.ItemFila> montarFila(UUID oficinaId) {
        List<OrdemServico> naoAlocadas = osRepository.naoAlocadas(oficinaId);
        if (naoAlocadas.isEmpty()) {
            return List.of();
        }

        List<OsDtos.Resumo> resumos = resumoFactory.montar(oficinaId, naoAlocadas);

        List<CapacidadeService.FilaPedido> pedidos = new ArrayList<>();
        for (OrdemServico os : naoAlocadas) {
            pedidos.add(new CapacidadeService.FilaPedido(os.getId(), os.horasEstimadas()));
        }
        Map<UUID, LocalDate> previsao = capacidadeService.simularEntradaDaFila(oficinaId, pedidos);

        List<AgendaDtos.ItemFila> itens = new ArrayList<>();
        int posicao = 1;
        for (OsDtos.Resumo resumo : resumos) {
            LocalDate entrada = previsao.get(resumo.id());
            itens.add(new AgendaDtos.ItemFila(
                    posicao++,
                    resumo,
                    resumo.horasEstimadas().subtract(resumo.horasTrabalhadas()).max(BigDecimal.ZERO),
                    resumo.diasNaOficina(),
                    entrada,
                    entrada == null
                            ? "sem vaga nos proximos 90 dias"
                            : "%s, %02d/%02d".formatted(CapacidadeService.nomeDoDia(entrada),
                            entrada.getDayOfMonth(), entrada.getMonthValue())));
        }
        return itens;
    }

    @Transactional(readOnly = true)
    public AgendaDtos.Fila fila() {
        UUID oficinaId = contexto.oficinaId();
        List<AgendaDtos.ItemFila> itens = montarFila(oficinaId);
        LocalDate hoje = LocalDate.now(clock);

        AgendaDtos.CapacidadeDia hojeCap =
                capacidadeService.capacidadeDoPeriodo(oficinaId, hoje, hoje).get(hoje);

        return new AgendaDtos.Fila(
                itens,
                itens.stream()
                        .map(AgendaDtos.ItemFila::horasNecessarias)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .setScale(2, RoundingMode.HALF_UP),
                capacidadeService.proximaVagaLivre(oficinaId),
                hojeCap == null ? 0 : Math.max(hojeCap.boxesTotal() - hojeCap.boxesOcupados(), 0),
                hojeCap == null ? 0 : hojeCap.boxesTotal());
    }

    /**
     * Planta do patio: cada vaga com o carro que esta dentro, a situacao e o
     * dia em que ela libera. E a tela inicial do dono — tudo numa chamada.
     */
    @Transactional(readOnly = true)
    public AgendaDtos.Patio patio() {
        UUID oficinaId = contexto.oficinaId();
        LocalDate hoje = LocalDate.now(clock);

        List<OsDtos.Resumo> noPatio = resumoFactory.montar(oficinaId, osRepository.noPatio(oficinaId));
        Map<UUID, OsDtos.Resumo> porOs = noPatio.stream()
                .collect(Collectors.toMap(OsDtos.Resumo::id, r -> r));

        Map<UUID, List<CapacidadeService.Ocupacao>> porVaga = capacidadeService.ocupacoes(oficinaId)
                .stream()
                .collect(Collectors.groupingBy(CapacidadeService.Ocupacao::boxId));

        // Reservas vivas por box, para a vaga de elevador mostrar "desce em 1h20".
        OffsetDateTime momento = OffsetDateTime.now(clock);
        Map<UUID, AgendaDtos.ReservaElevador> reservaPorBox = new LinkedHashMap<>();
        for (ReservaElevador r : elevadorService.agenda(oficinaId)) {
            // Em uso ganha da so reservada: e o que esta acontecendo agora.
            AgendaDtos.ReservaElevador atual = reservaPorBox.get(r.getBox().getId());
            if (atual == null || (r.getStatus() == StatusReserva.EM_USO && !atual.emUso())) {
                reservaPorBox.put(r.getBox().getId(), reservaDto(r, momento, hoje));
            }
        }

        List<AgendaDtos.Vaga> vagas = new ArrayList<>();
        int livres = 0;
        for (Box box : boxRepository.findByOficinaIdAndAtivoTrueOrderByNome(oficinaId)) {
            List<CapacidadeService.Ocupacao> daVaga = porVaga.getOrDefault(box.getId(), List.of());
            AgendaDtos.ReservaElevador reservaDoBox = reservaPorBox.get(box.getId());

            // Ocupada AGORA e diferente de reservada para depois: um carro que so
            // chega sexta nao pode fazer a vaga contar como cheia hoje — foi isso
            // que deixou "0/6 livres" convivendo com "proxima vaga: hoje".
            CapacidadeService.Ocupacao agora = daVaga.stream()
                    .filter(o -> o.ocupaEm(hoje))
                    .max(Comparator.comparing(CapacidadeService.Ocupacao::fim))
                    .orElse(null);

            CapacidadeService.Ocupacao reserva = agora != null ? null
                    : daVaga.stream()
                    .filter(o -> o.inicio().isAfter(hoje))
                    .min(Comparator.comparing(CapacidadeService.Ocupacao::inicio))
                    .orElse(null);

            if (agora == null) {
                livres++;
            }

            if (agora == null && reserva == null) {
                vagas.add(new AgendaDtos.Vaga(box.getId(), box.getNome(), box.getTipo(),
                        null, "LIVRE", "vaga livre", null, null, null, reservaDoBox,
                        box.getLayoutColuna(), box.getLayoutLinha(),
                        box.getLayoutLargura(), box.getLayoutAltura()));
                continue;
            }

            if (agora == null) {
                OsDtos.Resumo futuro = porOs.get(reserva.osId());
                vagas.add(new AgendaDtos.Vaga(box.getId(), box.getNome(), box.getTipo(),
                        futuro, "RESERVADO",
                        "livre agora, reservada",
                        null, reserva.inicio(),
                        "chega " + rotuloDeData(reserva.inicio(), hoje), reservaDoBox,
                        box.getLayoutColuna(), box.getLayoutLinha(),
                        box.getLayoutLargura(), box.getLayoutAltura()));
                continue;
            }

            OsDtos.Resumo ocupante = porOs.get(agora.osId());
            if (ocupante == null) {
                livres++;
                vagas.add(new AgendaDtos.Vaga(box.getId(), box.getNome(), box.getTipo(),
                        null, "LIVRE", "vaga livre", null, null, null, reservaDoBox,
                        box.getLayoutColuna(), box.getLayoutLinha(),
                        box.getLayoutLargura(), box.getLayoutAltura()));
                continue;
            }

            LocalDate liberaEm = agora.fim();
            vagas.add(new AgendaDtos.Vaga(
                    box.getId(),
                    box.getNome(),
                    box.getTipo(),
                    ocupante,
                    situacaoDe(ocupante),
                    rotuloDaSituacao(ocupante, hoje),
                    ocupante.paradaMotivo(),
                    liberaEm,
                    // previsao vencida nao vira "libera hoje": vira "atrasado",
                    // senao a planta promete vaga que ninguem garante.
                    agora.atrasado() ? "atrasado" : rotuloDeData(liberaEm, hoje),
                    reservaDoBox,
                    box.getLayoutColuna(), box.getLayoutLinha(),
                    box.getLayoutLargura(), box.getLayoutAltura()));
        }

        // carros que estao na oficina mas sem vaga marcada
        Set<UUID> comVaga = vagas.stream()
                .filter(v -> !v.livre())
                .map(v -> v.ocupante().id())
                .collect(Collectors.toSet());
        List<OsDtos.Resumo> semVaga = noPatio.stream()
                .filter(r -> !comVaga.contains(r.id()))
                .filter(r -> r.dataAgendada() != null)
                .toList();

        List<AgendaDtos.ItemFila> fila = montarFila(oficinaId);
        LocalDate proxima = capacidadeService.proximaVagaLivre(oficinaId);

        return new AgendaDtos.Patio(
                vagas,
                semVaga,
                fila,
                livres,
                vagas.size(),
                proxima,
                proxima == null ? "sem vaga em 90 dias" : rotuloDeData(proxima, hoje),
                fila.stream()
                        .map(AgendaDtos.ItemFila::horasNecessarias)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .setScale(2, RoundingMode.HALF_UP),
                filaElevador(oficinaId));
    }

    private String situacaoDe(OsDtos.Resumo os) {
        if (os.paradaMotivo() != null) {
            return "PARADO";
        }
        return switch (os.status()) {
            case EM_EXECUCAO -> "EM_EXECUCAO";
            case PAUSADO -> "PARADO";
            case PRONTO_AGUARDANDO_RETIRADA -> "PRONTO";
            case AGUARDANDO_APROVACAO, EM_DIAGNOSTICO -> "AGUARDANDO";
            default -> "AGENDADO";
        };
    }

    private String rotuloDaSituacao(OsDtos.Resumo os, LocalDate hoje) {
        if (os.status() == StatusOs.PRONTO_AGUARDANDO_RETIRADA) {
            long dias = os.diasAguardandoRetirada();
            return dias <= 0 ? "pronto, aguardando retirada"
                    : "pronto ha %d dia(s), ninguem buscou".formatted(dias);
        }
        if (os.paradaMotivo() != null) {
            return os.paradaMotivo().toLowerCase();
        }
        if (os.status() == StatusOs.EM_EXECUCAO) {
            String mecanico = os.mecanicos().isEmpty() ? "" : " · " + os.mecanicos().get(0).split(" ")[0];
            return "em execucao" + mecanico;
        }
        return os.statusDescricao().toLowerCase();
    }

    /** "hoje", "amanha" ou "qui 24/09" — o dono le mais rapido que uma data seca. */
    private String rotuloDeData(LocalDate data, LocalDate hoje) {
        if (data.isEqual(hoje)) {
            return "hoje";
        }
        if (data.isEqual(hoje.plusDays(1))) {
            return "amanha";
        }
        return "%s %02d/%02d".formatted(CapacidadeService.nomeDoDia(data).substring(0, 3),
                data.getDayOfMonth(), data.getMonthValue());
    }

    // ============================================================ elevador

    /**
     * A fila do elevador em DTO.
     *
     * A montagem mora aqui, e nao no ElevadorService, porque o resumoFactory
     * ja esta neste servico — evita o elevador depender da OS so para desenhar
     * um card.
     */
    @Transactional(readOnly = true)
    public AgendaDtos.FilaElevador filaElevador() {
        return filaElevador(contexto.oficinaId());
    }

    public AgendaDtos.FilaElevador filaElevador(UUID oficinaId) {
        ElevadorService.FilaCalculada calculada = elevadorService.fila(oficinaId);
        OffsetDateTime agora = OffsetDateTime.now(clock);
        LocalDate hoje = agora.toLocalDate();

        List<AgendaDtos.ReservaElevador> emUso = calculada.vivas().stream()
                .filter(r -> r.getStatus() == StatusReserva.EM_USO)
                .map(r -> reservaDto(r, agora, hoje))
                .toList();

        List<OrdemServico> ordens = calculada.previsoes().stream()
                .map(ElevadorService.Previsao::os)
                .toList();
        Map<UUID, OsDtos.Resumo> resumos = resumoFactory.montar(oficinaId, ordens).stream()
                .collect(Collectors.toMap(OsDtos.Resumo::id, r -> r));

        List<AgendaDtos.ItemFilaElevador> itens = new ArrayList<>();
        int posicao = 1;
        for (ElevadorService.Previsao p : calculada.previsoes()) {
            OsDtos.Resumo resumo = resumos.get(p.os().getId());
            if (resumo == null) {
                continue;
            }
            itens.add(new AgendaDtos.ItemFilaElevador(
                    posicao++,
                    resumo,
                    p.horas(),
                    p.box() == null ? null : p.box().getId(),
                    p.box() == null ? null : p.box().getNome(),
                    p.inicio(),
                    p.inicio() == null
                            ? "sem horario em 30 dias"
                            : "sobe %s %02d:%02d".formatted(
                                    rotuloDeData(p.inicio().toLocalDate(), hoje),
                                    p.inicio().getHour(), p.inicio().getMinute())));
        }

        int total = calculada.elevadores().size();
        int livres = total - emUso.size();

        // "Proximo livre": o mais cedo entre os elevadores que estao com carro.
        OffsetDateTime proximo = livres > 0
                ? agora
                : emUso.stream()
                        .map(AgendaDtos.ReservaElevador::terminoPrevisto)
                        .min(Comparator.naturalOrder())
                        .orElse(null);

        return new AgendaDtos.FilaElevador(itens, emUso, total, livres, proximo,
                proximo == null ? "sem elevador ativo"
                        : livres > 0 ? "livre agora" : rotuloDeMomento(proximo, agora, hoje));
    }

    private AgendaDtos.ReservaElevador reservaDto(ReservaElevador r, OffsetDateTime agora, LocalDate hoje) {
        boolean emUso = r.getStatus() == StatusReserva.EM_USO;
        OffsetDateTime termino = r.terminoPrevisto();
        String placa = osRepository.findById(r.getOrdemServicoId())
                .map(os -> os.getVeiculo().getPlaca())
                .orElse("—");

        String rotulo = emUso
                ? "desce " + rotuloDeMomento(termino, agora, hoje)
                : "sobe %s %02d:%02d".formatted(
                        rotuloDeData(r.getInicioPrevisto().toLocalDate(), hoje),
                        r.getInicioPrevisto().getHour(), r.getInicioPrevisto().getMinute());

        return new AgendaDtos.ReservaElevador(
                r.getId(), r.getBox().getId(), r.getBox().getNome(),
                r.getOrdemServicoId(), placa,
                r.getStatus().name(), r.getStatus().descricao(),
                r.getInicioPrevisto(), r.getHorasPrevistas(), termino, r.getInicioReal(),
                rotulo,
                emUso ? r.minutosRestantes(agora) : null);
    }

    /** "em 1h20", "agora" ou "passou 15min" — o dono quer o quanto falta. */
    private String rotuloDeMomento(OffsetDateTime momento, OffsetDateTime agora, LocalDate hoje) {
        long minutos = java.time.Duration.between(agora, momento).toMinutes();
        if (minutos <= -1) {
            long atraso = -minutos;
            return atraso >= 60
                    ? "passou %dh%02d".formatted(atraso / 60, atraso % 60)
                    : "passou %dmin".formatted(atraso);
        }
        if (minutos <= 1) {
            return "agora";
        }
        if (minutos < 60) {
            return "em %dmin".formatted(minutos);
        }
        if (momento.toLocalDate().isEqual(hoje)) {
            return "em %dh%02d".formatted(minutos / 60, minutos % 60);
        }
        return "%s %02d:%02d".formatted(rotuloDeData(momento.toLocalDate(), hoje),
                momento.getHour(), momento.getMinute());
    }

    @Transactional(readOnly = true)
    public List<AgendaDtos.Sugestao> sugerir(BigDecimal horas, int quantidade) {
        return capacidadeService.sugerirDatas(contexto.oficinaId(), horas,
                quantidade <= 0 || quantidade > 10 ? 3 : quantidade);
    }

    @Transactional(readOnly = true)
    public List<AgendaDtos.CapacidadeDia> capacidade(LocalDate de, LocalDate ate) {
        UUID oficinaId = contexto.oficinaId();
        LocalDate inicio = de != null ? de : LocalDate.now(clock);
        LocalDate fim = ate != null ? ate : inicio.plusDays(30);
        return capacidadeService.capacidadeDoPeriodo(oficinaId, inicio, fim).values().stream()
                .sorted(Comparator.comparing(AgendaDtos.CapacidadeDia::data))
                .toList();
    }
}
