package br.com.oficina.peca;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A fila de compras: o que e risco e em que ordem comprar.
 *
 * Nao e detalhe de apresentacao: quem abre a tela compra de cima para baixo,
 * entao a ordem decide o que a oficina faz primeiro. Por isso ela tem teste
 * proprio e nao depende de banco.
 *
 * A regra que estes testes guardam: a fila fala do carro que espera, nao da
 * peca. O prazo vem da agenda do carro; sem agenda, o carro esta parado e
 * ninguem sabe quando ele anda — esse e o pior caso, vai para o topo.
 */
class FilaDeComprasTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 9, 25);

    @Test
    @DisplayName("carro parado sem dia marcado vem antes de qualquer prazo, ate do de hoje")
    void semPrazoVemPrimeiro() {
        var parado = pendente("Bomba d'agua", null, MomentoDaPeca.DURANTE);
        var hoje = pendente("Correia", HOJE, MomentoDaPeca.INICIO);

        assertThat(fila(hoje, parado))
                .extracting(PecaDtos.Pendente::descricao)
                .containsExactly("Bomba d'agua", "Correia");
    }

    @Test
    @DisplayName("entre carros com dia marcado, o prazo mais apertado primeiro")
    void prazoMaisApertadoPrimeiro() {
        var semana = pendente("Filtro", HOJE.plusDays(7), MomentoDaPeca.DURANTE);
        var amanha = pendente("Pastilha", HOJE.plusDays(1), MomentoDaPeca.DURANTE);
        var atrasada = pendente("Embreagem", HOJE.minusDays(2), MomentoDaPeca.DURANTE);

        assertThat(fila(semana, amanha, atrasada))
                .extracting(PecaDtos.Pendente::descricao)
                .containsExactly("Embreagem", "Pastilha", "Filtro");
    }

    @Test
    @DisplayName("empatou no dia: ganha quem trava o comeco do servico")
    void empateDesempataPorQuemTrava() {
        var depois = pendente("Filtro de ar", HOJE.plusDays(2), MomentoDaPeca.DURANTE);
        var trava = pendente("Kit de embreagem", HOJE.plusDays(2), MomentoDaPeca.INICIO);

        assertThat(fila(depois, trava))
                .extracting(PecaDtos.Pendente::descricao)
                .containsExactly("Kit de embreagem", "Filtro de ar");
    }

    @Test
    @DisplayName("empatou em tudo: ordem alfabetica, para a lista nao dancar a cada carga")
    void empateTotalFicaEstavel() {
        // Sem este criterio a ordem vinha do banco e mudava sozinha entre um
        // F5 e outro. Lista que se mexe sozinha e lista em que ninguem confia.
        var b = pendente("Velas", HOJE.plusDays(3), MomentoDaPeca.INICIO);
        var a = pendente("Bateria", HOJE.plusDays(3), MomentoDaPeca.INICIO);

        assertThat(fila(b, a))
                .extracting(PecaDtos.Pendente::descricao)
                .containsExactly("Bateria", "Velas");
    }

    @Test
    @DisplayName("a fila inteira, na ordem em que a oficina compra")
    void ordemCompleta() {
        var lista = fila(
                pendente("Filtro", HOJE.plusDays(7), MomentoDaPeca.DURANTE),
                pendente("Kit de embreagem", HOJE.plusDays(1), MomentoDaPeca.INICIO),
                pendente("Bomba d'agua", null, MomentoDaPeca.DURANTE),
                pendente("Amortecedor", HOJE.plusDays(1), MomentoDaPeca.DURANTE));

        assertThat(lista)
                .extracting(PecaDtos.Pendente::descricao)
                .containsExactly("Bomba d'agua", "Kit de embreagem", "Amortecedor", "Filtro");
    }

    @Test
    @DisplayName("prazo vencido e risco de hoje, e nao so promessa furada do fornecedor")
    void prazoVencidoEntraEmRisco() {
        // O caso que a tela pegou rodando: a linha ficava vermelha com
        // "2 dias atrasado" e o aviso do topo dizia que nada estava em risco.
        // O fornecedor tinha prometido dentro do prazo — e nao entregou.
        assertThat(PecaService.emRisco(HOJE.minusDays(2), HOJE.minusDays(3), HOJE)).isTrue();
    }

    @Test
    @DisplayName("fornecedor prometido para depois do que precisamos e risco")
    void promessaDepoisDoPrazoEntraEmRisco() {
        assertThat(PecaService.emRisco(HOJE.plusDays(3), HOJE.plusDays(5), HOJE)).isTrue();
    }

    @Test
    @DisplayName("sem prazo e risco: o carro esta parado sem dia marcado")
    void semPrazoEntraEmRisco() {
        assertThat(PecaService.emRisco(null, HOJE.plusDays(1), HOJE)).isTrue();
        assertThat(PecaService.emRisco(null, null, HOJE)).isTrue();
    }

    @Test
    @DisplayName("prazo que chega hoje ainda nao venceu")
    void prazoDeHojeNaoEstaVencido() {
        assertThat(PecaService.emRisco(HOJE, null, HOJE)).isFalse();
        assertThat(PecaService.emRisco(HOJE, HOJE, HOJE)).isFalse();
    }

    @Test
    @DisplayName("sem promessa do fornecedor, so o prazo do carro decide")
    void semPromessaDoFornecedor() {
        assertThat(PecaService.emRisco(HOJE.plusDays(5), null, HOJE)).isFalse();
        assertThat(PecaService.emRisco(HOJE.minusDays(1), null, HOJE)).isTrue();
    }

    private static List<PecaDtos.Pendente> fila(PecaDtos.Pendente... pecas) {
        List<PecaDtos.Pendente> lista = new ArrayList<>(List.of(pecas));
        lista.sort(PecaService::maisUrgentePrimeiro);
        return lista;
    }

    private static PecaDtos.Pendente pendente(String descricao, LocalDate comprarAte, MomentoDaPeca momento) {
        return new PecaDtos.Pendente(
                UUID.randomUUID(), UUID.randomUUID(), 1L, "ABC1D23", "Cliente",
                descricao, BigDecimal.ONE, null,
                StatusPeca.SOLICITADA, StatusPeca.SOLICITADA.descricao(),
                momento, momento.descricao(),
                new BigDecimal("100.00"), null,
                comprarAte, comprarAte == null, null, comprarAte == null);
    }
}
