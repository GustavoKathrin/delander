package br.com.oficina.cliente;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ClienteDtos {

    private ClienteDtos() {
    }

    public record Requisicao(
            @NotBlank(message = "Informe o nome") @Size(max = 160) String nome,
            @Size(max = 30) String documento,
            @Size(max = 30) String telefone,
            @Email(message = "E-mail invalido") @Size(max = 180) String email,
            String observacoes,
            Boolean consentimentoContato,
            /** null = usa o padrao da oficina. */
            Boolean compartilhamentoHabilitado,
            /** Sobrescreve, para este cliente, o que o link publico mostra. */
            Map<String, Boolean> escopoCompartilhamento,
            Boolean ativo) {
    }

    public record VeiculoResumo(UUID id,
                                String placa,
                                String descricao,
                                String marca,
                                String modelo,
                                Integer ano,
                                String cor,
                                Integer km) {
    }

    public record Resposta(UUID id,
                           String nome,
                           String documento,
                           String telefone,
                           String email,
                           String observacoes,
                           boolean consentimentoContato,
                           Boolean compartilhamentoHabilitado,
                           Map<String, Object> escopoCompartilhamento,
                           boolean ativo,
                           boolean anonimizado,
                           List<VeiculoResumo> veiculos) {
    }
}
