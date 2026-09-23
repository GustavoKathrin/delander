package br.com.oficina.leitura;

import br.com.oficina.common.RegraNegocioException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * O caminho de verdade: bytes de PDF -> texto -> rascunho de leitura.
 *
 * O PDF e montado com o proprio PDFBox no momento do teste, entao nenhum
 * binario entra no repositorio e o Loader/PDFTextStripper sao exercitados
 * de fato.
 */
class LeitorPdfAutelTest {

    private final LeitorPdfAutel leitor = new LeitorPdfAutel();
    private final AnalisadorRelatorioAutel analisador = new AnalisadorRelatorioAutel();

    private static final String RELATORIO = """
            2014/Honda/Civic
            Quilometragem: 175811 km
            Ferramenta: MaxiDAS DS900-BT
            Numero do relatorio: MAXIA20260922155932
            Tempo de teste: 2026-09-22 15:59:32
            Caminho: Selecao automatica > GERAL > Unidade de controlo > PGM-FI > Dados actuais >
            Dados actuais
            NO. Nome Valor MIN MAX Unidade
            1 Rotacao do motor 728 0 9973 RPM
            6 SENSOR MAP 24 1 255 kPa
            7 Sensor MAF 2.1 0 50 g/s
            """;

    @Test
    @DisplayName("le um PDF de verdade e chega no dado do modulo")
    void lePdfDeVerdade() throws IOException {
        byte[] pdf = GeradorPdfDeTeste.comTexto(RELATORIO);

        RelatorioScanner.Previa previa = analisador.analisar(leitor.extrairTexto(pdf));

        assertThat(previa.cabecalho().marca()).isEqualTo("Honda");
        assertThat(previa.cabecalho().ano()).isEqualTo(2014);
        assertThat(previa.cabecalho().numeroRelatorio()).isEqualTo("MAXIA20260922155932");
        assertThat(previa.modulos()).hasSize(1);
        assertThat(previa.modulos().get(0).nome()).isEqualTo("PGM-FI");
        assertThat(previa.modulos().get(0).itens()).hasSize(3);
        assertThat(previa.modulos().get(0).itens().get(1).nome()).isEqualTo("SENSOR MAP");
        assertThat(previa.modulos().get(0).itens().get(1).unidade()).isEqualTo("kPa");
    }

    @Test
    @DisplayName("arquivo que nao e PDF nao vira 500")
    void arquivoQuebrado() {
        assertThatThrownBy(() -> leitor.extrairTexto("isto nao e um pdf".getBytes()))
                .isInstanceOf(RegraNegocioException.class);
    }

    @Test
    @DisplayName("arquivo vazio da mensagem em portugues")
    void arquivoVazio() {
        assertThatThrownBy(() -> leitor.extrairTexto(new byte[0]))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("vazio");
    }
}
