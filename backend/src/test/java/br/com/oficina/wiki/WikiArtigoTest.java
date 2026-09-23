package br.com.oficina.wiki;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O "alcance" e o que o mecanico le para saber se o artigo serve para o carro
 * que esta na frente dele. Formatar errado aqui e pior que nao mostrar.
 */
class WikiArtigoTest {

    @Test
    @DisplayName("faixa de anos vira intervalo")
    void faixaDeAnos() {
        assertThat(artigo("Honda", "Civic", 2012, 2016, "2.0 flex").alcance())
                .isEqualTo("Honda Civic 2012-2016 · 2.0 flex");
    }

    @Test
    @DisplayName("ano unico nao vira intervalo repetido")
    void anoUnico() {
        assertThat(artigo("Honda", "Civic", 2014, 2014, null).alcance())
                .isEqualTo("Honda Civic 2014");
    }

    @Test
    @DisplayName("faixa aberta diz 'de' ou 'ate'")
    void faixaAberta() {
        assertThat(artigo("Fiat", "Argo", 2018, null, null).alcance()).isEqualTo("Fiat Argo de 2018");
        assertThat(artigo("Fiat", "Argo", null, 2020, null).alcance()).isEqualTo("Fiat Argo ate 2020");
    }

    @Test
    @DisplayName("sem marca e modelo, o artigo vale para qualquer carro")
    void semModelo() {
        assertThat(artigo(null, null, null, null, null).alcance()).isEqualTo("Qualquer veiculo");
    }

    @Test
    @DisplayName("so a marca ja e um alcance valido")
    void soMarca() {
        assertThat(artigo("Jeep", null, null, null, null).alcance()).isEqualTo("Jeep");
    }

    @Test
    @DisplayName("motor sozinho aparece sem sobra de separador")
    void soMotor() {
        assertThat(artigo(null, null, null, null, "1.0 turbo").alcance()).isEqualTo("1.0 turbo");
    }

    private WikiArtigo artigo(String marca, String modelo, Integer de, Integer ate, String motor) {
        WikiArtigo a = new WikiArtigo();
        a.setMarca(marca);
        a.setModelo(modelo);
        a.setAnoDe(de);
        a.setAnoAte(ate);
        a.setMotor(motor);
        return a;
    }
}
