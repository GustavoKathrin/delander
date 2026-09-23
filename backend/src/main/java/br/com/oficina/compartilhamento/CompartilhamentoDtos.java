package br.com.oficina.compartilhamento;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public final class CompartilhamentoDtos {

    private CompartilhamentoDtos() {
    }

    public record Requisicao(Map<String, Boolean> escopo, String pin) {
    }

    public record AtualizacaoRequisicao(Boolean ativo,
                                        Map<String, Boolean> escopo,
                                        Integer diasValidade,
                                        String pin) {
    }

    public record Resposta(UUID id,
                           String url,
                           String token,
                           String pin,
                           OffsetDateTime expiraEm,
                           boolean ativo,
                           int totalAcessos,
                           OffsetDateTime ultimoAcessoEm,
                           Map<String, Boolean> escopo) {
    }
}
