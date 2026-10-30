package br.com.oficina.apontamento;

import br.com.oficina.ordemservico.OsDtos;
import br.com.oficina.ordemservico.Prioridade;
import br.com.oficina.ordemservico.StatusItem;
import br.com.oficina.ordemservico.StatusOs;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * O que esta acontecendo na oficina AGORA -- a Etapa 6 vista de fora.
 *
 * O dono pediu um painel para a etapa do servico, e a tela que ja existia
 * para isso era o Painel do Mecanico: um cartao por servico, na ordem da
 * agenda, pensado para quem esta com a chave na mao e precisa de UM cartao.
 * Quem olha a oficina inteira faz outra pergunta -- "onde esta cada carro, e
 * o que falta nele" -- e a resposta dela e por CARRO, nao por servico.
 *
 * Nenhum valor em dinheiro entra aqui. A tela serve ao chao de fabrica, e
 * hora de trabalho o mecanico ja ve; preco nao. Assim a mesma tela vale para
 * os quatro perfis sem mascara nenhuma.
 */
public final class ExecucaoDtos {

    private ExecucaoDtos() {
    }

    public record Painel(Resumo resumo, List<Carro> carros, List<Aguardando> aguardando) {
    }

    /**
     * A faixa de cima.
     *
     * Dois tempos, e a tela diz qual e qual: o que esta acontecendo neste
     * instante (carros, cronometros, parados) e o que o dia ja produziu
     * (concluidos, entregues, horas apontadas). Juntar os dois numa faixa so
     * foi o erro do painel do dono, e custou uma reescrita.
     */
    public record Resumo(
            int carros,
            /** Cronometros rodando neste instante. */
            int rodando,
            /**
             * Carros parados: a OS inteira em PAUSADO.
             *
             * Nao da para contar isto pelos servicos. O caminho mais comum de
             * um carro virar PAUSADO nao pausa servico nenhum: quando o
             * ultimo cronometro fecha, `ReconciliacaoOs` poe a OS em PAUSADO
             * e nao toca nos itens, que continuam PENDENTE. Contando so item
             * pausado, o painel dizia "nada travado na bancada" em verde com
             * o carro parado desenhado logo abaixo, em ambar.
             */
            int carrosParados,
            /** Servicos travados com motivo registrado, dentro de qualquer carro. */
            int servicosParados,
            /** Servico que ninguem comecou ainda, no carro que ja esta na bancada. */
            int aEsperar,
            int mecanicos,
            /** Servico aberto que ja passou da estimativa. */
            int estourados,
            int concluidosHoje,
            int entreguesHoje,
            BigDecimal horasHoje,
            /** Progresso do conjunto: horas feitas de horas prometidas na bancada. */
            BigDecimal horasFeitas,
            BigDecimal horasPrevistas) {
    }

    public record Carro(
            UUID osId,
            long numero,
            String placa,
            String veiculo,
            String cor,
            String cliente,
            String box,
            Prioridade prioridade,
            StatusOs status,
            boolean precisaElevador,
            LocalDate previsaoEntrega,
            OffsetDateTime inicioExecucaoEm,
            int servicosTotal,
            int servicosConcluidos,
            BigDecimal horasEstimadas,
            BigDecimal horasTrabalhadas,
            List<Servico> servicos,
            /** As ultimas fotos do trabalho, para o dono ver sem abrir a OS. */
            List<OsDtos.ArquivoResposta> fotos) {
    }

    public record Servico(
            UUID itemId,
            String descricao,
            StatusItem status,
            String statusDescricao,
            String mecanico,
            String especialidade,
            String especialidadeCor,
            BigDecimal horasEstimadas,
            BigDecimal horasTrabalhadas,
            /** Nulo quando o cronometro nao esta rodando. */
            OffsetDateTime rodandoDesde,
            /** O motivo da parada deste servico, quando ha um registrado. */
            String motivoParada,
            OffsetDateTime paradoDesde) {
    }

    /**
     * Carro aprovado que ainda nao comecou.
     *
     * Nao e enfeite: e a fila da bancada. Um carro aprovado ha tres dias e
     * sem ninguem na chave e o pior numero da oficina, e nao aparece em
     * nenhuma outra tela com essa pergunta na frente.
     */
    public record Aguardando(
            UUID osId,
            long numero,
            String placa,
            String veiculo,
            String cliente,
            Prioridade prioridade,
            LocalDate previsaoEntrega,
            BigDecimal horasEstimadas,
            int servicos,
            /** Dias desde a aprovacao do orcamento. */
            long diasParado) {
    }
}
