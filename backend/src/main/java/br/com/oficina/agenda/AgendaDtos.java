package br.com.oficina.agenda;

import br.com.oficina.ordemservico.OsDtos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public final class AgendaDtos {

    private AgendaDtos() {
    }

    /**
     * Semaforo de capacidade do dia. E o "bater o olho" do dono:
     * o limite mais restritivo entre horas de mecanico, boxes e teto de carros.
     */
    public record CapacidadeDia(
            LocalDate data,
            BigDecimal horasDisponiveis,
            BigDecimal horasAlocadas,
            BigDecimal horasLivres,
            int carros,
            int maxCarros,
            int boxesTotal,
            int boxesOcupados,
            int percentual,
            String semaforo,
            boolean cheio,
            String limitante) {
    }

    public record Dia(
            LocalDate data,
            String diaSemana,
            boolean funciona,
            boolean hoje,
            CapacidadeDia capacidade,
            List<OsDtos.Resumo> ordens) {
    }

    public record ResumoSemana(
            BigDecimal horasDisponiveis,
            BigDecimal horasAlocadas,
            int carros,
            int maxCarrosSemana,
            int percentual,
            String semaforo) {
    }

    /**
     * Um carro da fila de espera com a data em que ele deve entrar.
     * A data sai de uma simulacao: cada carro da fila consome a capacidade do
     * dia em que couber, entao o segundo da fila so entra quando o primeiro
     * ja tiver vaga — e a vaga aparece quando o carro que esta nela sai.
     */
    public record ItemFila(
            int posicao,
            OsDtos.Resumo os,
            BigDecimal horasNecessarias,
            long diasEsperando,
            LocalDate entradaPrevista,
            String entradaPrevistaRotulo) {
    }

    public record Quadro(
            LocalDate inicio,
            LocalDate fim,
            String titulo,
            List<Dia> dias,
            List<ItemFila> fila,
            BigDecimal backlogHoras,
            ResumoSemana semana) {
    }

    public record Fila(
            List<ItemFila> itens,
            BigDecimal backlogHoras,
            LocalDate proximaVagaLivre,
            int vagasLivresHoje,
            int vagasTotal) {
    }

    // ============================================================ elevador

    /**
     * Uma subida no elevador. A vaga corre em dia; o elevador, em hora — por
     * isso aqui tem horario e "desce em 1h20", e nao "ocupado hoje".
     */
    public record ReservaElevador(
            java.util.UUID id,
            java.util.UUID boxId,
            String boxNome,
            java.util.UUID osId,
            String placa,
            String status,
            String statusDescricao,
            OffsetDateTime inicioPrevisto,
            BigDecimal horasPrevistas,
            OffsetDateTime terminoPrevisto,
            OffsetDateTime inicioReal,
            /** "sobe hoje 15:20" quando reservado; "desce em 1h20" quando em uso. */
            String rotulo,
            /** Negativo quando passou da hora; so preenchido em uso. */
            Long minutosRestantes) {

        public boolean emUso() {
            return "EM_USO".equals(status);
        }
    }

    /** Carro esperando o elevador, com o horario que a simulacao achou. */
    public record ItemFilaElevador(
            int posicao,
            OsDtos.Resumo os,
            BigDecimal horasPrevistas,
            java.util.UUID boxSugeridoId,
            String boxSugeridoNome,
            OffsetDateTime inicioPrevisto,
            String rotulo) {
    }

    public record FilaElevador(
            List<ItemFilaElevador> itens,
            List<ReservaElevador> emUso,
            int total,
            int livresAgora,
            OffsetDateTime proximoLivre,
            String proximoLivreRotulo) {
    }

    // ============================================================ planta do patio

    /**
     * Uma vaga da oficina com o que esta dentro dela.
     * `situacao` e derivada do status da OS e da parada em aberto, para a
     * planta nao precisar repetir essa regra no front.
     */
    public record Vaga(
            java.util.UUID id,
            String nome,
            br.com.oficina.cadastro.TipoBox tipo,
            OsDtos.Resumo ocupante,
            String situacao,
            String situacaoRotulo,
            String impedimento,
            LocalDate liberaEm,
            String liberaEmRotulo,
            /** So em box do tipo ELEVADOR, e so quando ha reserva viva. */
            ReservaElevador reserva,
            /** Onde a vaga fica na planta. Nulo = planta automatica. */
            Integer layoutColuna,
            Integer layoutLinha,
            int layoutLargura,
            int layoutAltura) {

        public boolean livre() {
            return ocupante == null;
        }
    }

    /** Tudo que a planta do patio precisa, em uma chamada so. */
    public record Patio(
            List<Vaga> vagas,
            List<OsDtos.Resumo> semVaga,
            List<ItemFila> fila,
            int vagasLivres,
            int vagasTotal,
            LocalDate proximaVagaLivre,
            String proximaVagaLivreRotulo,
            BigDecimal backlogHoras,
            FilaElevador elevadores) {
    }

    /** "Primeira folga: qui 24/09 - 5h livres, 1 box". */
    public record Sugestao(
            LocalDate data,
            String rotulo,
            BigDecimal horasLivres,
            int vagasLivres,
            int percentualOcupacao) {
    }
}
