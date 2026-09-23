package br.com.oficina.wiki;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class WikiDtos {

    private WikiDtos() {
    }

    public record Requisicao(
            @NotBlank(message = "O artigo precisa de um titulo") @Size(max = 200) String titulo,
            @NotBlank(message = "Escreva o que foi feito") String corpo,
            @Size(max = 60) String marca,
            @Size(max = 80) String modelo,
            @Size(max = 60) String motor,
            Integer anoDe,
            Integer anoAte,
            List<String> tags,
            UUID veiculoId,
            UUID ordemServicoId,
            UUID leituraId,
            Boolean publicado,
            /** Fotos enviadas antes de salvar o artigo. */
            List<UUID> arquivos) {
    }

    public record FotoResposta(UUID id, String url, String legenda, int ordem) {
    }

    public record Resumo(
            UUID id,
            String titulo,
            String alcance,
            String marca,
            String modelo,
            String motor,
            Integer anoDe,
            Integer anoAte,
            List<String> tags,
            boolean publicado,
            String autor,
            OffsetDateTime criadoEm,
            OffsetDateTime atualizadoEm,
            int fotos,
            /** Primeiras linhas do corpo, para a lista nao ficar so titulo. */
            String previa) {
    }

    public record Detalhe(Resumo resumo,
                          String corpo,
                          UUID veiculoId,
                          UUID ordemServicoId,
                          UUID leituraId,
                          List<FotoResposta> fotos) {
    }

    public record FotoEnviada(UUID id, String url) {
    }
}
