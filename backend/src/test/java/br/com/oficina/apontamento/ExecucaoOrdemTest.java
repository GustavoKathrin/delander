package br.com.oficina.apontamento;

import br.com.oficina.ordemservico.Prioridade;
import br.com.oficina.ordemservico.StatusOs;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A ordem do painel da Etapa 6 e regra de negocio, nao detalhe de tela.
 *
 * O dono le este painel de cima para baixo e decide pelo que esta em cima.
 * Se a ordem voltar a ser a do numero da OS -- que e o que acontece se
 * alguem tirar o sort achando que o banco ja devolve ordenado --, o carro
 * parado desde terca vai para o fim da lista e ninguem vai ver.
 */
class ExecucaoOrdemTest {

    @Test
    @DisplayName("carro parado vem antes de carro com mecanico trabalhando")
    void paradoPrimeiro() {
        ExecucaoDtos.Carro trabalhando = carro(1, StatusOs.EM_EXECUCAO, LocalDate.of(2026, 1, 10));
        ExecucaoDtos.Carro parado = carro(2, StatusOs.PAUSADO, LocalDate.of(2026, 1, 20));

        assertThat(ordenar(trabalhando, parado))
                .extracting(ExecucaoDtos.Carro::numero)
                .containsExactly(2L, 1L);
    }

    @Test
    @DisplayName("dentro do mesmo grupo, a entrega mais proxima vem primeiro")
    void entregaMaisProximaPrimeiro() {
        ExecucaoDtos.Carro sexta = carro(10, StatusOs.EM_EXECUCAO, LocalDate.of(2026, 1, 16));
        ExecucaoDtos.Carro hoje = carro(11, StatusOs.EM_EXECUCAO, LocalDate.of(2026, 1, 12));

        assertThat(ordenar(sexta, hoje))
                .extracting(ExecucaoDtos.Carro::numero)
                .containsExactly(11L, 10L);
    }

    @Test
    @DisplayName("carro sem data de entrega vai para o fim do grupo, nao para o comeco")
    void semDataVaiParaOFim() {
        ExecucaoDtos.Carro semData = carro(20, StatusOs.EM_EXECUCAO, null);
        ExecucaoDtos.Carro comData = carro(21, StatusOs.EM_EXECUCAO, LocalDate.of(2026, 3, 1));

        assertThat(ordenar(semData, comData))
                .extracting(ExecucaoDtos.Carro::numero)
                .containsExactly(21L, 20L);
    }

    @Test
    @DisplayName("empate em tudo cai no numero da OS, para a ordem nao dancar entre recargas")
    void empateCaiNoNumero() {
        LocalDate mesmoDia = LocalDate.of(2026, 2, 2);
        ExecucaoDtos.Carro maior = carro(99, StatusOs.PAUSADO, mesmoDia);
        ExecucaoDtos.Carro menor = carro(98, StatusOs.PAUSADO, mesmoDia);

        assertThat(ordenar(maior, menor))
                .extracting(ExecucaoDtos.Carro::numero)
                .containsExactly(98L, 99L);
    }

    private static List<ExecucaoDtos.Carro> ordenar(ExecucaoDtos.Carro... carros) {
        List<ExecucaoDtos.Carro> lista = new ArrayList<>(List.of(carros));
        lista.sort(ExecucaoService.POR_URGENCIA);
        return lista;
    }

    private static ExecucaoDtos.Carro carro(long numero, StatusOs status, LocalDate previsao) {
        return new ExecucaoDtos.Carro(
                UUID.randomUUID(),
                numero,
                "ABC%dD%d".formatted(numero, numero),
                "Gol 1.0",
                "prata",
                "Cliente " + numero,
                null,
                Prioridade.NORMAL,
                status,
                false,
                previsao,
                null,
                1,
                0,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                List.of(),
                List.of());
    }
}
