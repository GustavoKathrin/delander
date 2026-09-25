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
            /** Nulo assume COMPRAR: o caso que exige trabalho de alguem. */
            OrigemPeca origem,
            /** Nulo assume DURANTE: nao trava ninguem sem alguem dizer que trava. */
            MomentoDaPeca momentoNecessario,
            LocalDate previsaoChegada,
            @DecimalMin(value = "0.0", message = "Valor nao pode ser negativo") BigDecimal valorUnitario) {
    }

    /**
     * Uma linha da fila de compras.
     *
     * Traz o calculo pronto em vez de mandar a tela refazer: prazo, risco e
     * folga saem da agenda do carro, e essa conta tem que ter uma versao so.
     *
     * @param comprarAte   quando NOS precisamos dela (vem do carro); nulo = sem dia marcado
     * @param emRisco      o fornecedor prometeu para depois do que precisamos
     * @param diasDeFolga  quantos dias sobram ate o prazo; negativo = ja passou
     * @param carroParado  a OS nao tem dia agendado: o carro esta esperando esta peca
     */
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
                           MomentoDaPeca momentoNecessario,
                           String momentoDescricao,
                           BigDecimal valorUnitario,
                           LocalDate previsaoChegada,
                           LocalDate comprarAte,
                           boolean emRisco,
                           Integer diasDeFolga,
                           boolean carroParado) {
    }
}
