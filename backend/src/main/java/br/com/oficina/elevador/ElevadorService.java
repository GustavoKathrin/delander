package br.com.oficina.elevador;

import br.com.oficina.agenda.CapacidadeService;
import br.com.oficina.cadastro.Box;
import br.com.oficina.cadastro.BoxRepository;
import br.com.oficina.cadastro.TipoBox;
import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoAlteradaEvent;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.ordemservico.EventoService;
import br.com.oficina.ordemservico.OrdemServico;
import br.com.oficina.ordemservico.OrdemServicoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * O elevador.
 *
 * Duas responsabilidades, bem separadas aqui dentro:
 *
 *  a) a AGENDA, que corre em HORA. A vaga e ocupada por dia — o carro dorme
 *     na oficina — mas um alinhamento de 1h nao pode travar o elevador das 8h
 *     as 18h. Por isso reserva com horario e duracao.
 *
 *  b) o PARAMETRO de quantidade, que reconcilia as linhas de box do tipo
 *     ELEVADOR quando o dono muda "quantos elevadores a oficina tem".
 *
 * Invariante que mantem a agenda coerente com a planta do patio: uma reserva
 * EM_USO so existe com a OS alocada naquele box. Elevador levantado implica
 * vaga ocupada, sempre — os dois relogios nunca divergem porque um depende do
 * outro.
 */
@Service
public class ElevadorService {

    private static final BigDecimal HORAS_PADRAO = BigDecimal.ONE;
    private static final int PASSO_MINUTOS = 15;
    private static final int DIAS_HORIZONTE = 30;

    private final ReservaElevadorRepository repository;
    private final OrdemServicoRepository osRepository;
    private final BoxRepository boxRepository;
    private final CapacidadeService capacidadeService;
    private final ConfiguracaoService config;
    private final EventoService eventoService;
    private final Contexto contexto;
    private final Clock clock;

    public ElevadorService(ReservaElevadorRepository repository,
                           OrdemServicoRepository osRepository,
                           BoxRepository boxRepository,
                           CapacidadeService capacidadeService,
                           ConfiguracaoService config,
                           EventoService eventoService,
                           Contexto contexto,
                           Clock clock) {
        this.repository = repository;
        this.osRepository = osRepository;
        this.boxRepository = boxRepository;
        this.capacidadeService = capacidadeService;
        this.config = config;
        this.eventoService = eventoService;
        this.contexto = contexto;
        this.clock = clock;
    }

    // ================================================================= agenda

    @Transactional(readOnly = true)
    public List<ReservaElevador> agenda(UUID oficinaId) {
        return repository.vivas(oficinaId);
    }

    @Transactional(readOnly = true)
    public Optional<ReservaElevador> reservaDaOs(UUID osId) {
        return repository.vivaDaOs(osId);
    }

