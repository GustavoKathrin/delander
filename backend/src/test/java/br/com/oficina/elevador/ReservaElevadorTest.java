package br.com.oficina.elevador;

import br.com.oficina.cadastro.Box;
import br.com.oficina.cadastro.TipoBox;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A regra que faz o elevador ser diferente da vaga: ele corre em HORA.
 *
 * A vaga e ocupada por dia (o carro dorme na oficina); o elevador nao — um
 * alinhamento de 1h nao pode travar o elevador das 8h as 18h.
 */
class ReservaElevadorTest {

    private static final OffsetDateTime AGORA =
            OffsetDateTime.of(2026, 9, 22, 9, 0, 0, 0, ZoneOffset.ofHours(-3));

    @Test
    @DisplayName("termino conta a partir da subida real, nao do horario marcado")
    void terminoUsaInicioReal() {
        ReservaElevador r = reserva(AGORA, new BigDecimal("2"));
        r.setInicioReal(AGORA.plusMinutes(30));

        // marcado 9h por 2h, mas so subiu 9h30 -> desce 11h30
        assertThat(r.terminoPrevisto()).isEqualTo(AGORA.plusHours(2).plusMinutes(30));
    }

    @Test
    @DisplayName("sem subida real, o termino sai do horario marcado")
    void terminoUsaPrevisto() {
        ReservaElevador r = reserva(AGORA, new BigDecimal("1.5"));

        assertThat(r.terminoPrevisto()).isEqualTo(AGORA.plusMinutes(90));
    }

    @Test
    @DisplayName("minutos restantes ficam negativos quando passa da hora")
    void restanteNegativoQuandoAtrasa() {
        ReservaElevador r = reserva(AGORA, BigDecimal.ONE);
        r.setInicioReal(AGORA);

        assertThat(r.minutosRestantes(AGORA.plusMinutes(20))).isEqualTo(40);
        assertThat(r.minutosRestantes(AGORA.plusMinutes(75))).isEqualTo(-15);
    }

    @Test
    @DisplayName("encostar nao e conflito: um desce 10h e o outro sobe 10h")
    void encostarNaoConflita() {
        ReservaElevador ocupada = reserva(AGORA, BigDecimal.ONE); // 9h -> 10h

        assertThat(ocupada.conflitaCom(AGORA.plusHours(1), BigDecimal.ONE)).isFalse();
        assertThat(ocupada.conflitaCom(AGORA.minusHours(1), BigDecimal.ONE)).isFalse();
    }

    @Test
    @DisplayName("sobreposicao parcial e conflito — um carro por elevador de cada vez")
    void sobreposicaoConflita() {
        ReservaElevador ocupada = reserva(AGORA, new BigDecimal("2")); // 9h -> 11h

        assertThat(ocupada.conflitaCom(AGORA.plusMinutes(30), BigDecimal.ONE)).isTrue();
        assertThat(ocupada.conflitaCom(AGORA.minusMinutes(30), BigDecimal.ONE)).isTrue();
        assertThat(ocupada.conflitaCom(AGORA.plusMinutes(90), new BigDecimal("3"))).isTrue();
    }

    @Test
    @DisplayName("horas no elevador contam da subida ate a descida")
    void horasNoElevador() {
        ReservaElevador r = reserva(AGORA, BigDecimal.ONE);
        r.setInicioReal(AGORA);
        r.setFimReal(AGORA.plusMinutes(135));

        assertThat(r.horasNoElevador(AGORA.plusHours(5))).isEqualByComparingTo("2.25");
    }

    @Test
    @DisplayName("carro que ainda esta em cima conta ate agora")
    void horasEmAberto() {
        ReservaElevador r = reserva(AGORA, BigDecimal.ONE);
        r.setInicioReal(AGORA);

        assertThat(r.horasNoElevador(AGORA.plusMinutes(90))).isEqualByComparingTo("1.50");
    }

    @Test
    @DisplayName("quem nunca subiu tem zero hora de elevador")
    void semSubidaNaoContaHora() {
        assertThat(reserva(AGORA, BigDecimal.ONE).horasNoElevador(AGORA.plusDays(1)))
                .isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("status vivo e so reservado e em uso")
    void statusVivo() {
        assertThat(StatusReserva.RESERVADO.viva()).isTrue();
        assertThat(StatusReserva.EM_USO.viva()).isTrue();
        assertThat(StatusReserva.CONCLUIDO.viva()).isFalse();
        assertThat(StatusReserva.CANCELADO.viva()).isFalse();
    }

    private ReservaElevador reserva(OffsetDateTime inicio, BigDecimal horas) {
        Box elevador = new Box();
        elevador.setNome("Elevador 1");
        elevador.setTipo(TipoBox.ELEVADOR);

        ReservaElevador r = new ReservaElevador();
        r.setBox(elevador);
        r.setOrdemServicoId(UUID.randomUUID());
        r.setInicioPrevisto(inicio);
        r.setHorasPrevistas(horas);
        return r;
    }
}
