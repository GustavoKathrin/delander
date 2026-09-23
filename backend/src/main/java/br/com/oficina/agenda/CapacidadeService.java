package br.com.oficina.agenda;

import br.com.oficina.cadastro.Box;
import br.com.oficina.cadastro.BoxRepository;
import br.com.oficina.cadastro.TipoBox;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.funcionario.Funcionario;
import br.com.oficina.funcionario.FuncionarioRepository;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Motor de capacidade.
 *
 * A capacidade real de uma oficina e o menor entre tres limites:
 *   1. horas de mao de obra disponiveis no dia (soma da jornada dos mecanicos ativos);
 *   2. vagas fisicas (boxes ativos);
 *   3. teto de carros por dia/semana/mes definido pelo dono.
 *
 * Cada um desses limites pode ser ligado ou desligado em Configuracoes.
 */
@Service
public class CapacidadeService {

    private static final String[] DIAS_PT = {
            "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"
    };

    private final OrdemServicoRepository osRepository;
    private final FuncionarioRepository funcionarioRepository;
    private final BoxRepository boxRepository;
    private final ConfiguracaoService config;
    private final Clock clock;

    public CapacidadeService(OrdemServicoRepository osRepository,
                             FuncionarioRepository funcionarioRepository,
                             BoxRepository boxRepository,
                             ConfiguracaoService config,
                             Clock clock) {
        this.osRepository = osRepository;
        this.funcionarioRepository = funcionarioRepository;
        this.boxRepository = boxRepository;
        this.config = config;
        this.clock = clock;
    }