    @Transactional(readOnly = true)
    public Map<UUID, ReservaElevador> reservasDasOs(List<UUID> osIds) {
        if (osIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, ReservaElevador> porOs = new LinkedHashMap<>();
        repository.vivasDasOs(osIds).forEach(r -> porOs.put(r.getOrdemServicoId(), r));
        return porOs;
    }

    /**
     * Primeiro horario em que o servico de N horas cabe inteiro naquele
     * elevador, respeitando a jornada da oficina.
     *
     * Servico de 3h as 17h nao termina as 20h: transborda para a abertura do
     * proximo dia util. E o mesmo criterio de dias de funcionamento que a
     * capacidade ja usa — nao um calendario novo.
     */
    @Transactional(readOnly = true)
    public OffsetDateTime primeiroHorarioLivre(UUID oficinaId, UUID boxId, BigDecimal horas) {
        return primeiroHorarioLivre(oficinaId, boxId, horas, repository.vivas(oficinaId), null);
    }

    private OffsetDateTime primeiroHorarioLivre(UUID oficinaId,
                                                UUID boxId,
                                                BigDecimal horas,
                                                List<ReservaElevador> ocupacoes,
                                                UUID ignorarReservaId) {
        BigDecimal duracao = normalizarHoras(horas);
        long minutos = duracao.multiply(BigDecimal.valueOf(60)).longValue();

        LocalTime abre = config.hora(oficinaId, Chaves.HORA_ABERTURA, LocalTime.of(8, 0));
        LocalTime fecha = config.hora(oficinaId, Chaves.HORA_FECHAMENTO, LocalTime.of(18, 0));

        List<ReservaElevador> doBox = ocupacoes.stream()
                .filter(r -> r.getBox().getId().equals(boxId))
                .filter(r -> ignorarReservaId == null || !r.getId().equals(ignorarReservaId))
                .toList();

        OffsetDateTime agora = OffsetDateTime.now(clock);
        LocalDate dia = agora.toLocalDate();

        for (int i = 0; i <= DIAS_HORIZONTE; i++, dia = dia.plusDays(1)) {
            if (!capacidadeService.funcionaEm(oficinaId, dia)) {
                continue;
            }
            OffsetDateTime abertura = agora.with(dia).with(abre).truncatedTo(ChronoUnit.MINUTES);
            OffsetDateTime fechamento = agora.with(dia).with(fecha).truncatedTo(ChronoUnit.MINUTES);

            OffsetDateTime candidato = abertura.isBefore(agora) ? arredondar(agora) : abertura;
            while (!candidato.plusMinutes(minutos).isAfter(fechamento)) {
                OffsetDateTime alvo = candidato;
                boolean livre = doBox.stream().noneMatch(r -> r.conflitaCom(alvo, duracao));
                if (livre) {
                    return candidato;
                }
                candidato = candidato.plusMinutes(PASSO_MINUTOS);
            }
        }
        return null;
    }

    /**
     * A fila: quem precisa do elevador e ainda nao subiu, com o horario
     * previsto de cada um.
     *
     * A simulacao e gulosa como a da fila de espera: cada carro consome o
     * primeiro horario que couber, e por isso o segundo so sobe quando o
     * primeiro desce.
     */
    @Transactional(readOnly = true)
    public FilaCalculada fila(UUID oficinaId) {
        List<Box> elevadores = capacidadeService.elevadores(oficinaId);
        List<ReservaElevador> vivas = repository.vivas(oficinaId);

        // Copia mutavel: a simulacao vai "reservando" horarios conforme anda.
        List<ReservaElevador> ocupacoes = new ArrayList<>(vivas);

        List<UUID> jaTemReserva = vivas.stream().map(ReservaElevador::getOrdemServicoId).toList();

        List<Previsao> previsoes = new ArrayList<>();
        for (OrdemServico os : osRepository.precisandoElevador(oficinaId)) {
            if (jaTemReserva.contains(os.getId())) {
                continue;
            }
            BigDecimal horas = horasDeElevador(os);

            OffsetDateTime melhor = null;
            Box melhorBox = null;
            for (Box elevador : elevadores) {
                OffsetDateTime quando =
                        primeiroHorarioLivre(oficinaId, elevador.getId(), horas, ocupacoes, null);
                if (quando != null && (melhor == null || quando.isBefore(melhor))) {
                    melhor = quando;
                    melhorBox = elevador;
                }
            }
            previsoes.add(new Previsao(os, horas, melhorBox, melhor));

            if (melhor != null) {
                ocupacoes.add(simulada(oficinaId, melhorBox, os.getId(), melhor, horas));
            }
        }

        return new FilaCalculada(elevadores, vivas, previsoes);
    }

    // ================================================================= acoes

    @Transactional
    public ReservaElevador reservar(UUID osId, UUID boxId, OffsetDateTime inicio, BigDecimal horas) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = buscarOs(osId, oficinaId);
        Box elevador = buscarElevador(boxId, oficinaId);

        BigDecimal duracao = horas != null && horas.signum() > 0 ? horas : horasDeElevador(os);
        OffsetDateTime quando = inicio != null
                ? inicio
                : primeiroHorarioLivre(oficinaId, boxId, duracao);
        if (quando == null) {
            throw new RegraNegocioException(
                    "Nao ha horario livre no %s nos proximos %d dias.".formatted(elevador.getNome(), DIAS_HORIZONTE));
        }

        ReservaElevador existente = repository.vivaDaOs(osId).orElse(null);
        List<ReservaElevador> ocupacoes = repository.vivas(oficinaId);
        UUID ignorar = existente == null ? null : existente.getId();

        ReservaElevador conflito = ocupacoes.stream()
                .filter(r -> r.getBox().getId().equals(boxId))
                .filter(r -> ignorar == null || !r.getId().equals(ignorar))
                .filter(r -> r.conflitaCom(quando, duracao))
                .findFirst()
                .orElse(null);
        if (conflito != null) {
            throw new RegraNegocioException(
                    "O %s ja esta reservado nesse horario para o %s."
                            .formatted(elevador.getNome(), placa(conflito.getOrdemServicoId(), oficinaId)));
        }

        ReservaElevador reserva = existente != null ? existente : new ReservaElevador();
        reserva.setOficinaId(oficinaId);
        reserva.setBox(elevador);
        reserva.setOrdemServicoId(osId);
        reserva.setInicioPrevisto(quando);
        reserva.setHorasPrevistas(duracao);
        if (reserva.getStatus() != StatusReserva.EM_USO) {
            reserva.setStatus(StatusReserva.RESERVADO);
        }

        // Reservar elevador implica precisar de elevador: o contrario deixaria
        // o carro reservado e fora da fila ao mesmo tempo.
        if (!os.isPrecisaElevador()) {
            os.setPrecisaElevador(true);
            osRepository.save(os);
        }

        ReservaElevador salva = repository.save(reserva);
        eventoService.registrar(oficinaId, osId, EventoService.AGENDAMENTO,
                "Elevador reservado: %s, %s por %s".formatted(
                        elevador.getNome(), formatar(quando), formatarHoras(duracao)),
                false);
        return salva;
    }

