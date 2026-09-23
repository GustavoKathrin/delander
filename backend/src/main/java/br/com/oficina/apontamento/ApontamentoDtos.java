package br.com.oficina.apontamento;

import br.com.oficina.ordemservico.Prioridade;
import br.com.oficina.ordemservico.StatusItem;
import br.com.oficina.ordemservico.StatusOs;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public final class ApontamentoDtos {

    private ApontamentoDtos() {
    }

    public record IniciarRequisicao(
            @NotNull(message = "Informe o servico") UUID osItemId,
            @DecimalMin(value = "0.1", message = "A estimativa precisa ser maior que zero")
            BigDecimal horasEstimadas,
            @Size(max = 400) String observacao) {
    }

    public record PausarRequisicao(
            UUID motivoParadaId,
            @Size(max = 400) String descricao,
            Boolean visivelCliente) {
    }

    public record ConcluirRequisicao(@Size(max = 400) String observacao) {
    }

    /** Card do Painel do Mecanico. Tudo o que ele precisa ver de dentro do box. */
    public record MeuServico(
            UUID itemId,
            UUID osId,
            long numeroOs,
            String placa,
            String veiculo,
            String cor,
            String cliente,
            String queixa,
            String descricao,
            String especialidade,
            String especialidadeCor,
            BigDecimal horasEstimadas,
            BigDecimal horasTrabalhadas,
            StatusItem status,
            String statusDescricao,
            StatusOs statusOs,
            Prioridade prioridade,
            LocalDate dataAgendada,
            LocalDate previsaoEntrega,
            String box,
            UUID apontamentoAbertoId,
            OffsetDateTime apontamentoInicio,
            BigDecimal horasEstimadasInformadas,
            String mecanicoNome,
            boolean meu,
            /** O servico sobe o carro: o mecanico ve o selo na task. */
            boolean precisaElevador) {
    }
}
