package br.com.oficina.leitura;

import br.com.oficina.common.RegraNegocioException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * O parser do relatorio do Autel, testado com as linhas reais do relatorio
 * de um Civic 2014 — em portugues de Portugal, com acento, virgula decimal,
 * minimo negativo e as bandas que se repetem em cada pagina.
 *
 * Nenhum PDF binario no repositorio: o pedaco dificil e texto -> dado.
 */
class AnalisadorRelatorioAutelTest {

    private final AnalisadorRelatorioAutel analisador = new AnalisadorRelatorioAutel();

    /** Pagina 1 com cabecalho, tabela e o rodape que se repete. */
    private static final String RELATORIO = """
            AUTEL                              Numero do relatorio: MAXIA20260922155932
            Oficina: --                        Tempo de teste: 2026-09-22 15:59:32
            Tel: --                            Nome do tecnico: --

            2014 Honda RELATÓRIO DE DIAGNÓSTICO DO VEÍCULO

            Informações do veículo
            2014/Honda/Civic
            VIN: 93HFB2630EZ168620
            Caminho: Seleção automática > GERAL > Diagnóstico > Unidade de controlo > PGM-FI > Dados actuais >
            Quilometragem: 175811 km      Matrícula: OOO1A06      Submodelo: GERAL

            Informações do cliente
            Nome: CivicG9                 Tel: 389984238806

            Informações do dispositivo
            Ferramenta: MaxiDAS DS900-BT  Versão: V4.00   Número de série: VX2GR5C01294

            Dados actuais
            NO.   Nome                     Valor   MIN    MÁX     Unidade
            1     Rotação do motor         728     0      9973    RPM
            2     Velocidade do veículo    0       0      180     km/h
            3     Sensor ECT 1             81.0    -40    119     °C
            5     Sensor IAT (1)           34.0    -40    80      °C
            6     SENSOR MAP               24      1      255     kPa
            7     Sensor MAF               2,1     0      50      g/s
            8     CLV                      29      0      100     %
            11    Sensor TP REL            3.53    0      90      °
            14    Sensor A APP 1           0.94    0      5       V
            17    Vál. Borboleta           3.6     0      99.8    °

            AUTEL  www.autel.com  MaxiDAS DS900-BT                                    1
            2014/Honda/Civic       Tempo de teste: 2026-09-22 15:59:32
            """;

    @Test
    @DisplayName("le o cabecalho: modelo, ano, km, ferramenta e momento do teste")
    void cabecalho() {
        RelatorioScanner.Cabecalho c = analisador.analisar(RELATORIO).cabecalho();

        assertThat(c.marca()).isEqualTo("Honda");
        assertThat(c.modelo()).isEqualTo("Civic");
        assertThat(c.ano()).isEqualTo(2014);
        assertThat(c.km()).isEqualTo(175811);
        assertThat(c.numeroRelatorio()).isEqualTo("MAXIA20260922155932");
        assertThat(c.momentoTeste()).isNotNull();
        assertThat(c.momentoTeste().getHour()).isEqualTo(15);
    }

    @Test
    @DisplayName("NAO guarda VIN, nome nem telefone do cliente, nem serie do aparelho")
    void naoGuardaDadoSensivel() {
        // Decisao de privacidade, nao acidente: se um dia alguem adicionar um
        // campo para VIN, este teste quebra e a conversa acontece de novo.
        String tudo = analisador.analisar(RELATORIO).toString();

        assertThat(tudo)
                .doesNotContain("93HFB2630EZ168620")   // VIN
                .doesNotContain("CivicG9")             // nome do cliente
                .doesNotContain("389984238806")        // telefone
                .doesNotContain("VX2GR5C01294");       // serie do aparelho
    }

    @Test
    @DisplayName("o modulo sai do Caminho: o segmento antes de 'Dados actuais'")
    void moduloVemDoCaminho() {
        List<RelatorioScanner.Modulo> modulos = analisador.analisar(RELATORIO).modulos();

        assertThat(modulos).hasSize(1);
        assertThat(modulos.get(0).nome()).isEqualTo("PGM-FI");
        assertThat(modulos.get(0).caminho()).contains("Unidade de controlo");
    }