    /** Poe o carro em cima agora. Aloca a OS no box na mesma transacao. */
    @Transactional
    public ReservaElevador subir(UUID osId, UUID boxId) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = buscarOs(osId, oficinaId);
        Box elevador = buscarElevador(boxId, oficinaId);

        repository.emUsoNoBox(boxId).ifPresent(ocupante -> {
            throw new RegraNegocioException(
                    "O %s esta com o %s. Desca esse carro antes de subir outro."
                            .formatted(elevador.getNome(), placa(ocupante.getOrdemServicoId(), oficinaId)));
        });

        OffsetDateTime agora = OffsetDateTime.now(clock);
        ReservaElevador reserva = repository.vivaDaOs(osId).orElseGet(ReservaElevador::new);
        reserva.setOficinaId(oficinaId);
        reserva.setBox(elevador);
        reserva.setOrdemServicoId(osId);
        if (reserva.getInicioPrevisto() == null) {
            reserva.setInicioPrevisto(agora);
        }
        if (reserva.getHorasPrevistas() == null || reserva.getHorasPrevistas().signum() <= 0) {
            reserva.setHorasPrevistas(horasDeElevador(os));
        }
        reserva.setInicioReal(agora);
        reserva.setFimReal(null);
        reserva.setStatus(StatusReserva.EM_USO);

        // A invariante: elevador levantado exige o carro naquela vaga.
        os.setBox(elevador);
        if (os.getDataAgendada() == null) {
            os.setDataAgendada(agora.toLocalDate());
        }
        os.setPrecisaElevador(true);
        osRepository.save(os);

