package br.com.oficina.ordemservico;

import br.com.oficina.cadastro.CategoriaParada;
import br.com.oficina.peca.MomentoDaPeca;
import br.com.oficina.peca.OrigemPeca;
import br.com.oficina.peca.StatusPeca;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class OsDtos {

    private OsDtos() {
    }

    // ============================================================ entrada

    /** Cliente novo criado direto no check-in, sem sair da tela. */
    public record ClienteRapido(
            @NotBlank(message = "Informe o nome do cliente") @Size(max = 160) String nome,
            @Size(max = 30) String telefone,
            @Size(max = 30) String documento,
            @Email(message = "E-mail invalido") @Size(max = 180) String email,
            boolean consentimentoContato) {
    }

    /** Veiculo novo criado direto no check-in. */
    public record VeiculoRapido(
            @NotBlank(message = "Informe a placa") @Size(max = 10) String placa,
            @Size(max = 60) String marca,
            @Size(max = 80) String modelo,
            Integer ano,
            @Size(max = 40) String cor,
            Integer km) {
    }

    public record ItemRequisicao(
            UUID catalogoServicoId,
            @Size(max = 240) String descricao,
            UUID especialidadeId,
            @DecimalMin(value = "0.0", message = "Horas estimadas nao pode ser negativa") BigDecimal horasEstimadas,
            UUID funcionarioId,
            BigDecimal valor) {
    }

    /**
     * Check-in rapido: cria cliente + veiculo + OS + itens + alocacao
     * em uma unica transacao. E a tela de "poucos cliques" da recepcao.
     */
    public record CheckinRequisicao(
            UUID clienteId,
            @Valid ClienteRapido novoCliente,
            UUID veiculoId,
            @Valid VeiculoRapido novoVeiculo,
            @NotBlank(message = "Descreva o problema relatado pelo cliente") String queixa,
            Prioridade prioridade,
            LocalDate dataAgendada,
            LocalDate previsaoEntrega,
            UUID boxId,
            Integer kmEntrada,
            @Valid List<ItemRequisicao> itens,
            List<String> checklist,
            /**
             * O dono fecha o servico sabendo que o carro sobe. Null deixa o
             * sistema deduzir dos servicos do catalogo escolhidos.
             */
            Boolean precisaElevador,
            /** Vincular o atendimento direto no elevador, ja no agendamento. */
            UUID elevadorBoxId,
            OffsetDateTime elevadorInicio,
            @DecimalMin(value = "0.0", message = "As horas de elevador nao podem ser negativas")
            BigDecimal elevadorHoras) {
    }

    /** Reserva de elevador pedida de fora do check-in. */
    public record ReservaElevadorRequisicao(
            @NotNull(message = "Escolha o elevador") UUID boxId,
            OffsetDateTime inicio,
            @DecimalMin(value = "0.0", message = "As horas nao podem ser negativas") BigDecimal horas) {
    }

    public record SubidaElevadorRequisicao(
            @NotNull(message = "Escolha o elevador") UUID boxId) {
    }

    public record MarcacaoElevadorRequisicao(
            @NotNull(message = "Informe se precisa de elevador") Boolean precisaElevador) {
    }

    public record AtualizacaoRequisicao(
            String queixa,
            String diagnostico,
            Prioridade prioridade,
            LocalDate previsaoEntrega,
            Integer kmEntrada,
            @DecimalMin("0.0") BigDecimal valorPecas,
            @DecimalMin("0.0") BigDecimal valorMaoObra,
            @DecimalMin("0.0") BigDecimal desconto) {
    }

    public record TransicaoRequisicao(
            @NotNull(message = "Informe o novo status") StatusOs status,
            UUID motivoParadaId,
            @Size(max = 400) String descricao,
            Boolean visivelCliente) {
    }

    public record AlocacaoRequisicao(LocalDate dataAgendada, UUID boxId) {
    }

    public record AtribuicaoRequisicao(@NotNull(message = "Informe o mecanico") UUID funcionarioId) {
    }

    // ============================================================ saida

    public record Alerta(String tipo, String texto, String severidade) {

        public static Alerta vermelho(String tipo, String texto) {
            return new Alerta(tipo, texto, "ALTA");
        }

        public static Alerta ambar(String tipo, String texto) {
            return new Alerta(tipo, texto, "MEDIA");
        }
    }

    /** Card do quadro da semana / radar / listagem. */
    public record Resumo(
            UUID id,
            long numero,
            String placa,
            String veiculo,
            String cor,
            UUID veiculoId,
            UUID clienteId,
            String clienteNome,
            String clienteTelefone,
            StatusOs status,
            String statusDescricao,
            Prioridade prioridade,
            UUID boxId,
            String boxNome,
            LocalDate dataAgendada,
            LocalDate previsaoEntrega,
            String queixa,
            BigDecimal horasEstimadas,
            BigDecimal horasTrabalhadas,
            int percentualExecutado,
            long diasNaOficina,
            long diasSemMovimentacao,
            long diasAguardandoRetirada,
            boolean atrasada,
            boolean emAndamento,
            String paradaMotivo,
            CategoriaParada paradaCategoria,
            BigDecimal horasParado,
            List<String> mecanicos,
            List<String> especialidades,
            List<Alerta> alertas,
            boolean compartilhado,
            /** O servico sobe o carro: alimenta a fila do elevador e o selo no card. */
            boolean precisaElevador,
            /**
             * Peca do carro: o motivo numero um de carro parado.
             *
             * Dois estados diferentes, e confundi-los custa dia de oficina:
             * ESPERANDO = nao adianta chamar o mecanico;
             * CHEGOU = o carro esta travado a toa e pode andar hoje.
             */
            StatusPecaCard pecas) {
    }

    public record ItemResposta(
            UUID id,
            String descricao,
            UUID especialidadeId,
            String especialidadeNome,
            String especialidadeCor,
            BigDecimal horasEstimadas,
            BigDecimal horasTrabalhadas,
            UUID funcionarioId,
            String funcionarioNome,
            StatusItem status,
            String statusDescricao,
            BigDecimal valor,
            boolean apontamentoAberto,
            OffsetDateTime apontamentoInicio) {
    }

    public record ApontamentoResposta(
            UUID id,
            UUID osItemId,
            String itemDescricao,
            UUID funcionarioId,
            String funcionarioNome,
            OffsetDateTime inicio,
            OffsetDateTime fim,
            BigDecimal horas,
            BigDecimal horasEstimadasInformadas,
            String observacao,
            boolean encerradoAutomaticamente) {
    }

    public record ParadaResposta(
            UUID id,
            UUID motivoId,
            String motivo,
            CategoriaParada categoria,
            OffsetDateTime inicio,
            OffsetDateTime fim,
            BigDecimal horas,
            String descricao,
            boolean visivelCliente) {
    }

    public record PecaResposta(
            UUID id,
            String descricao,
            BigDecimal quantidade,
            String fornecedor,
            StatusPeca status,
            String statusDescricao,
            OrigemPeca origem,
            String origemDescricao,
            MomentoDaPeca momentoNecessario,
            String momentoDescricao,
            LocalDate previsaoChegada,
            BigDecimal valorUnitario,
            BigDecimal total) {
    }

    /**
     * O mecanico contando o que esta fazendo.
     *
     * A visibilidade e escolha dele em cada registro, e nao uma configuracao
     * da oficina: "troquei a correia" o cliente quer ler; "cliente enrolou
     * para aprovar, perdi a manha" e conversa interna. Misturar os dois num
     * unico interruptor faria a oficina parar de registrar o segundo.
     */
    public record TrabalhoRequisicao(
            @NotBlank(message = "Escreva o que foi feito.")
            @Size(max = 400, message = "Use ate 400 caracteres.")
            String texto,
            boolean visivelCliente) {
    }

    /** Uma linha do checklist respondida pelo mecanico. */
    public record ChecklistItemRequisicao(
            @NotNull UUID id,
            Boolean ok,
            @Size(max = 300) String observacao) {
    }

    public record ChecklistRequisicao(
            @NotNull @Valid List<ChecklistItemRequisicao> itens) {
    }

    /**
     * Situacao das pecas de um carro, resumida para o card do patio.
     *
     * Falta de peca e o motivo numero um de carro parado, e os dois estados
     * pedem acoes opostas: ESPERANDO quer telefone para o fornecedor,
     * CHEGOU quer mecanico. Quando isso so aparece dentro da OS, o carro
     * cuja peca chegou na terca continua parado ate alguem abrir a tela.
     */
    public enum StatusPecaCard {
        NENHUMA,
        ESPERANDO,
        CHEGOU
    }

    public record ChecklistResposta(UUID id, String descricao, Boolean ok, String observacao) {
    }

    public record EventoResposta(
            UUID id,
            String tipo,
            String descricao,
            String autor,
            OffsetDateTime quando,
            boolean visivelCliente) {
    }

    public record ArquivoResposta(
            UUID id,
            String nome,
            String url,
            String momento,
            boolean visivelCliente,
            OffsetDateTime quando) {
    }

    public record CompartilhamentoResposta(
            UUID id,
            String url,
            String token,
            OffsetDateTime expiraEm,
            boolean ativo,
            int totalAcessos,
            OffsetDateTime ultimoAcessoEm,
            java.util.Map<String, Boolean> escopo) {
    }

    /** Tela de detalhe da OS. */
    public record Detalhe(
            Resumo resumo,
            String diagnostico,
            Integer kmEntrada,
            OffsetDateTime entradaEm,
            OffsetDateTime aprovadoEm,
            OffsetDateTime inicioExecucaoEm,
            OffsetDateTime prontoEm,
            OffsetDateTime entregueEm,
            BigDecimal valorPecas,
            BigDecimal valorMaoObra,
            BigDecimal desconto,
            BigDecimal valorTotal,
            List<StatusOs> proximosStatus,
            List<ItemResposta> itens,
            List<ApontamentoResposta> apontamentos,
            List<ParadaResposta> paradas,
            List<PecaResposta> pecas,
            List<ChecklistResposta> checklist,
            List<ArquivoResposta> arquivos,
            List<EventoResposta> eventos,
            CompartilhamentoResposta compartilhamento) {
    }
}
