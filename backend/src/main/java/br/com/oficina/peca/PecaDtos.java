package br.com.oficina.peca;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public final class PecaDtos {

    private PecaDtos() {
    }

    public record Requisicao(
            @NotBlank(message = "Informe a peca") @Size(max = 200) String descricao,
            @DecimalMin(value = "0.01", message = "Quantidade precisa ser maior que zero") BigDecimal quantidade,
            @Size(max = 160) String fornecedor,
            StatusPeca status,
            LocalDate previsaoChegada,
            @DecimalMin(value = "0.0", message = "Valor nao pode ser negativo") BigDecimal valorUnitario) {
    }

    /** Lista de pecas pendentes da oficina inteira: a fila de compras do dono. */
    public record Pendente(UUID id,
                           UUID osId,
                           long numeroOs,
                           String placa,
                           String cliente,
                           String descricao,
                           BigDecimal quantidade,
                           String fornecedor,
                           StatusPeca status,
                           String statusDescricao,
                           LocalDate previsaoChegada) {
    }
}