        ReservaElevador salva = repository.save(reserva);
        eventoService.registrar(oficinaId, osId, EventoService.AGENDAMENTO,
                "Subiu no %s".formatted(elevador.getNome()), false);
        return salva;
    }

    @Transactional
    public ReservaElevador descer(UUID osId) {
        UUID oficinaId = contexto.oficinaId();
        buscarOs(osId, oficinaId);

        ReservaElevador reserva = repository.vivaDaOs(osId)
                .filter(r -> r.getStatus() == StatusReserva.EM_USO)
                .orElseThrow(() -> new RegraNegocioException("Este carro nao esta no elevador."));

        OffsetDateTime agora = OffsetDateTime.now(clock);
        reserva.setFimReal(agora);
        reserva.setStatus(StatusReserva.CONCLUIDO);

        ReservaElevador salva = repository.save(reserva);
        eventoService.registrar(oficinaId, osId, EventoService.AGENDAMENTO,
                "Desceu do %s apos %s".formatted(
                        reserva.getBox().getNome(), formatarHoras(reserva.horasNoElevador(agora))),
                false);
        return salva;
    }

    @Transactional
    public void cancelar(UUID osId) {
        UUID oficinaId = contexto.oficinaId();
        buscarOs(osId, oficinaId);

        repository.vivaDaOs(osId).ifPresent(reserva -> {
            if (reserva.getStatus() == StatusReserva.EM_USO) {
                throw new RegraNegocioException(
                        "O carro esta no %s. Desca antes de cancelar a reserva."
                                .formatted(reserva.getBox().getNome()));
            }
            reserva.setStatus(StatusReserva.CANCELADO);
            repository.save(reserva);
            eventoService.registrar(oficinaId, osId, EventoService.AGENDAMENTO,
                    "Reserva de elevador cancelada", false);
        });
    }

    /** Liga/desliga a marcacao de "precisa elevador" numa OS ja aberta. */
    @Transactional
    public OrdemServico marcar(UUID osId, boolean precisa) {
        UUID oficinaId = contexto.oficinaId();
        OrdemServico os = buscarOs(osId, oficinaId);

        if (!precisa) {
            repository.vivaDaOs(osId).ifPresent(reserva -> {
                if (reserva.getStatus() == StatusReserva.EM_USO) {
                    throw new RegraNegocioException(
                            "O carro esta no %s. Desca antes de tirar a marcacao."
                                    .formatted(reserva.getBox().getNome()));
                }
                reserva.setStatus(StatusReserva.CANCELADO);
                repository.save(reserva);
            });
        }
        os.setPrecisaElevador(precisa);
        return osRepository.save(os);
    }

    /**
     * Horas que o carro fica em cima: soma dos itens cujo servico de catalogo
     * exige elevador. Sem nenhum, cai no padrao — e sempre editavel, porque
     * quem sabe quanto tempo o carro fica la e o mecanico.
     */
    public BigDecimal horasDeElevador(OrdemServico os) {
        BigDecimal soma = os.getItens().stream()
                .filter(i -> i.getCatalogoServico() != null && i.getCatalogoServico().isExigeElevador())
                .map(i -> i.getHorasEstimadas() == null ? BigDecimal.ZERO : i.getHorasEstimadas())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return soma.signum() > 0 ? soma.setScale(2, RoundingMode.HALF_UP) : HORAS_PADRAO;
    }

    // ================================================== parametro de quantidade

    /**
     * Reage ao dono mudar "quantos elevadores a oficina tem".
     *
     * BEFORE_COMMIT de proposito: recusar aqui derruba a transacao inteira, e
     * o parametro nao fica salvo apontando para um box que nao existe. O valor
     * vem do evento, e nao do ConfiguracaoService, porque ler pelo servico
     * encheria o cache com um numero que o rollback ainda pode desfazer.
     */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void aoAlterarConfiguracao(ConfiguracaoAlteradaEvent evento) {
        if (!evento.tocou(Chaves.QTD_ELEVADORES)) {
            return;
        }
        sincronizarQuantidade(evento.oficinaId(), evento.inteiro(Chaves.QTD_ELEVADORES, 0));
    }

    /**
     * Roda na transacao de quem chamou — o ouvinte acima, ou um teste. Sem
     * {@code @Transactional} de proposito: a chamada de dentro desta classe
     * nao passa pelo proxy, entao a anotacao daria uma garantia falsa.
     */
    public void sincronizarQuantidade(UUID oficinaId, int desejado) {
        if (desejado < 0) {
            throw new RegraNegocioException("A quantidade de elevadores nao pode ser negativa.");
        }

        List<Box> daOficina = boxRepository.findByOficinaIdOrderByNome(oficinaId);
        List<Box> todos = daOficina.stream()
                .filter(b -> b.getTipo() == TipoBox.ELEVADOR)
                .toList();
        // Ordenar pelo NUMERO do nome, nao pelo nome: em ordem alfabetica
        // "Elevador 10" vem antes de "Elevador 2", e reduzir tiraria o errado.
        List<Box> ativos = todos.stream().filter(Box::isAtivo)
                .sorted(Comparator.comparingInt(ElevadorService::numeroDoNome)
                        .thenComparing(Box::getNome))
                .toList();

        if (ativos.size() == desejado) {
            return;
        }

        if (ativos.size() < desejado) {
            criar(oficinaId, daOficina, desejado - ativos.size());
            return;
        }

        // Reduzir: tira do fim, e so o que estiver vazio.
        List<Box> sobrando = ativos.subList(desejado, ativos.size());
        for (Box elevador : sobrando) {
            exigirVazio(oficinaId, elevador);
            elevador.setAtivo(false);
            boxRepository.save(elevador);
        }
    }

    /**
     * O nome tem que ser conferido contra TODOS os boxes da oficina, nao so os
     * elevadores: uk_box_nome e por oficina, entao um box comum chamado
     * "Elevador 3" faria o insert estourar.
     */
    private void criar(UUID oficinaId, List<Box> daOficina, int quantos) {
        int criados = 0;
        int numero = 1;
        while (criados < quantos && numero < 100) {
            final String nome = "Elevador " + numero;
            Box comEsseNome = daOficina.stream()
                    .filter(b -> b.getNome().equalsIgnoreCase(nome))
                    .findFirst()
                    .orElse(null);

            if (comEsseNome == null) {
                Box novo = new Box();
                novo.setOficinaId(oficinaId);
                novo.setNome(nome);
                novo.setTipo(TipoBox.ELEVADOR);
                novo.setAtivo(true);
                boxRepository.save(novo);
                criados++;
            } else if (comEsseNome.getTipo() != TipoBox.ELEVADOR) {
                // Nunca converter em silencio uma vaga que o dono configurou.
                throw new RegraNegocioException(
                        ("Ja existe uma vaga chamada '%s' que nao e elevador. "
                                + "Renomeie essa vaga antes de aumentar a quantidade.").formatted(nome));
            } else if (!comEsseNome.isAtivo()) {
                // Reativar, nunca inserir de novo: uk_box_nome recusaria.
                comEsseNome.setAtivo(true);
                boxRepository.save(comEsseNome);
                criados++;
            }
            numero++;
        }
        if (criados < quantos) {
            throw new RegraNegocioException("Nao foi possivel criar todos os elevadores pedidos.");
        }
    }

    /** "Elevador 10" -> 10. Sem numero, vai para o fim. */
    private static int numeroDoNome(Box box) {
        String digitos = box.getNome().replaceAll("\\D+", "");
        if (digitos.isEmpty() || digitos.length() > 6) {
            return Integer.MAX_VALUE;
        }
        return Integer.parseInt(digitos);
    }

    private void exigirVazio(UUID oficinaId, Box elevador) {
        repository.emUsoNoBox(elevador.getId()).ifPresent(reserva -> {
            throw new RegraNegocioException(
                    "O %s esta com o %s. Desca o carro antes de reduzir a quantidade."
                            .formatted(elevador.getNome(), placa(reserva.getOrdemServicoId(), oficinaId)));
        });

        LocalDate hoje = LocalDate.now(clock);
        capacidadeService.ocupacoes(oficinaId).stream()
                .filter(o -> o.boxId().equals(elevador.getId()))
                .filter(o -> o.ocupaEm(hoje))
                .findFirst()
                .ifPresent(o -> {
                    throw new RegraNegocioException(
                            "O %s esta com o %s. Tire o carro antes de reduzir a quantidade."
                                    .formatted(elevador.getNome(), placa(o.osId(), oficinaId)));
                });
    }

    // ================================================================= apoio

    private OrdemServico buscarOs(UUID osId, UUID oficinaId) {
        OrdemServico os = osRepository.buscarComItens(osId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Ordem de servico", osId));
        if (!os.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }
        return os;
    }

    private Box buscarElevador(UUID boxId, UUID oficinaId) {
        Box box = boxRepository.findById(boxId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Box", boxId));
        if (!box.getOficinaId().equals(oficinaId)) {
            throw new RegraNegocioException("Registro de outra oficina.");
        }
        if (box.getTipo() != TipoBox.ELEVADOR) {
            throw new RegraNegocioException("%s nao e um elevador.".formatted(box.getNome()));
        }
        if (!box.isAtivo()) {
            throw new RegraNegocioException("%s esta desativado.".formatted(box.getNome()));
        }
        return box;
    }

    private String placa(UUID osId, UUID oficinaId) {
        return osRepository.findById(osId)
                .filter(o -> o.getOficinaId().equals(oficinaId))
                .map(o -> o.getVeiculo().getPlaca())
                .orElse("outro carro");
    }

    private ReservaElevador simulada(UUID oficinaId, Box box, UUID osId,
                                     OffsetDateTime inicio, BigDecimal horas) {
        ReservaElevador fake = new ReservaElevador();
        fake.setOficinaId(oficinaId);
        fake.setBox(box);
        fake.setOrdemServicoId(osId);
        fake.setInicioPrevisto(inicio);
        fake.setHorasPrevistas(horas);
        fake.setStatus(StatusReserva.RESERVADO);
        return fake;
    }

    private static BigDecimal normalizarHoras(BigDecimal horas) {
        return horas == null || horas.signum() <= 0 ? HORAS_PADRAO : horas;
    }

    private OffsetDateTime arredondar(OffsetDateTime momento) {
        OffsetDateTime limpo = momento.truncatedTo(ChronoUnit.MINUTES);
        int resto = limpo.getMinute() % PASSO_MINUTOS;
        return resto == 0 ? limpo : limpo.plusMinutes(PASSO_MINUTOS - resto);
    }

    private String formatar(OffsetDateTime momento) {
        return "%02d/%02d %02d:%02d".formatted(
                momento.getDayOfMonth(), momento.getMonthValue(),
                momento.getHour(), momento.getMinute());
    }

    private static String formatarHoras(BigDecimal horas) {
        if (horas == null || horas.signum() <= 0) {
            return "0min";
        }
        int minutos = horas.multiply(BigDecimal.valueOf(60)).intValue();
        int h = minutos / 60;
        int m = minutos % 60;
        if (h == 0) {
            return m + "min";
        }
        return m == 0 ? h + "h" : "%dh%02d".formatted(h, m);
    }

    /** O carro da fila com o elevador e o horario que a simulacao achou. */
    public record Previsao(OrdemServico os, BigDecimal horas, Box box, OffsetDateTime inicio) {
    }

    /** Resultado cru da fila; quem monta DTO e o AgendaService. */
    public record FilaCalculada(List<Box> elevadores,
                                List<ReservaElevador> vivas,
                                List<Previsao> previsoes) {
    }
}
