package br.com.oficina.configuracao;

import jakarta.validation.constraints.NotEmpty;

import java.util.Map;

public final class ConfiguracaoDtos {

    private ConfiguracaoDtos() {
    }

    public record Item(String chave, String valor, String tipo, String grupo) {
    }

    public record AtualizacaoRequisicao(
            @NotEmpty(message = "Envie ao menos uma configuracao") Map<String, String> valores) {
    }
}
