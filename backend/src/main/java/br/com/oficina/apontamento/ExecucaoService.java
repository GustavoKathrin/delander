package br.com.oficina.apontamento;

import br.com.oficina.arquivo.ArquivoOs;
import br.com.oficina.arquivo.ArquivoOsRepository;
import br.com.oficina.arquivo.ArquivoService;
import br.com.oficina.common.Contexto;
import br.com.oficina.ordemservico.EventoOsRepository;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * O painel da Etapa 6: a oficina inteira, por carro, agora.
 *
 * Monta tudo em consultas de tamanho fixo -- carros na bancada, cronometros
 * abertos, paradas abertas, horas por servico, fotos dos servicos -- e nao
 * uma por cartao. A tela recarrega sozinha a cada 20 segundos; qualquer N+1
 * aqui vira carga permanente no banco de um plano gratuito que dorme.
 */
@Service
public class ExecucaoService {

    /** Limite de fotos por carro na tela. A galeria completa fica na OS. */
    private static final int FOTOS_POR_CARRO = 6;

    /**
     * A ordem da tela e a da urgencia, nao a do numero da OS.
     *
     * Primeiro o que esta parado -- carro parado e vaga ocupada sem nada
     * acontecendo, e e o que custa dinheiro --, depois o que tem gente
     * trabalhando, depois o resto. Dentro de cada grupo, quem esta mais perto
     * da entrega primeiro; carro sem data de entrega vai para o fim, e nao
     * para o comeco, que e onde um `null` ordenado ingenuamente cairia.
     *
     * Visivel ao pacote para o teste: a ordem e regra de negocio -- o dono le
     * esta tela de cima para baixo e decide pelo que esta em cima.
     */
    static final Comparator<ExecucaoDtos.Carro> POR_URGENCIA = Comparator
            .comparingInt((ExecucaoDtos.Carro c) -> switch (c.status()) {
                case PAUSADO -> 0;
                case EM_EXECUCAO -> 1;
                default -> 2;
            })
            .thenComparing(c -> c.previsaoEntrega() == null ? LocalDate.MAX : c.previsaoEntrega())
            .thenComparingLong(ExecucaoDtos.Carro::numero);

    private final OrdemServicoRepository osRepository;
    private final ApontamentoRepository apontamentoRepository;
    private final ParadaRepository paradaRepository;
    private final ArquivoOsRepository arquivoRepository;
    private final EventoOsRepository eventoRepository;
    private final Contexto contexto;
    private final Clock clock;

