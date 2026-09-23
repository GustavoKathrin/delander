package br.com.oficina.metrica;

import br.com.oficina.agenda.AgendaDtos;
import br.com.oficina.agenda.AgendaService;
import br.com.oficina.agenda.CapacidadeService;
import br.com.oficina.apontamento.ApontamentoRepository;
import br.com.oficina.cadastro.BoxRepository;
import br.com.oficina.cadastro.CategoriaParada;
import br.com.oficina.common.Contexto;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import br.com.oficina.ordemservico.StatusOs;
import br.com.oficina.parada.ParadaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * As metricas que respondem a pergunta central: por que o patio nao esvazia?
 *
 * A resposta quase nunca e "falta mecanico". Costuma ser a diferenca entre
 * PERMANENCIA (dias que o carro fica aqui) e MAO DE OBRA (horas de trabalho
 * que ele recebeu). O aproveitamento compara as duas.
 */
@Service
public class MetricaService {

    private final OrdemServicoRepository osRepository;
    private final ApontamentoRepository apontamentoRepository;
    private final ParadaRepository paradaRepository;
    private final BoxRepository boxRepository;
    private final CapacidadeService capacidadeService;
    private final AgendaService agendaService;
    private final ConfiguracaoService config;
    private final Contexto contexto;
    private final Clock clock;