    /** Horas de mao de obra que a oficina tem em um dia de funcionamento. */
    @Transactional(readOnly = true)
    public BigDecimal horasDisponiveisPorDia(UUID oficinaId) {
        List<Funcionario> ativos = funcionarioRepository.findByOficinaIdAndAtivoTrueOrderByNome(oficinaId);
        if (ativos.isEmpty()) {
            return config.decimal(oficinaId, Chaves.HORAS_UTEIS_POR_DIA, new BigDecimal("8"));
        }
        return ativos.stream()
                .map(Funcionario::getHorasPorDia)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public boolean funcionaEm(UUID oficinaId, LocalDate data) {
        return config.diasFuncionamento(oficinaId).contains(data.getDayOfWeek().getValue());
    }

    /**
     * Boxes do tipo ELEVADOR, ativos.
     *
     * Recorte da mesma lista de boxes que alimenta a capacidade — nao uma
     * contagem paralela. A agenda do elevador (ElevadorService) corre em hora;
     * a ocupacao da vaga, aqui, corre em dia. Sao perguntas diferentes sobre o
     * mesmo box, e ficam coerentes porque elevador levantado exige a OS
     * alocada naquele box.
     */
    @Transactional(readOnly = true)
    public List<Box> elevadores(UUID oficinaId) {
        return boxRepository.findByOficinaIdAndAtivoTrueOrderByNome(oficinaId).stream()
                .filter(b -> b.getTipo() == TipoBox.ELEVADOR)
                .toList();
    }

    public static String nomeDoDia(LocalDate data) {
        return DIAS_PT[data.getDayOfWeek().getValue() - 1];
    }

    /**
     * De quando ate quando cada vaga esta ocupada.
     *
     * Fonte unica: a planta do patio, o semaforo do quadro e a fila de espera
     * leem daqui. Ja tivemos o painel dizendo "6/6 ocupados" enquanto a fila
     * dizia "3 livres" porque existiam duas contagens paralelas.
     *
     * A vaga fica ocupada da entrada ate a previsao de entrega; sem previsao,
     * ate o tempo estimado do servico. Carro atrasado nao libera vaga
     * retroativamente — ele esta ali; a previsao otimista e que saia amanha.
     */
    @Transactional(readOnly = true)
    public List<Ocupacao> ocupacoes(UUID oficinaId) {
        LocalDate hoje = LocalDate.now(clock);
        BigDecimal horasPorDia = config.decimal(oficinaId, Chaves.HORAS_UTEIS_POR_DIA, new BigDecimal("8"));

        List<Ocupacao> ocupacoes = new ArrayList<>();
        for (Object[] linha : osRepository.vagasOcupadas(oficinaId)) {
            UUID boxId = toUuid(linha[0]);
            LocalDate inicio = toLocalDate(linha[1]);
            LocalDate previsao = linha[2] == null ? null : toLocalDate(linha[2]);
            BigDecimal horasEstimadas = linha[3] == null
                    ? BigDecimal.ZERO
                    : new BigDecimal(linha[3].toString());
            UUID osId = toUuid(linha[4]);

            LocalDate fim = previsao != null
                    ? previsao
                    : inicio.plusDays(diasDeServico(horasEstimadas, horasPorDia));
            if (fim.isBefore(inicio)) {
                fim = inicio;
            }
            boolean atrasado = fim.isBefore(hoje);
            if (atrasado) {
                fim = hoje;
            }
            ocupacoes.add(new Ocupacao(boxId, osId, inicio, fim, atrasado));
        }
        return ocupacoes;
    }

    /** Capacidade de cada dia do intervalo, em uma unica consulta de carga. */
    @Transactional(readOnly = true)
    public Map<LocalDate, AgendaDtos.CapacidadeDia> capacidadeDoPeriodo(UUID oficinaId,
                                                                        LocalDate de,
                                                                        LocalDate ate) {
        BigDecimal horasDia = horasDisponiveisPorDia(oficinaId);
        int boxesTotal = (int) boxRepository.countByOficinaIdAndAtivoTrue(oficinaId);
        int maxCarrosDia = config.inteiro(oficinaId, Chaves.MAX_CARROS_DIA, 4);

        boolean limitarHoras = config.flag(oficinaId, Chaves.LIMITAR_POR_HORAS);
        boolean limitarBoxes = config.flag(oficinaId, Chaves.LIMITAR_POR_BOXES);
        boolean limitarQuantidade = config.flag(oficinaId, Chaves.LIMITAR_POR_QUANTIDADE);
        boolean overbooking = config.flag(oficinaId, Chaves.PERMITIR_OVERBOOKING);
        int percentualOverbooking = config.inteiro(oficinaId, Chaves.PERCENTUAL_OVERBOOKING, 0);

        BigDecimal fator = overbooking
                ? BigDecimal.ONE.add(BigDecimal.valueOf(percentualOverbooking).divide(
                BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP))
                : BigDecimal.ONE;

        Map<LocalDate, Carga> cargas = new HashMap<>();
        for (Object[] linha : osRepository.cargaPorDia(oficinaId, de, ate)) {
            LocalDate dia = toLocalDate(linha[0]);
            int carros = ((Number) linha[1]).intValue();
            BigDecimal horas = linha[2] == null
                    ? BigDecimal.ZERO
                    : new BigDecimal(linha[2].toString());
            cargas.put(dia, new Carga(carros, horas));
        }

        List<Ocupacao> ocupacoes = ocupacoes(oficinaId);

        Map<LocalDate, AgendaDtos.CapacidadeDia> resultado = new HashMap<>();
        for (LocalDate data = de; !data.isAfter(ate); data = data.plusDays(1)) {
            boolean funciona = funcionaEm(oficinaId, data);
            Carga carga = cargas.getOrDefault(data, new Carga(0, BigDecimal.ZERO));

            final LocalDate dia = data;
            int boxesOcupados = (int) ocupacoes.stream()
                    .filter(o -> o.ocupaEm(dia))
                    .map(Ocupacao::boxId)
                    .distinct()
                    .count();

            BigDecimal disponiveis = funciona
                    ? horasDia.multiply(fator).setScale(2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal alocadas = carga.horas().setScale(2, RoundingMode.HALF_UP);
            BigDecimal livres = disponiveis.subtract(alocadas).max(BigDecimal.ZERO);

            int maxCarros = funciona ? (int) Math.floor(maxCarrosDia * fator.doubleValue()) : 0;

            int pctHoras = disponiveis.signum() == 0 ? (alocadas.signum() > 0 ? 100 : 0)
                    : alocadas.multiply(BigDecimal.valueOf(100))
                    .divide(disponiveis, 0, RoundingMode.HALF_UP).intValue();
            int pctCarros = maxCarros == 0 ? (carga.carros() > 0 ? 100 : 0)
                    : carga.carros() * 100 / maxCarros;
            int pctBoxes = boxesTotal == 0 ? 0 : boxesOcupados * 100 / boxesTotal;

            int percentual = 0;
            String limitante = "livre";
            if (limitarHoras && pctHoras >= percentual) {
                percentual = pctHoras;
                limitante = "horas de mao de obra";
            }
            if (limitarQuantidade && pctCarros >= percentual) {
                percentual = pctCarros;
                limitante = "teto de carros no dia";
            }
            if (limitarBoxes && pctBoxes >= percentual) {
                percentual = pctBoxes;
                limitante = "vagas fisicas";
            }
            if (!limitarHoras && !limitarQuantidade && !limitarBoxes) {
                percentual = pctHoras;
                limitante = "sem limite configurado";
            }

            boolean cheio = funciona && percentual >= 100;
            String semaforo = !funciona ? "fechado"
                    : percentual >= 100 ? "vermelho"
                    : percentual >= 75 ? "amarelo" : "verde";

            resultado.put(data, new AgendaDtos.CapacidadeDia(
                    data, disponiveis, alocadas, livres,
                    carga.carros(), maxCarros,
                    boxesTotal, boxesOcupados,
                    percentual, semaforo, cheio, limitante));
        }
        return resultado;
    }

    /**
     * Proximas datas com folga para o servico que esta entrando.
     * Responde em um segundo a pergunta "quando da pra pegar outro carro?".
     */
    @Transactional(readOnly = true)
    public List<AgendaDtos.Sugestao> sugerirDatas(UUID oficinaId, BigDecimal horasNecessarias, int quantidade) {
        BigDecimal horas = horasNecessarias == null || horasNecessarias.signum() <= 0
                ? BigDecimal.ONE
                : horasNecessarias;

        LocalDate hoje = LocalDate.now(clock);
        LocalDate limite = hoje.plusDays(60);
        Map<LocalDate, AgendaDtos.CapacidadeDia> capacidades =
                capacidadeDoPeriodo(oficinaId, hoje, limite);

        int maxSemana = config.inteiro(oficinaId, Chaves.MAX_CARROS_SEMANA, 0);
        int maxMes = config.inteiro(oficinaId, Chaves.MAX_CARROS_MES, 0);
        boolean limitarQuantidade = config.flag(oficinaId, Chaves.LIMITAR_POR_QUANTIDADE);

        List<AgendaDtos.Sugestao> sugestoes = new ArrayList<>();
        for (LocalDate data = hoje; !data.isAfter(limite) && sugestoes.size() < quantidade;
             data = data.plusDays(1)) {

            AgendaDtos.CapacidadeDia cap = capacidades.get(data);
            if (cap == null || !funcionaEm(oficinaId, data)) {
                continue;
            }
            if (cap.cheio() || cap.horasLivres().compareTo(horas) < 0) {
                continue;
            }
            if (cap.maxCarros() > 0 && cap.carros() >= cap.maxCarros()) {
                continue;
            }
            if (cap.boxesTotal() > 0 && cap.boxesOcupados() >= cap.boxesTotal()) {
                continue;
            }
            if (limitarQuantidade && !cabeNaSemanaEnoMes(oficinaId, data, maxSemana, maxMes)) {
                continue;
            }

            int vagasLivres = cap.boxesTotal() == 0
                    ? Math.max(cap.maxCarros() - cap.carros(), 0)
                    : Math.max(cap.boxesTotal() - cap.boxesOcupados(), 0);

            sugestoes.add(new AgendaDtos.Sugestao(
                    data,
                    "%s, %02d/%02d".formatted(nomeDoDia(data), data.getDayOfMonth(), data.getMonthValue()),
                    cap.horasLivres(),
                    vagasLivres,
                    cap.percentual()));
        }
        return sugestoes;
    }

    /**
     * Simula a entrada da fila de espera: percorre os carros em ordem e coloca
     * cada um no primeiro dia em que ele cabe, consumindo a capacidade daquele
     * dia. E por isso que o terceiro da fila entra depois do primeiro — e que a
     * vaga aparece no dia em que o carro que esta nela tem previsao de sair.
     *
     * @return data prevista de entrada por OS (vazio se nao couber em 90 dias)
     */
    @Transactional(readOnly = true)
    public Map<UUID, LocalDate> simularEntradaDaFila(UUID oficinaId, List<FilaPedido> fila) {
        LocalDate hoje = LocalDate.now(clock);
        LocalDate limite = hoje.plusDays(90);
        Map<LocalDate, AgendaDtos.CapacidadeDia> capacidades = capacidadeDoPeriodo(oficinaId, hoje, limite);

        boolean limitarHoras = config.flag(oficinaId, Chaves.LIMITAR_POR_HORAS);
        boolean limitarBoxes = config.flag(oficinaId, Chaves.LIMITAR_POR_BOXES);
        boolean limitarQuantidade = config.flag(oficinaId, Chaves.LIMITAR_POR_QUANTIDADE);
        BigDecimal horasPorDia = config.decimal(oficinaId, Chaves.HORAS_UTEIS_POR_DIA, new BigDecimal("8"));

        Map<LocalDate, BigDecimal> horasLivres = new HashMap<>();
        Map<LocalDate, Integer> vagasLivres = new HashMap<>();
        Map<LocalDate, Integer> carrosLivres = new HashMap<>();
        capacidades.forEach((dia, cap) -> {
            horasLivres.put(dia, cap.horasLivres());
            vagasLivres.put(dia, Math.max(cap.boxesTotal() - cap.boxesOcupados(), 0));
            carrosLivres.put(dia, Math.max(cap.maxCarros() - cap.carros(), 0));
        });

        Map<UUID, LocalDate> previsao = new LinkedHashMap<>();

        for (FilaPedido pedido : fila) {
            BigDecimal horas = pedido.horas().signum() > 0 ? pedido.horas() : BigDecimal.ONE;
            long diasExtras = diasDeServico(horas, horasPorDia);

            for (LocalDate dia = hoje; !dia.isAfter(limite); dia = dia.plusDays(1)) {
                if (!funcionaEm(oficinaId, dia)) {
                    continue;
                }
                LocalDate ultimoDia = dia.plusDays(diasExtras);
                if (ultimoDia.isAfter(limite)) {
                    break;
                }
                if (!cabe(dia, ultimoDia, horas, horasPorDia, oficinaId,
                        horasLivres, vagasLivres, carrosLivres,
                        limitarHoras, limitarBoxes, limitarQuantidade)) {
                    continue;
                }

                consumir(dia, ultimoDia, horas, horasPorDia, oficinaId, horasLivres, vagasLivres, carrosLivres);
                previsao.put(pedido.osId(), dia);
                break;
            }
        }
        return previsao;
    }

    private boolean cabe(LocalDate inicio, LocalDate fim,
                         BigDecimal horas, BigDecimal horasPorDia, UUID oficinaId,
                         Map<LocalDate, BigDecimal> horasLivres,
                         Map<LocalDate, Integer> vagasLivres,
                         Map<LocalDate, Integer> carrosLivres,
                         boolean limitarHoras, boolean limitarBoxes, boolean limitarQuantidade) {

        if (limitarQuantidade && carrosLivres.getOrDefault(inicio, 0) < 1) {
            return false;
        }
        BigDecimal restante = horas;
        for (LocalDate dia = inicio; !dia.isAfter(fim); dia = dia.plusDays(1)) {
            if (!funcionaEm(oficinaId, dia)) {
                continue;
            }
            if (limitarBoxes && vagasLivres.getOrDefault(dia, 0) < 1) {
                return false;
            }
            if (limitarHoras) {
                BigDecimal doDia = restante.min(horasPorDia);
                if (horasLivres.getOrDefault(dia, BigDecimal.ZERO).compareTo(doDia) < 0) {
                    return false;
                }
                restante = restante.subtract(doDia).max(BigDecimal.ZERO);
            }
        }
        return true;
    }

    private void consumir(LocalDate inicio, LocalDate fim,
                          BigDecimal horas, BigDecimal horasPorDia, UUID oficinaId,
                          Map<LocalDate, BigDecimal> horasLivres,
                          Map<LocalDate, Integer> vagasLivres,
                          Map<LocalDate, Integer> carrosLivres) {

        carrosLivres.computeIfPresent(inicio, (dia, livres) -> Math.max(livres - 1, 0));

        BigDecimal restante = horas;
        for (LocalDate dia = inicio; !dia.isAfter(fim); dia = dia.plusDays(1)) {
            if (!funcionaEm(oficinaId, dia)) {
                continue;
            }
            vagasLivres.computeIfPresent(dia, (d, livres) -> Math.max(livres - 1, 0));
            BigDecimal doDia = restante.min(horasPorDia);
            final BigDecimal consumo = doDia;
            horasLivres.computeIfPresent(dia, (d, livres) -> livres.subtract(consumo).max(BigDecimal.ZERO));
            restante = restante.subtract(doDia).max(BigDecimal.ZERO);
        }
    }

    /** Primeiro dia com pelo menos uma vaga fisica livre. */
    @Transactional(readOnly = true)
    public LocalDate proximaVagaLivre(UUID oficinaId) {
        LocalDate hoje = LocalDate.now(clock);
        LocalDate limite = hoje.plusDays(90);
        Map<LocalDate, AgendaDtos.CapacidadeDia> capacidades = capacidadeDoPeriodo(oficinaId, hoje, limite);

        for (LocalDate dia = hoje; !dia.isAfter(limite); dia = dia.plusDays(1)) {
            AgendaDtos.CapacidadeDia cap = capacidades.get(dia);
            if (cap == null || !funcionaEm(oficinaId, dia)) {
                continue;
            }
            if (cap.boxesTotal() == 0 || cap.boxesOcupados() < cap.boxesTotal()) {
                return dia;
            }
        }
        return null;
    }

    public record FilaPedido(UUID osId, BigDecimal horas) {
    }

    private boolean cabeNaSemanaEnoMes(UUID oficinaId, LocalDate data, int maxSemana, int maxMes) {
        if (maxSemana > 0) {
            LocalDate inicioSemana = data.minusDays(data.getDayOfWeek().getValue() - 1L);
            long naSemana = osRepository.contarAlocadasNoPeriodo(
                    oficinaId, inicioSemana, inicioSemana.plusDays(6));
            if (naSemana >= maxSemana) {
                return false;
            }
        }
        if (maxMes > 0) {
            LocalDate inicioMes = data.withDayOfMonth(1);
            long noMes = osRepository.contarAlocadasNoPeriodo(
                    oficinaId, inicioMes, inicioMes.plusMonths(1).minusDays(1));
            return noMes < maxMes;
        }
        return true;
    }

    /** Quantos dias uteis um servico de X horas ocupa a vaga (minimo 1). */
    private long diasDeServico(BigDecimal horasEstimadas, BigDecimal horasPorDia) {
        if (horasEstimadas.signum() <= 0 || horasPorDia.signum() <= 0) {
            return 0;
        }
        long dias = (long) Math.ceil(horasEstimadas.doubleValue() / horasPorDia.doubleValue());
        return Math.max(dias, 1) - 1;
    }

    private LocalDate toLocalDate(Object valor) {
        if (valor instanceof LocalDate data) {
            return data;
        }
        if (valor instanceof java.sql.Date data) {
            return data.toLocalDate();
        }
        return LocalDate.parse(valor.toString());
    }

    private UUID toUuid(Object valor) {
        return valor instanceof UUID id ? id : UUID.fromString(valor.toString());
    }

    private record Carga(int carros, BigDecimal horas) {
    }

    /**
     * Janela em que uma vaga fica ocupada por uma OS.
     * `atrasado` = a previsao ja passou; a vaga segue ocupada e o dono precisa
     * saber que aquele numero e otimista, nao uma promessa.
     */
    public record Ocupacao(UUID boxId, UUID osId, LocalDate inicio, LocalDate fim, boolean atrasado) {

        public boolean ocupaEm(LocalDate dia) {
            return !inicio.isAfter(dia) && !fim.isBefore(dia);
        }
    }
}
