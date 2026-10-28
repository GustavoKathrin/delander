package br.com.oficina.arquivo;

import br.com.oficina.ordemservico.OsDtos;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O anexo visto pela tela.
 *
 * Tres telas dependem de `imagem` para decidir entre <img> e um chip de
 * arquivo: a galeria da OS, a tira do painel do mecanico e o prontuario.
 * Se o PDF do fornecedor passar por imagem, as tres mostram quadrado
 * quebrado -- e nenhuma delas tem como descobrir sozinha.
 */
class ArquivoRespostaTest {

    private static ArquivoOs anexo(String contentType) {
        ArquivoOs a = new ArquivoOs();
        a.setOrdemServicoId(UUID.randomUUID());
        a.setNomeOriginal("foto.jpg");
        a.setCaminho("os/foto.jpg");
        a.setContentType(contentType);
        return a;
    }

    @Test
    @DisplayName("JPG e miniatura; PDF nao e")
    void sabeOQueDaParaDesenhar() {
        assertThat(ArquivoService.resposta(anexo("image/jpeg"), null).imagem()).isTrue();
        assertThat(ArquivoService.resposta(anexo("image/webp"), null).imagem()).isTrue();
        assertThat(ArquivoService.resposta(anexo("application/pdf"), null).imagem()).isFalse();
    }

    @Test
    @DisplayName("Anexo antigo, sem content type, nao finge ser imagem")
    void semContentTypeNaoEImagem() {
        // As fotos gravadas antes de o armazenamento conferir o tipo pelos
        // bytes podem nao ter content_type. Chutar "imagem" nelas quebraria a
        // galeria justamente no historico, que e onde ninguem volta para
        // consertar.
        assertThat(ArquivoService.resposta(anexo(null), null).imagem()).isFalse();
    }

    @Test
    @DisplayName("O nome do servico vai pronto para a legenda")
    void carregaONomeDoServico() {
        ArquivoOs a = anexo("image/jpeg");
        UUID item = UUID.randomUUID();
        a.setOsItemId(item);

        OsDtos.ArquivoResposta r = ArquivoService.resposta(a, "Troca da correia dentada");

        assertThat(r.osItemId()).isEqualTo(item);
        assertThat(r.servico()).isEqualTo("Troca da correia dentada");
        assertThat(r.url()).isEqualTo("/api/os/%s/arquivos/%s".formatted(a.getOrdemServicoId(), r.id()));
    }

    @Test
    @DisplayName("Foto do carro nao inventa servico")
    void semServicoFicaNulo() {
        OsDtos.ArquivoResposta r = ArquivoService.resposta(anexo("image/png"), null);

        assertThat(r.osItemId()).isNull();
        assertThat(r.servico()).isNull();
    }
}