    public MetricaService(OrdemServicoRepository osRepository,
                          ApontamentoRepository apontamentoRepository,
                          ParadaRepository paradaRepository,
                          BoxRepository boxRepository,
                          CapacidadeService capacidadeService,
                          AgendaService agendaService,
                          ConfiguracaoService config,
                          Contexto contexto,
                          Clock clock) {
        this.osRepository = osRepository;
        this.apontamentoRepository = apontamentoRepository;
        this.paradaRepository = paradaRepository;
        this.boxRepository = boxRepository;
        this.capacidadeService = capacidadeService;
        this.agendaService = agendaService;
        this.config = config;
        this.contexto = contexto;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public MetricaDtos.Painel painel(LocalDate de, LocalDate ate) {
        LocalDate hoje = LocalDate.now(clock);
        LocalDate inicio = de != null ? de : hoje.minusDays(29);
        LocalDate fim = ate != null ? ate : hoje;

        return new MetricaDtos.Painel(
                resumo(inicio, fim),
                pareto(inicio, fim),
                throughput(fim, 8),
                mecanicos(inicio, fim));
    }

    // ------------------------------------------------------------------ resumo

    @Transactional(readOnly = true)
    public MetricaDtos.Resumo resumo(LocalDate de, LocalDate ate) {
        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);
        OffsetDateTime inicio = de.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
        OffsetDateTime fim = ate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();

        List<OrdemServico> patio = osRepository.noPatio(oficinaId);

        long emExecucao = patio.stream().filter(o -> o.getStatus() == StatusOs.EM_EXECUCAO).count();
        long aguardando = patio.stream().filter(o -> o.getStatus().aguardando()).count();
        List<OrdemServico> prontos = patio.stream()
                .filter(o -> o.getStatus() == StatusOs.PRONTO_AGUARDANDO_RETIRADA)
                .toList();

        long diasMedioRetirada = prontos.isEmpty() ? 0
                : Math.round(prontos.stream()
                .mapToLong(o -> o.diasAguardandoRetirada(agora))
                .average().orElse(0));

        // Ocupacao vem da fonte unica, nao de "tem box_id".
        //
        // Contar toda OS com box marcado fazia um carro agendado para a semana
        // que vem aparecer como ocupando hoje: o painel dizia "ocupado" e a
        // planta mostrava a mesma vaga como RESERVADO/livre. E exatamente a
        // divergencia contra a qual o comentario de CapacidadeService.ocupacoes
        // avisa.
        LocalDate hojeData = LocalDate.now(clock);
        AgendaDtos.CapacidadeDia hojeCapacidade =
                capacidadeService.capacidadeDoPeriodo(oficinaId, hojeData, hojeData).get(hojeData);
        int boxesTotal = hojeCapacidade.boxesTotal();
        int boxesOcupados = hojeCapacidade.boxesOcupados();
        int ocupacao = boxesTotal == 0 ? 0 : boxesOcupados * 100 / boxesTotal;

        // Mesma fila que o patio mostra: o painel nao pode discordar da planta.
        AgendaDtos.FilaElevador elevador = agendaService.filaElevador(oficinaId);

        long recebidos = osRepository.contarRecebidas(oficinaId, inicio, fim);
        long entregues = osRepository.contarEntregues(oficinaId, inicio, fim);

        BigDecimal backlog = patio.stream()
                .filter(o -> o.getStatus() != StatusOs.PRONTO_AGUARDANDO_RETIRADA)
                .map(OrdemServico::horasEstimadas)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<UUID, BigDecimal> horasTrabalhadas = new HashMap<>();
        List<OrdemServico> entreguesLista = osRepository.entreguesNoPeriodo(oficinaId, inicio, fim);
        if (!entreguesLista.isEmpty()) {
            List<UUID> ids = entreguesLista.stream().map(OrdemServico::getId).toList();
            for (Object[] linha : apontamentoRepository.horasPorOs(ids, agora)) {
                horasTrabalhadas.put((UUID) linha[0], new BigDecimal(linha[1].toString()));
            }
        }

        BigDecimal permanenciaTotalDias = BigDecimal.ZERO;
        BigDecimal maoObraTotal = BigDecimal.ZERO;
        BigDecimal horasUteisTotal = BigDecimal.ZERO;
        BigDecimal horasUteisPorDia = config.decimal(oficinaId, Chaves.HORAS_UTEIS_POR_DIA, new BigDecimal("8"));
        List<Integer> diasFuncionamento = config.diasFuncionamento(oficinaId);

        for (OrdemServico os : entreguesLista) {
            BigDecimal horas = horasTrabalhadas.getOrDefault(os.getId(), BigDecimal.ZERO);
            maoObraTotal = maoObraTotal.add(horas);
            permanenciaTotalDias = permanenciaTotalDias
                    .add(BigDecimal.valueOf(Math.max(os.diasPermanencia(agora), 1)));

            long diasUteis = contarDiasUteis(
                    os.getEntradaEm().toLocalDate(),
                    os.getEntregueEm() == null ? agora.toLocalDate() : os.getEntregueEm().toLocalDate(),
                    diasFuncionamento);
            horasUteisTotal = horasUteisTotal.add(
                    horasUteisPorDia.multiply(BigDecimal.valueOf(Math.max(diasUteis, 1))));
        }

        int quantidade = entreguesLista.size();
        BigDecimal permanenciaMedia = quantidade == 0 ? BigDecimal.ZERO
                : permanenciaTotalDias.divide(BigDecimal.valueOf(quantidade), 1, RoundingMode.HALF_UP);
        BigDecimal maoObraMedia = quantidade == 0 ? BigDecimal.ZERO
                : maoObraTotal.divide(BigDecimal.valueOf(quantidade), 1, RoundingMode.HALF_UP);

        // aproveitamento: das horas uteis em que o carro ficou aqui, quantas
        // viraram trabalho de verdade. Baixo = carro parado esperando algo.
        int aproveitamento = horasUteisTotal.signum() == 0 ? 0
                : maoObraTotal.multiply(BigDecimal.valueOf(100))
                .divide(horasUteisTotal, 0, RoundingMode.HALF_UP).intValue();

        BigDecimal horasParadoMedia = BigDecimal.ZERO;
        if (!entreguesLista.isEmpty()) {
            List<UUID> ids = entreguesLista.stream().map(OrdemServico::getId).toList();
            BigDecimal total = BigDecimal.ZERO;
            for (Object[] linha : paradaRepository.horasParadasPorOs(ids, agora)) {
                total = total.add(new BigDecimal(linha[1].toString()));
            }
            horasParadoMedia = total.divide(BigDecimal.valueOf(entreguesLista.size()), 1, RoundingMode.HALF_UP);
        }

        int limiteEstouro = config.inteiro(oficinaId, Chaves.PERCENTUAL_ESTOURO, 20);
        long comEstouro = 0;
        BigDecimal estimadasTotal = BigDecimal.ZERO;
        for (OrdemServico os : entreguesLista) {
            BigDecimal estimadas = os.horasEstimadas();
            BigDecimal reais = horasTrabalhadas.getOrDefault(os.getId(), BigDecimal.ZERO);
            estimadasTotal = estimadasTotal.add(estimadas);
            if (estimadas.signum() > 0) {
                int pct = reais.multiply(BigDecimal.valueOf(100))
                        .divide(estimadas, 0, RoundingMode.HALF_UP).intValue();
                if (pct > 100 + limiteEstouro) {
                    comEstouro++;
                }
            }
        }
        int aderencia = estimadasTotal.signum() == 0 ? 100
                : Math.min(estimadasTotal.multiply(BigDecimal.valueOf(100))
                .divide(maoObraTotal.signum() == 0 ? BigDecimal.ONE : maoObraTotal, 0,
                        RoundingMode.HALF_UP).intValue(), 999);

        List<AgendaDtos.Sugestao> folgas = capacidadeService.sugerirDatas(oficinaId, BigDecimal.ONE, 1);

        return new MetricaDtos.Resumo(
                patio.size(),
                emExecucao,
                aguardando,
                prontos.size(),
                diasMedioRetirada,
                ocupacao,
                boxesTotal,
                boxesOcupados,
                elevador.total(),
                elevador.total() - elevador.livresAgora(),
                elevador.itens().size(),
                recebidos,
                entregues,
                recebidos - entregues,
                backlog.setScale(1, RoundingMode.HALF_UP),
                permanenciaMedia,
                maoObraMedia,
                aproveitamento,
                horasParadoMedia,
                aderencia,
                comEstouro,
                folgas.isEmpty() ? null : folgas.get(0));
    }

