package br.com.oficina.leitura;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O que estes testes protegem: leitura incompleta que se parece com leitura
 * completa. Foi assim que 38 de 133 linhas sumiram em producao sem ninguem
 * ver — o sistema mostrou "95 itens" com ar de sucesso.
 */
class AnalisadorDeRelatoriosTest {

    private final AnalisadorRelatorioAutel alinhado = new AnalisadorRelatorioAutel();
    private final AnalisadorDeRelatorios analisador =
            new AnalisadorDeRelatorios(alinhado, new AnalisadorPorColunas(alinhado));

    /**
     * Tabela com as linhas que a estrategia alinhada NAO le: valor de texto
     * ("ON", "Ativo"), traco no lugar de minimo/maximo, codigo de falha.
     * Todas sao linhas normais de scanner.
     */
    private static final String COM_LINHAS_DIFICEIS = """
            AUTEL                              Numero do relatorio: MAXIA20260922155932
            Tempo de teste: 2026-09-22 15:59:32

            Informações do veículo
            2014/Honda/Civic
            Caminho: Seleção automática > GERAL > Diagnóstico > PGM-FI > Dados actuais >
            Quilometragem: 175811 km      Matrícula: OOO1A06

            Dados actuais
            NO.   Nome                     Valor   MIN    MÁX     Unidade
            1     Rotação do motor         728     0      9973    RPM
            2     Sensor de oxigênio       ON      -      -       -
            3     Status da embreagem      Ativo
            4     Código de falha          P0301   ---    ---
            5     Sensor IAT (1)           34.0    -40    80      °C
            """;

    @Test
    @DisplayName("a estrategia alinhada sozinha perde as linhas de texto")
    void alinhadaPerdeLinhas() {
        RelatorioScanner.Previa so = alinhado.analisar(COM_LINHAS_DIFICEIS);

        // 2, 3 e 4 nao casam com "numero nome valor min max": nao tem tres numeros.
        assertThat(so.qualidade().faltando()).contains(2, 3, 4);
        assertThat(so.qualidade().confiavel()).isFalse();
    }

    @Test
    @DisplayName("o orquestrador cai para a estrategia tolerante e recupera as linhas")
    void fallbackRecuperaLinhas() {
        RelatorioScanner.Previa previa = analisador.analisar(COM_LINHAS_DIFICEIS);

        assertThat(previa.qualidade().faltando()).isEmpty();
        assertThat(previa.qualidade().lidos()).isEqualTo(5);
        assertThat(previa.qualidade().estrategia()).isEqualTo(AnalisadorPorColunas.NOME);

        // "ON" e um valor tao legitimo quanto "728": nao pode virar nulo.
        String valores = previa.modulos().get(0).itens().stream()
                .map(RelatorioScanner.Item::valor)
                .reduce("", (a, b) -> a + "|" + b);
        assertThat(valores).contains("ON").contains("Ativo").contains("P0301");
    }

    @Test
    @DisplayName("quando a primeira estrategia le tudo, a segunda nem roda")
    void naoTrocaColunasCertasPorErradas() {
        String limpo = """
                2014/Honda/Civic
                Caminho: Seleção automática > GERAL > PGM-FI > Dados actuais >
                NO.   Nome                     Valor   MIN    MÁX     Unidade
                1     Rotação do motor         728     0      9973    RPM
                2     Sensor IAT (1)           34.0    -40    80      °C
                """;

        RelatorioScanner.Previa previa = analisador.analisar(limpo);

        assertThat(previa.qualidade().confiavel()).isTrue();
        assertThat(previa.qualidade().estrategia()).isEqualTo(AnalisadorRelatorioAutel.NOME);
        // A precisa separa as colunas; e por isso que ela vem primeiro.
        assertThat(previa.modulos().get(0).itens().get(0).unidade()).isEqualTo("RPM");
    }

    @Test
    @DisplayName("o rotulo do campo seguinte nao entra no modelo nem na ferramenta")
    void naoColaRotuloNoValor() {
        // Foi assim que o modelo virou "Civic Quilometragem: 175811 km" em
        // producao, e aquele Civic parou de casar com os outros Civic 2014.
        String coladoNaMesmaLinha = """
                2014/Honda/Civic Quilometragem: 175811 km
                Caminho: Seleção automática > GERAL > Unidade Submodelo: PGM-FI > Dados actuais >
                Ferramenta: MaxiDAS DS900-BT Número de série: VX2GR5C01294
                NO.   Nome                     Valor   MIN    MÁX     Unidade
                1     Rotação do motor         728     0      9973    RPM
                """;

        RelatorioScanner.Previa previa = analisador.analisar(coladoNaMesmaLinha);

        assertThat(previa.cabecalho().modelo()).isEqualTo("Civic");
        assertThat(previa.cabecalho().ferramenta()).isEqualTo("MaxiDAS DS900-BT");
        assertThat(previa.modulos().get(0).nome()).isEqualTo("PGM-FI");
    }
}
