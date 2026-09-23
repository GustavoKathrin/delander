package br.com.oficina.veiculo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.UUID;

public final class VeiculoDtos {

    private VeiculoDtos() {
    }

    public record Requisicao(
            @NotNull(message = "Informe o cliente") UUID clienteId,
            @NotBlank(message = "Informe a placa") @Size(max = 10) String placa,
            @Size(max = 60) String marca,
            @Size(max = 80) String modelo,
            Integer ano,
            @Size(max = 40) String cor,
            Integer km,
            @Size(max = 40) String chassi,
            String observacoes,
            Boolean ativo) {
    }

    public record Resposta(UUID id,
                           UUID clienteId,
                           String clienteNome,
                           String clienteTelefone,
                           String placa,
                           String descricao,
                           String marca,
                           String modelo,
                           Integer ano,
                           String cor,
                           Integer km,
                           String chassi,
                           String observacoes,
                           boolean ativo) {

        public static Resposta de(Veiculo v) {
            return new Resposta(
                    v.getId(),
                    v.getCliente().getId(),
                    v.getCliente().getNome(),
                    v.getCliente().getTelefone(),
                    v.getPlaca(),
                    v.descricaoCurta(),
                    v.getMarca(),
                    v.getModelo(),
                    v.getAno(),
                    v.getCor(),
                    v.getKm(),
                    v.getChassi(),
                    v.getObservacoes(),
                    v.isAtivo());
        }
    }

    public record ProprietarioHistorico(UUID clienteId,
                                        String clienteNome,
                                        OffsetDateTime inicio,
                                        OffsetDateTime fim) {
    }
}