    @Test
    @DisplayName("le as dez linhas de dados com numero, valor, minimo, maximo e unidade")
    void itens() {
        List<RelatorioScanner.Item> itens = analisador.analisar(RELATORIO).modulos().get(0).itens();

        assertThat(itens).hasSize(10);

        RelatorioScanner.Item rotacao = itens.get(0);
        assertThat(rotacao.numero()).isEqualTo(1);
        assertThat(rotacao.nome()).isEqualTo("Rotação do motor");
        assertThat(rotacao.valorNumerico()).isEqualByComparingTo("728");
        assertThat(rotacao.maximo()).isEqualByComparingTo("9973");
        assertThat(rotacao.unidade()).isEqualTo("RPM");
    }

    @Test
    @DisplayName("minimo negativo sobrevive (-40 do sensor de temperatura)")
    void minimoNegativo() {
        RelatorioScanner.Item ect = itemChamado("Sensor ECT 1");

        assertThat(ect.minimo()).isEqualByComparingTo("-40");
        assertThat(ect.maximo()).isEqualByComparingTo("119");
        assertThat(ect.unidade()).isEqualTo("°C");
    }

    @Test
    @DisplayName("virgula decimal vira ponto sem estragar o numero")
    void virgulaDecimal() {
        RelatorioScanner.Item maf = itemChamado("Sensor MAF");

        assertThat(maf.valor()).isEqualTo("2,1");
        assertThat(maf.valorNumerico()).isEqualByComparingTo("2.1");
        assertThat(maf.unidade()).isEqualTo("g/s");
    }

    @Test
    @DisplayName("guarda o texto original do valor junto com o numero")
    void guardaTextoEnumero() {
        RelatorioScanner.Item tp = itemChamado("Sensor TP REL");

        assertThat(tp.valor()).isEqualTo("3.53");
        assertThat(tp.valorNumerico()).isEqualByComparingTo("3.53");
        assertThat(tp.unidade()).isEqualTo("°");
    }

    @Test
    @DisplayName("nome com ponto e acento nao quebra a coluna (Vál. Borboleta)")
    void nomeComPontoEacento() {
        RelatorioScanner.Item borboleta = itemChamado("Vál. Borboleta");

        assertThat(borboleta.numero()).isEqualTo(17);
        assertThat(borboleta.maximo()).isEqualByComparingTo("99.8");
    }

    @Test
    @DisplayName("buraco na numeracao do scanner e preservado (1,2,3,5,6...)")
    void numeracaoComBuraco() {
        List<Integer> numeros = analisador.analisar(RELATORIO).modulos().get(0).itens()
                .stream().map(RelatorioScanner.Item::numero).toList();

        assertThat(numeros).containsExactly(1, 2, 3, 5, 6, 7, 8, 11, 14, 17);
    }

    @Test
    @DisplayName("dois Caminho: no mesmo PDF viram dois modulos")
    void doisModulos() {
        String doisModulos = RELATORIO + """

                Caminho: Seleção automática > GERAL > Unidade de controlo > ABS > Dados actuais >
                NO.   Nome                     Valor   MIN    MÁX     Unidade
                1     Roda diant. esquerda     0       0      300     km/h
                2     Roda diant. direita      0       0      300     km/h
                """;

        List<RelatorioScanner.Modulo> modulos = analisador.analisar(doisModulos).modulos();

        assertThat(modulos).hasSize(2);
        assertThat(modulos).extracting(RelatorioScanner.Modulo::nome).containsExactly("PGM-FI", "ABS");
        assertThat(modulos.get(1).itens()).hasSize(2);
    }

    @Test
    @DisplayName("texto sem tabela nenhuma da erro em portugues, nunca 500")
    void textoSemTabela() {
        assertThatThrownBy(() -> analisador.analisar("uma folha qualquer sem tabela de scanner"))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("nenhuma linha de dados foi reconhecida");
    }

    @Test
    @DisplayName("PDF vazio avisa sobre imagem escaneada em vez de estourar")
    void textoVazio() {
        assertThatThrownBy(() -> analisador.analisar("  "))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("imagem escaneada");
    }

    private RelatorioScanner.Item itemChamado(String nome) {
        return analisador.analisar(RELATORIO).modulos().get(0).itens().stream()
                .filter(i -> i.nome().equals(nome))
                .findFirst()
                .orElseThrow(() -> new AssertionError("item nao encontrado: " + nome));
    }
}
