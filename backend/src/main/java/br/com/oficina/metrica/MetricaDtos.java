package br.com.oficina.metrica;

import br.com.oficina.agenda.AgendaDtos;
import br.com.oficina.cadastro.CategoriaParada;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class MetricaDtos {

    private MetricaDtos() {
    }

    /** O painel do dono em uma tela. */
    public record Resumo(
            // patio agora
            long carrosNoPatio,
            long emExecucao,
            long aguardando,
            long prontosNaoRetirados,
            long diasMedioAguardandoRetirada,
            int ocupacaoBoxesPercentual,
            int boxesTotal,
            int boxesOcupados,
            int elevadoresTotal,
            int elevadoresOcupados,
            int naFilaDoElevador,

            // fluxo no periodo
            long recebidos,
            long entregues,
            long saldoPatio,
            BigDecimal backlogHoras,

            // o diagnostico: permanencia x mao de obra
            BigDecimal permanenciaMediaDias,
            BigDecimal maoObraMediaHoras,
            int aproveitamentoPercentual,
            BigDecimal horasParadoMedia,

            // aderencia a estimativa
            int aderenciaEstimativaPercentual,
            long osComEstouro,

            AgendaDtos.Sugestao primeiraFolga) {
    }

    public record ItemPareto(String motivo,
                             CategoriaParada categoria,
                             long ocorrencias,
                             BigDecimal horas,
                             int percentual,
                             int acumulado) {
    }

    public record Throughput(LocalDate inicio, LocalDate fim, long recebidos, long entregues) {
    }

    public record ItemMecanico(String nome,
                               long servicos,
                               BigDecimal horasTrabalhadas,
                               BigDecimal horasEstimadas,
                               int aderenciaPercentual) {
    }

    public record Painel(Resumo resumo,
                         List<ItemPareto> paradas,
                         List<Throughput> throughput,
                         List<ItemMecanico> mecanicos) {
    }
}