    private long contarDiasUteis(LocalDate inicio, LocalDate fim, List<Integer> diasFuncionamento) {
        long total = 0;
        for (LocalDate data = inicio; !data.isAfter(fim); data = data.plusDays(1)) {
            if (diasFuncionamento.contains(data.getDayOfWeek().getValue())) {
                total++;
            }
        }
        return total;
    }

    // ------------------------------------------------------------------ pareto

    @Transactional(readOnly = true)
    public List<MetricaDtos.ItemPareto> pareto(LocalDate de, LocalDate ate) {
        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);
        OffsetDateTime inicio = de.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
        OffsetDateTime fim = ate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();

        List<Object[]> linhas = paradaRepository.paretoPorMotivo(oficinaId, inicio, fim, agora);

        BigDecimal total = BigDecimal.ZERO;
        for (Object[] linha : linhas) {
            total = total.add(new BigDecimal(linha[3].toString()));
        }

        List<MetricaDtos.ItemPareto> resultado = new ArrayList<>();
        int acumulado = 0;
        for (Object[] linha : linhas) {
            BigDecimal horas = new BigDecimal(linha[3].toString()).setScale(1, RoundingMode.HALF_UP);
            int percentual = total.signum() == 0 ? 0
                    : horas.multiply(BigDecimal.valueOf(100))
                    .divide(total, 0, RoundingMode.HALF_UP).intValue();
            acumulado = Math.min(acumulado + percentual, 100);
            resultado.add(new MetricaDtos.ItemPareto(
                    (String) linha[0],
                    CategoriaParada.valueOf((String) linha[1]),
                    ((Number) linha[2]).longValue(),
                    horas,
                    percentual,
                    acumulado));
        }
        return resultado;
    }

    // ------------------------------------------------------------------ fluxo

    /**
     * Recebidos x entregues por semana. Se a barra de recebidos fica
     * sistematicamente acima da de entregues, o patio enche - e nenhuma
     * contratacao resolve isso sozinha.
     */
    @Transactional(readOnly = true)
    public List<MetricaDtos.Throughput> throughput(LocalDate referencia, int semanas) {
        UUID oficinaId = contexto.oficinaId();
        LocalDate base = referencia != null ? referencia : LocalDate.now(clock);
        LocalDate fimSemanaAtual = base.plusDays(7L - base.getDayOfWeek().getValue());

        List<MetricaDtos.Throughput> resultado = new ArrayList<>();
        for (int i = semanas - 1; i >= 0; i--) {
            LocalDate fimSemana = fimSemanaAtual.minusWeeks(i);
            LocalDate inicioSemana = fimSemana.minusDays(6);
            OffsetDateTime de = inicioSemana.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
            OffsetDateTime ate = fimSemana.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();

            resultado.add(new MetricaDtos.Throughput(
                    inicioSemana,
                    fimSemana,
                    osRepository.contarRecebidas(oficinaId, de, ate),
                    osRepository.contarEntregues(oficinaId, de, ate)));
        }
        return resultado;
    }

    // ------------------------------------------------------------------ equipe

    @Transactional(readOnly = true)
    public List<MetricaDtos.ItemMecanico> mecanicos(LocalDate de, LocalDate ate) {
        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);
        OffsetDateTime inicio = de.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
        OffsetDateTime fim = ate.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();

        List<MetricaDtos.ItemMecanico> resultado = new ArrayList<>();
        for (Object[] linha : apontamentoRepository.produtividadePorMecanico(oficinaId, inicio, fim, agora)) {
            BigDecimal horas = new BigDecimal(linha[2].toString()).setScale(1, RoundingMode.HALF_UP);
            BigDecimal estimadas = new BigDecimal(linha[3].toString()).setScale(1, RoundingMode.HALF_UP);
            int aderencia = horas.signum() == 0 ? 100
                    : estimadas.multiply(BigDecimal.valueOf(100))
                    .divide(horas, 0, RoundingMode.HALF_UP).intValue();
            resultado.add(new MetricaDtos.ItemMecanico(
                    (String) linha[0],
                    ((Number) linha[1]).longValue(),
                    horas,
                    estimadas,
                    aderencia));
        }
        return resultado;
    }
}