    public ExecucaoService(OrdemServicoRepository osRepository,
                           ApontamentoRepository apontamentoRepository,
                           ParadaRepository paradaRepository,
                           ArquivoOsRepository arquivoRepository,
                           EventoOsRepository eventoRepository,
                           Contexto contexto,
                           Clock clock) {
        this.osRepository = osRepository;
        this.apontamentoRepository = apontamentoRepository;
        this.paradaRepository = paradaRepository;
        this.arquivoRepository = arquivoRepository;
        this.eventoRepository = eventoRepository;
        this.contexto = contexto;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public ExecucaoDtos.Painel painel() {
        // Toda a equipe ve. A tela nao tem preco nenhum -- hora de trabalho o
        // mecanico ja ve no painel dele, e o carro na bancada e dele tambem.
        contexto.exigirEquipe("Seu perfil não pode ver o painel da oficina.");

        UUID oficinaId = contexto.oficinaId();
        OffsetDateTime agora = OffsetDateTime.now(clock);
        OffsetDateTime inicioDoDia = LocalDate.now(clock)
                .atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();

        List<OrdemServico> naBancada = osRepository.naBancada(oficinaId);

        List<OrdemServico> emServico = naBancada.stream()
                .filter(os -> os.getStatus() == StatusOs.EM_EXECUCAO || os.getStatus() == StatusOs.PAUSADO)
                .toList();
        List<OrdemServico> aprovadas = naBancada.stream()
                .filter(os -> os.getStatus() == StatusOs.ORCAMENTO_APROVADO)
                .toList();

        // ------------------------------------------------- dados de apoio
        Map<UUID, Apontamento> rodando = new HashMap<>();
        for (Apontamento a : apontamentoRepository.abertosComMecanico(oficinaId)) {
            rodando.put(a.getOsItem().getId(), a);
        }

        Map<UUID, Parada> paradas = new HashMap<>();
        for (Parada p : paradaRepository.abertas(oficinaId)) {
            // A parada do CARRO (sem item) nao descreve servico nenhum: ela
            // vale para a OS inteira e nao tem onde aparecer nesta linha.
            if (p.getOsItemId() != null) {
                paradas.put(p.getOsItemId(), p);
            }
        }

        List<UUID> itensDaTela = emServico.stream()
                .flatMap(os -> os.getItens().stream())
                .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                .map(OsItem::getId)
                .toList();

        Map<UUID, BigDecimal> horasPorItem = new HashMap<>();
        if (!itensDaTela.isEmpty()) {
            for (Object[] linha : apontamentoRepository.horasPorItem(itensDaTela, agora)) {
                horasPorItem.put((UUID) linha[0], toBigDecimal(linha[1]));
            }
        }

        Map<UUID, List<OsDtos.ArquivoResposta>> fotosPorOs = fotosDoTrabalho(emServico, itensDaTela);

        // ------------------------------------------------- os carros
        List<ExecucaoDtos.Carro> carros = new ArrayList<>();
        int rodandoAgora = 0;
        int carrosParados = 0;
        int servicosParados = 0;
        int aEsperar = 0;
        int estourados = 0;
        Set<String> mecanicos = new HashSet<>();
        BigDecimal horasFeitas = BigDecimal.ZERO;
        BigDecimal horasPrevistas = BigDecimal.ZERO;

        for (OrdemServico os : emServico) {
            List<OsItem> vivos = os.getItens().stream()
                    .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                    .sorted(Comparator.comparingInt(OsItem::getOrdem))
                    .toList();

            List<ExecucaoDtos.Servico> servicos = new ArrayList<>();
            int concluidos = 0;
            BigDecimal estimadasDoCarro = BigDecimal.ZERO;
            BigDecimal trabalhadasDoCarro = BigDecimal.ZERO;

            for (OsItem item : vivos) {
                Apontamento aberto = rodando.get(item.getId());
                Parada parada = paradas.get(item.getId());
                BigDecimal trabalhadas = horasPorItem.getOrDefault(item.getId(), BigDecimal.ZERO);
                BigDecimal estimadas = item.getHorasEstimadas() == null
                        ? BigDecimal.ZERO
                        : item.getHorasEstimadas();

                estimadasDoCarro = estimadasDoCarro.add(estimadas);
                trabalhadasDoCarro = trabalhadasDoCarro.add(trabalhadas);

                switch (item.getStatus()) {
                    case CONCLUIDO -> concluidos++;
                    case EM_EXECUCAO -> {
                        if (aberto != null) {
                            rodandoAgora++;
                            mecanicos.add(aberto.getFuncionario().getNome());
                        }
                    }
                    case PAUSADO -> servicosParados++;
                    case PENDENTE -> aEsperar++;
                    default -> {
                    }
                }

                boolean abertoAinda = item.getStatus() != StatusItem.CONCLUIDO;
                if (abertoAinda && estimadas.signum() > 0 && trabalhadas.compareTo(estimadas) > 0) {
                    estourados++;
                }

                servicos.add(new ExecucaoDtos.Servico(
                        item.getId(),
                        item.getDescricao(),
                        item.getStatus(),
                        item.getStatus().descricao(),
                        item.getFuncionario() == null ? null : item.getFuncionario().getNome(),
                        item.getEspecialidade() == null ? null : item.getEspecialidade().getNome(),
                        item.getEspecialidade() == null ? null : item.getEspecialidade().getCor(),
                        estimadas,
                        trabalhadas.setScale(2, RoundingMode.HALF_UP),
                        aberto == null ? null : aberto.getInicio(),
                        parada == null ? null : parada.getMotivoParada().getNome(),
                        parada == null ? null : parada.getInicio()));
            }

            if (os.getStatus() == StatusOs.PAUSADO) {
                carrosParados++;
            }

            horasFeitas = horasFeitas.add(trabalhadasDoCarro);
            horasPrevistas = horasPrevistas.add(estimadasDoCarro);

            carros.add(new ExecucaoDtos.Carro(
                    os.getId(),
                    os.getNumero(),
                    os.getVeiculo().getPlaca(),
                    os.getVeiculo().descricaoCurta(),
                    os.getVeiculo().getCor(),
                    os.getCliente().getNome(),
                    os.getBox() == null ? null : os.getBox().getNome(),
                    os.getPrioridade(),
                    os.getStatus(),
                    os.isPrecisaElevador(),
                    os.getPrevisaoEntrega(),
                    os.getInicioExecucaoEm(),
                    vivos.size(),
                    concluidos,
                    estimadasDoCarro,
                    trabalhadasDoCarro.setScale(2, RoundingMode.HALF_UP),
                    servicos,
                    fotosPorOs.getOrDefault(os.getId(), List.of())));
        }

        carros.sort(POR_URGENCIA);

        // ------------------------------------------------- a fila da bancada
        List<ExecucaoDtos.Aguardando> aguardando = new ArrayList<>();
        for (OrdemServico os : aprovadas) {
            List<OsItem> vivos = os.getItens().stream()
                    .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                    .toList();
            BigDecimal estimadas = vivos.stream()
                    .map(i -> i.getHorasEstimadas() == null ? BigDecimal.ZERO : i.getHorasEstimadas())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            OffsetDateTime desde = os.getAprovadoEm() == null ? os.getEntradaEm() : os.getAprovadoEm();

            aguardando.add(new ExecucaoDtos.Aguardando(
                    os.getId(),
                    os.getNumero(),
                    os.getVeiculo().getPlaca(),
                    os.getVeiculo().descricaoCurta(),
                    os.getCliente().getNome(),
                    os.getPrioridade(),
                    os.getPrevisaoEntrega(),
                    estimadas,
                    vivos.size(),
                    diasDeCalendario(desde, agora)));
        }
        aguardando.sort(Comparator.comparingLong(ExecucaoDtos.Aguardando::diasParado).reversed());

        // ------------------------------------------------- o placar do dia
        /*
         * Horas de hoje: soma os cronometros que COMECARAM hoje.
         *
         * Um turno que atravessa a meia-noite conta no dia em que comecou, e
         * nao se divide entre os dois. O apontamento esquecido e fechado no
         * fim do turno pelo proprio servico, entao atravessar a meia-noite e
         * excecao -- e a conta exata custaria um GREATEST por linha para
         * mover um numero de cabecalho.
         */
        BigDecimal horasHoje = BigDecimal.ZERO;
        for (Apontamento a : apontamentoRepository.doPeriodo(oficinaId, inicioDoDia, agora)) {
            horasHoje = horasHoje.add(a.horas(agora));
        }

        ExecucaoDtos.Resumo resumo = new ExecucaoDtos.Resumo(
                emServico.size(),
                rodandoAgora,
                carrosParados,
                servicosParados,
                aEsperar,
                mecanicos.size(),
                estourados,
                (int) eventoRepository.countByOficinaIdAndTipoAndCriadoEmGreaterThanEqual(
                        oficinaId, EventoService.SERVICO_CONCLUIDO, inicioDoDia),
                (int) osRepository.countByOficinaIdAndEntregueEmGreaterThanEqual(oficinaId, inicioDoDia),
                horasHoje.setScale(2, RoundingMode.HALF_UP),
                horasFeitas.setScale(2, RoundingMode.HALF_UP),
                horasPrevistas);

        return new ExecucaoDtos.Painel(resumo, carros, aguardando);
    }

    /**
     * As fotos do trabalho de cada carro, numa consulta.
     *
     * So as do servico: a foto de ENTRADA e do carro chegando, e o painel
     * quer mostrar como o servico esta, nao como o carro chegou.
     */
    private Map<UUID, List<OsDtos.ArquivoResposta>> fotosDoTrabalho(List<OrdemServico> carros,
                                                                    List<UUID> itens) {
        if (itens.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> nomeDoServico = new HashMap<>();
        Map<UUID, UUID> osDoItem = new HashMap<>();
        for (OrdemServico os : carros) {
            for (OsItem item : os.getItens()) {
                nomeDoServico.put(item.getId(), item.getDescricao());
                osDoItem.put(item.getId(), os.getId());
            }
        }

        Map<UUID, List<OsDtos.ArquivoResposta>> porOs = new HashMap<>();
        for (ArquivoOs a : arquivoRepository.dosServicos(itens)) {
            UUID osId = osDoItem.get(a.getOsItemId());
            if (osId == null) {
                continue;
            }
            porOs.computeIfAbsent(osId, k -> new ArrayList<>())
                    .add(ArquivoService.resposta(a, nomeDoServico.get(a.getOsItemId())));
        }

        /*
         * As SEIS ULTIMAS, e nao as seis primeiras.
         *
         * `dosServicos` devolve em ordem crescente de data, entao cortar no
         * comeco guardava as mais velhas -- num carro de tres dias, o painel
         * mostrava o motor aberto do primeiro dia para sempre, e a foto da
         * peca montada hoje nao aparecia nunca. A tira continua em ordem
         * cronologica: o corte muda a janela, nao a leitura.
         */
        porOs.replaceAll((osId, lista) -> lista.size() <= FOTOS_POR_CARRO
                ? lista
                : new ArrayList<>(lista.subList(lista.size() - FOTOS_POR_CARRO, lista.size())));
        return porOs;
    }

    /**
     * Dias de calendario, e nao blocos de 24 horas.
     *
     * A tela le este numero como data: zero virou a frase "aprovado hoje", e
     * dois dias viram vermelho. Com `Duration.toDays()`, um orcamento
     * aprovado as 18h de ontem dava zero as 9h de hoje -- e a tela dizia
     * "aprovado hoje" sobre um carro que dormiu na oficina.
     */
    private static long diasDeCalendario(OffsetDateTime desde, OffsetDateTime agora) {
        if (desde == null) {
            return 0;
        }
        ZoneId zona = ZoneId.systemDefault();
        long dias = ChronoUnit.DAYS.between(
                desde.atZoneSameInstant(zona).toLocalDate(),
                agora.atZoneSameInstant(zona).toLocalDate());
        return Math.max(dias, 0);
    }

    /** O driver devolve BigDecimal ou Double conforme a consulta; aqui os dois viram BigDecimal. */
    private static BigDecimal toBigDecimal(Object valor) {
        if (valor == null) {
            return BigDecimal.ZERO;
        }
        if (valor instanceof BigDecimal b) {
            return b;
        }
        return BigDecimal.valueOf(((Number) valor).doubleValue());
    }
}
