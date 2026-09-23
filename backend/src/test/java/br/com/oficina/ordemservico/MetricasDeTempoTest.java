package br.com.oficina.ordemservico;

import br.com.oficina.apontamento.Apontamento;
import br.com.oficina.cliente.Cliente;
import br.com.oficina.veiculo.Veiculo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * As duas metricas que sustentam o diagnostico do patio cheio:
 * permanencia (dias na oficina) e mao de obra (horas apontadas).
 */
class MetricasDeTempoTest {

    private static final OffsetDateTime AGORA =
            OffsetDateTime.of(2026, 9, 19, 17, 0, 0, 0, ZoneOffset.ofHours(-3));

    @Test
    @DisplayName("permanencia conta do check-in ate a entrega, nao ate agora")
    void permanenciaUsaEntrega() {
        OrdemServico os = os();
        os.setEntradaEm(AGORA.minusDays(9));
        os.setEntregueEm(AGORA.minusDays(2));

        assertThat(os.diasPermanencia(AGORA)).isEqualTo(7);
    }

    @Test
    @DisplayName("OS ainda aberta conta permanencia ate o momento atual")
    void permanenciaEmAberto() {
        OrdemServico os = os();
        os.setEntradaEm(AGORA.minusDays(4));

        assertThat(os.diasPermanencia(AGORA)).isEqualTo(4);
    }

    @Test
    @DisplayName("apontamento aberto conta o tempo corrido ate agora")
    void apontamentoAberto() {
        Apontamento apontamento = new Apontamento();
        apontamento.setInicio(AGORA.minusHours(2).minusMinutes(30));

        assertThat(apontamento.aberto()).isTrue();
        assertThat(apontamento.horas(AGORA)).isEqualByComparingTo(new BigDecimal("2.50"));
        assertThat(apontamento.minutos(AGORA)).isEqualTo(150);
    }

    @Test
    @DisplayName("apontamento fechado ignora o relogio atual")
    void apontamentoFechado() {
        Apontamento apontamento = new Apontamento();
        apontamento.setInicio(AGORA.minusHours(8));
        apontamento.setFim(AGORA.minusHours(5));

        assertThat(apontamento.aberto()).isFalse();
        assertThat(apontamento.horas(AGORA)).isEqualByComparingTo(new BigDecimal("3.00"));
    }

    @Test
    @DisplayName("carro pronto sem retirada acumula dias - a causa silenciosa do patio cheio")
    void diasAguardandoRetirada() {
        OrdemServico os = os();
        os.setStatus(StatusOs.PRONTO_AGUARDANDO_RETIRADA);
        os.setProntoEm(AGORA.minusDays(3));

        assertThat(os.diasAguardandoRetirada(AGORA)).isEqualTo(3);
    }

    @Test
    @DisplayName("OS em execucao nao conta dias de retirada")
    void semDiasDeRetiradaQuandoNaoEstaPronto() {
        OrdemServico os = os();
        os.setStatus(StatusOs.EM_EXECUCAO);
        os.setProntoEm(AGORA.minusDays(3));

        assertThat(os.diasAguardandoRetirada(AGORA)).isZero();
    }

    @Test
    @DisplayName("horas estimadas somam apenas os itens nao cancelados")
    void horasEstimadasIgnoramCancelados() {
        OrdemServico os = os();
        os.adicionarItem(item("Troca de oleo", "1.5", StatusItem.CONCLUIDO));
        os.adicionarItem(item("Correia dentada", "4.0", StatusItem.PENDENTE));
        os.adicionarItem(item("Servico desistido", "6.0", StatusItem.CANCELADO));

        assertThat(os.horasEstimadas()).isEqualByComparingTo(new BigDecimal("5.5"));
    }

    @Test
    @DisplayName("atraso so vale para carro que ainda esta no patio")
    void atrasoSoNoPatio() {
        OrdemServico os = os();
        os.setPrevisaoEntrega(LocalDate.of(2026, 9, 15));

        os.setStatus(StatusOs.EM_EXECUCAO);
        assertThat(os.atrasada(LocalDate.of(2026, 9, 19))).isTrue();

        os.setStatus(StatusOs.ENTREGUE);
        assertThat(os.atrasada(LocalDate.of(2026, 9, 19))).isFalse();
    }

    @Test
    @DisplayName("valor total nunca fica negativo com desconto maior que o servico")
    void valorTotalNaoNegativo() {
        OrdemServico os = os();
        os.setValorPecas(new BigDecimal("100"));
        os.setValorMaoObra(new BigDecimal("200"));
        os.setDesconto(new BigDecimal("500"));

        assertThat(os.valorTotal()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("placa e normalizada para comparar cadastro sem depender de formatacao")
    void normalizacaoDePlaca() {
        assertThat(Veiculo.normalizarPlaca("abc-1d23")).isEqualTo("ABC1D23");
        assertThat(Veiculo.normalizarPlaca(" abc 1234 ")).isEqualTo("ABC1234");
    }

    @Test
    @DisplayName("pagina publica mostra apenas o primeiro nome do cliente")
    void primeiroNomeDoCliente() {
        Cliente cliente = new Cliente();
        cliente.setNome("Maria Aparecida de Souza");
        assertThat(cliente.primeiroNome()).isEqualTo("Maria");
    }

    // ------------------------------------------------------------------ apoio

    private OrdemServico os() {
        Cliente cliente = new Cliente();
        cliente.setNome("Cliente Teste");

        Veiculo veiculo = new Veiculo();
        veiculo.setPlaca("TES1T23");
        veiculo.setCliente(cliente);

        OrdemServico os = new OrdemServico();
        os.setNumero(1000L);
        os.setCliente(cliente);
        os.setVeiculo(veiculo);
        os.setEntradaEm(AGORA.minusDays(1));
        return os;
    }

    private OsItem item(String descricao, String horas, StatusItem status) {
        OsItem item = new OsItem();
        item.setDescricao(descricao);
        item.setHorasEstimadas(new BigDecimal(horas));
        item.setStatus(status);
        return item;
    }
}
