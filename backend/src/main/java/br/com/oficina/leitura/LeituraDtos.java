package br.com.oficina.leitura;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class LeituraDtos {

    private LeituraDtos() {
    }

    // ============================================================ entrada

    public record ItemRequisicao(
            Integer numero,
            @NotBlank(message = "O item precisa de nome") @Size(max = 200) String nome,
            @Size(max = 60) String valor,
            BigDecimal valorNumerico,
            BigDecimal minimo,
            BigDecimal maximo,
            @Size(max = 20) String unidade) {
    }

    public record ModuloRequisicao(
            @NotBlank(message = "O modulo precisa de nome") @Size(max = 80) String nome,
            @Size(max = 400) String caminho,
            @Valid List<ItemRequisicao> itens) {
    }

    /**
     * O que o usuario confirma depois de conferir a previa.
     *
     * motorLigado, ignicaoLigada, tipo e condicao NAO estao no PDF: quem
     * estava no carro informa. E por isso que o parser nunca grava sozinho.
     */
    public record Requisicao(
            UUID veiculoId,
            @Size(max = 60) String marca,
            @Size(max = 80) String modelo,
            Integer ano,
            @Size(max = 60) String motor,
            TipoLeitura tipo,
            @Size(max = 160) String condicao,
            String descricao,
            Boolean motorLigado,
            Boolean ignicaoLigada,
            Integer km,
            UUID ordemServicoId,
            /** PDF enviado na previa; ausente quando a leitura e digitada. */
            UUID arquivoId,
            @Size(max = 120) String ferramenta,
            @Size(max = 40) String ferramentaVersao,
            @Size(max = 60) String numeroRelatorio,
            OffsetDateTime momentoTeste,
            /** Anexar a uma leitura que ja existe, em vez de criar outra. */
            UUID anexarEm,
            @Valid List<ModuloRequisicao> modulos) {
    }

    // ============================================================ saida

    public record ItemResposta(
            UUID id,
            Integer numero,
            String nome,
            String valor,
            BigDecimal valorNumerico,
            BigDecimal minimo,
            BigDecimal maximo,
            String unidade,
            boolean foraDaFaixa) {
    }

    public record ModuloResposta(UUID id, String nome, String caminho, List<ItemResposta> itens) {
    }

    public record Resumo(
            UUID id,
            UUID veiculoId,
            String placa,
            String marca,
            String modelo,
            Integer ano,
            String motor,
            String modeloDescricao,
            TipoLeitura tipo,
            String tipoDescricao,
            String condicao,
            boolean motorLigado,
            boolean ignicaoLigada,
            OrigemLeitura origem,
            SituacaoLeitura situacao,
            OffsetDateTime momentoTeste,
            Integer km,
            int modulos,
            int itens,
            boolean temPdf) {
    }

    public record Detalhe(Resumo resumo,
                          String descricao,
                          String ferramenta,
                          String ferramentaVersao,
                          String numeroRelatorio,
                          UUID ordemServicoId,
                          UUID arquivoId,
                          List<ModuloResposta> modulos) {
    }

    /**
     * O rascunho devolvido pela importacao. NADA disso foi gravado ainda,
     * fora o proprio PDF.
     */
    public record Previa(
            UUID arquivoId,
            String marca,
            String modelo,
            Integer ano,
            Integer km,
            String placaSugerida,
            /** Preenchido quando a placa do relatorio bate com um carro cadastrado. */
            UUID veiculoSugeridoId,
            String veiculoSugeridoDescricao,
            String ferramenta,
            String ferramentaVersao,
            String numeroRelatorio,
            OffsetDateTime momentoTeste,
            List<ModuloResposta> modulos,
            List<String> avisos) {
    }
}
