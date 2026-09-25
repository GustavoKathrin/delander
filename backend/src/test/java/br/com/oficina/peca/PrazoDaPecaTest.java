package br.com.oficina.peca;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O prazo da peca nao e um campo: e consequencia de quando ela faz falta.
 *
 * Foi o dono quem trouxe essa ideia, recusando as opcoes de "digite a data".
 * Estes testes guardam a regra, que e o unico lugar onde ela existe.
 */
class PrazoDaPecaTest {

    private static final LocalDate AGENDADO = LocalDate.of(2026, 9, 26);
    private static final LocalDate ENTREGA = LocalDate.of(2026, 9, 30);

    @Test
    @DisplayName("peca que trava o inicio herda o dia agendado do carro")
    void inicioUsaDataAgendada() {
        assertThat(MomentoDaPeca.INICIO.prazo(AGENDADO, ENTREGA)).isEqualTo(AGENDADO);
    }

    @Test
    @DisplayName("peca que faz falta depois herda a entrega prometida")
    void duranteUsaPrevisaoEntrega() {
        assertThat(MomentoDaPeca.DURANTE.prazo(AGENDADO, ENTREGA)).isEqualTo(ENTREGA);
    }

    @Test
    @DisplayName("sem a data do carro nao existe prazo — e isso e urgencia, nao folga")
    void semDataDoCarroNaoHaPrazo() {
        // Carro sem dia marcado esperando peca que trava o inicio e o pior
        // caso da oficina: ninguem sabe quando ele anda. Quem consome trata
        // nulo como topo da fila, e nao como "da tempo".
        assertThat(MomentoDaPeca.INICIO.prazo(null, ENTREGA)).isNull();
        assertThat(MomentoDaPeca.DURANTE.prazo(AGENDADO, null)).isNull();
    }

    @Test
    @DisplayName("os dois momentos sabem se apresentar em portugues")
    void descricoes() {
        assertThat(MomentoDaPeca.INICIO.descricao()).isEqualTo("Para começar");
        assertThat(MomentoDaPeca.DURANTE.descricao()).isEqualTo("Antes de terminar");
        assertThat(OrigemPeca.ESTOQUE.descricao()).isEqualTo("Temos aqui");
        assertThat(OrigemPeca.COMPRAR.descricao()).isEqualTo("Precisa comprar");
    }
}
