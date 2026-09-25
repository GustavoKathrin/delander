package br.com.oficina.ordemservico;

import br.com.oficina.apontamento.ApontamentoRepository;
import br.com.oficina.compartilhamento.CompartilhamentoOsRepository;
import br.com.oficina.configuracao.Chaves;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.parada.Parada;
import br.com.oficina.peca.MomentoDaPeca;
import br.com.oficina.peca.PecaOs;
import br.com.oficina.peca.PecaOsRepository;
import br.com.oficina.peca.StatusPeca;
import br.com.oficina.parada.ParadaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Monta os cards da OS com as metricas que realmente importam:
 * horas trabalhadas x estimadas, dias sem movimentacao, parada em aberto
 * e os alertas que fazem o carro esquecido subir para o topo do quadro.
 */
@Service
public class ResumoOsFactory {

    private final ApontamentoRepository apontamentoRepository;
    private final ParadaRepository paradaRepository;
    private final CompartilhamentoOsRepository compartilhamentoRepository;
    private final PecaOsRepository pecaRepository;
    private final ConfiguracaoService config;
    private final Clock clock;

    public ResumoOsFactory(ApontamentoRepository apontamentoRepository,
                           ParadaRepository paradaRepository,
                           CompartilhamentoOsRepository compartilhamentoRepository,
                           PecaOsRepository pecaRepository,
                           ConfiguracaoService config,
                           Clock clock) {
        this.apontamentoRepository = apontamentoRepository;
        this.paradaRepository = paradaRepository;
        this.compartilhamentoRepository = compartilhamentoRepository;
        this.pecaRepository = pecaRepository;
        this.config = config;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<OsDtos.Resumo> montar(UUID oficinaId, List<OrdemServico> ordens) {
        if (ordens.isEmpty()) {
            return List.of();
        }
        OffsetDateTime agora = OffsetDateTime.now(clock);
        LocalDate hoje = agora.toLocalDate();
        List<UUID> ids = ordens.stream().map(OrdemServico::getId).toList();

        Map<UUID, BigDecimal> horasTrabalhadas = mapaDecimal(apontamentoRepository.horasPorOs(ids, agora));
        Map<UUID, BigDecimal> horasParado = mapaDecimal(paradaRepository.horasParadasPorOs(ids, agora));
        Map<UUID, OffsetDateTime> ultimaAtividade = mapaData(apontamentoRepository.ultimaAtividadePorOs(ids));
        Set<UUID> comLink = new HashSet<>(compartilhamentoRepository.osComLinkAtivo(ids));

        // Peca: uma consulta em lote para o lote inteiro. ESPERANDO quer
        // telefone para o fornecedor; CHEGOU quer mecanico — acoes opostas,
        // e e por isso que precisam aparecer no card e nao so dentro da OS.
        Map<UUID, List<PecaOs>> pecasPorOs = pecaRepository.pecasDeCompraDasOs(ids).stream()
                .collect(Collectors.groupingBy(PecaOs::getOrdemServicoId));

        Map<UUID, Parada> paradasAbertas = new HashMap<>();
        paradaRepository.abertas(oficinaId)
                .forEach(p -> paradasAbertas.put(p.getOrdemServicoId(), p));

        int limiteSemMovimento = config.inteiro(oficinaId, Chaves.DIAS_SEM_MOVIMENTACAO, 3);
        int limiteRetirada = config.inteiro(oficinaId, Chaves.DIAS_PRONTO_SEM_RETIRADA, 2);
        int limiteEstouro = config.inteiro(oficinaId, Chaves.PERCENTUAL_ESTOURO, 20);
        int diasAntesPrevisao = config.inteiro(oficinaId, Chaves.DIAS_ANTES_PREVISAO, 1);

        List<OsDtos.Resumo> resultado = new ArrayList<>(ordens.size());
        for (OrdemServico os : ordens) {
            resultado.add(montarUm(os, agora, hoje,
                    horasTrabalhadas.getOrDefault(os.getId(), BigDecimal.ZERO),
                    horasParado.getOrDefault(os.getId(), BigDecimal.ZERO),
                    ultimaAtividade.get(os.getId()),
                    paradasAbertas.get(os.getId()),
                    comLink.contains(os.getId()),
                    pecasPorOs.getOrDefault(os.getId(), List.of()),
                    limiteSemMovimento, limiteRetirada, limiteEstouro, diasAntesPrevisao));
        }
        return resultado;
    }

    @Transactional(readOnly = true)
    public OsDtos.Resumo montarUm(UUID oficinaId, OrdemServico os) {
        return montar(oficinaId, List.of(os)).get(0);
    }

    // ------------------------------------------------------------------ interno

    private OsDtos.Resumo montarUm(OrdemServico os,
                                   OffsetDateTime agora,
                                   LocalDate hoje,
                                   BigDecimal horasTrabalhadas,
                                   BigDecimal horasParado,
                                   OffsetDateTime ultimaAtividade,
                                   Parada paradaAberta,
                                   boolean compartilhado,
                                   List<PecaOs> pecasDeCompra,
                                   int limiteSemMovimento,
                                   int limiteRetirada,
                                   int limiteEstouro,
                                   int diasAntesPrevisao) {

        BigDecimal estimadas = os.horasEstimadas();
        int percentual = estimadas.signum() == 0
                ? 0
                : horasTrabalhadas.multiply(BigDecimal.valueOf(100))
                .divide(estimadas, 0, RoundingMode.HALF_UP).intValue();

        OffsetDateTime referencia = ultimaAtividade != null ? ultimaAtividade : os.getEntradaEm();
        long diasSemMovimentacao = os.getStatus().noPatio()
                ? Math.max(Duration.between(referencia, agora).toDays(), 0)
                : 0;
        long diasAguardandoRetirada = os.diasAguardandoRetirada(agora);

        List<String> mecanicos = os.getItens().stream()
                .filter(i -> i.getFuncionario() != null && i.getStatus() != StatusItem.CANCELADO)
                .map(i -> i.getFuncionario().getNome())
                .distinct()
                .toList();

        List<String> especialidades = os.getItens().stream()
                .filter(i -> i.getEspecialidade() != null && i.getStatus() != StatusItem.CANCELADO)
                .map(i -> i.getEspecialidade().getNome())
                .distinct()
                .toList();

        List<OsDtos.Alerta> alertas = new ArrayList<>();

        if (paradaAberta != null) {
            alertas.add(OsDtos.Alerta.ambar("PARADA",
                    "Parado: " + paradaAberta.getMotivoParada().getNome()));
        }
        if (os.getStatus() == StatusOs.PRONTO_AGUARDANDO_RETIRADA && diasAguardandoRetirada >= limiteRetirada) {
            alertas.add(OsDtos.Alerta.vermelho("RETIRADA",
                    "Pronto há %d dia(s) e ninguém buscou".formatted(diasAguardandoRetirada)));
        }
        if (os.getStatus().noPatio()
                && os.getStatus() != StatusOs.PRONTO_AGUARDANDO_RETIRADA
                && diasSemMovimentacao >= limiteSemMovimento) {
            alertas.add(OsDtos.Alerta.vermelho("SEM_MOVIMENTO",
                    "Sem nenhum apontamento há %d dia(s)".formatted(diasSemMovimentacao)));
        }
        if (os.atrasada(hoje)) {
            long diasAtraso = Math.max(hoje.toEpochDay() - os.getPrevisaoEntrega().toEpochDay(), 0);
            alertas.add(OsDtos.Alerta.vermelho("ATRASO",
                    "Entrega prometida há %d dia(s)".formatted(diasAtraso)));
        } else if (os.getPrevisaoEntrega() != null && os.getStatus().noPatio()
                && !os.getPrevisaoEntrega().isBefore(hoje)
                && os.getPrevisaoEntrega().toEpochDay() - hoje.toEpochDay() <= diasAntesPrevisao) {
            alertas.add(OsDtos.Alerta.ambar("PRAZO", "Entrega prometida em breve"));
        }
        if (estimadas.signum() > 0 && percentual > 100 + limiteEstouro) {
            alertas.add(OsDtos.Alerta.ambar("ESTOURO",
                    "Tempo %d%% acima do estimado".formatted(percentual - 100)));
        }
        if (os.getStatus().noPatio() && os.getDataAgendada() == null) {
            alertas.add(OsDtos.Alerta.ambar("SEM_DIA", "Sem dia definido na agenda"));
        }
        if (os.getStatus() == StatusOs.AGENDADO && mecanicos.isEmpty() && !os.getItens().isEmpty()) {
            alertas.add(OsDtos.Alerta.ambar("SEM_MECANICO", "Nenhum mecânico atribuído"));
        }

        // Peca faltando: o selo e o alerta saem da mesma lista.
        //
        // O dono foi explicito em NAO travar o servico por peca — o mecanico
        // comeca e resolve o que der. O que ele pediu foi o aviso, com nome:
        // "Peca X ainda nao comprada". Alerta sem o nome da peca ninguem age
        // em cima, e e por isso que a consulta traz as pecas e nao so ids.
        List<PecaOs> naoChegaram = pecasDeCompra.stream()
                .filter(p -> p.getStatus() == StatusPeca.SOLICITADA
                        || p.getStatus() == StatusPeca.COMPRADA)
                .toList();

        OsDtos.StatusPecaCard seloPeca = !naoChegaram.isEmpty()
                ? OsDtos.StatusPecaCard.ESPERANDO
                : pecasDeCompra.stream().anyMatch(p -> p.getStatus() == StatusPeca.RECEBIDA)
                        ? OsDtos.StatusPecaCard.CHEGOU
                        : OsDtos.StatusPecaCard.NENHUMA;

        naoChegaram.stream()
                .filter(p -> p.getMomentoNecessario() == MomentoDaPeca.INICIO)
                .findFirst()
                .ifPresentOrElse(
                        // Trava o inicio: o carro nao anda enquanto isso nao chega.
                        p -> alertas.add(OsDtos.Alerta.vermelho("PECA",
                                "Falta para começar: %s".formatted(p.getDescricao()))),
                        () -> naoChegaram.stream().findFirst().ifPresent(
                                p -> alertas.add(OsDtos.Alerta.ambar("PECA",
                                        "Peça ainda não comprada: %s".formatted(p.getDescricao())))));

        return new OsDtos.Resumo(
                os.getId(),
                os.getNumero(),
                os.getVeiculo().getPlaca(),
                os.getVeiculo().descricaoCurta(),
                os.getVeiculo().getCor(),
                os.getVeiculo().getId(),
                os.getCliente().getId(),
                os.getCliente().getNome(),
                os.getCliente().getTelefone(),
                os.getStatus(),
                os.getStatus().descricao(),
                os.getPrioridade(),
                os.getBox() == null ? null : os.getBox().getId(),
                os.getBox() == null ? null : os.getBox().getNome(),
                os.getDataAgendada(),
                os.getPrevisaoEntrega(),
                os.getQueixa(),
                estimadas,
                horasTrabalhadas,
                percentual,
                os.diasPermanencia(agora),
                diasSemMovimentacao,
                diasAguardandoRetirada,
                os.atrasada(hoje),
                os.getStatus() == StatusOs.EM_EXECUCAO,
                paradaAberta == null ? null : paradaAberta.getMotivoParada().getNome(),
                paradaAberta == null ? null : paradaAberta.getMotivoParada().getCategoria(),
                horasParado,
                mecanicos,
                especialidades,
                alertas,
                compartilhado,
                os.isPrecisaElevador(),
                seloPeca);
    }

    private Map<UUID, BigDecimal> mapaDecimal(List<Object[]> linhas) {
        Map<UUID, BigDecimal> mapa = new HashMap<>();
        for (Object[] linha : linhas) {
            UUID id = (UUID) linha[0];
            Object valor = linha[1];
            BigDecimal horas = valor == null
                    ? BigDecimal.ZERO
                    : new BigDecimal(valor.toString()).setScale(2, RoundingMode.HALF_UP);
            mapa.put(id, horas);
        }
        return mapa;
    }

    private Map<UUID, OffsetDateTime> mapaData(List<Object[]> linhas) {
        Map<UUID, OffsetDateTime> mapa = new HashMap<>();
        for (Object[] linha : linhas) {
            UUID id = (UUID) linha[0];
            OffsetDateTime data = converter(linha[1]);
            if (data != null) {
                mapa.put(id, data);
            }
        }
        return mapa;
    }

    private OffsetDateTime converter(Object valor) {
        if (valor == null) {
            return null;
        }
        if (valor instanceof OffsetDateTime odt) {
            return odt;
        }
        if (valor instanceof Timestamp ts) {
            return ts.toInstant().atZone(ZoneId.systemDefault()).toOffsetDateTime();
        }
        if (valor instanceof java.time.Instant instante) {
            return instante.atZone(ZoneId.systemDefault()).toOffsetDateTime();
        }
        return null;
    }
}
