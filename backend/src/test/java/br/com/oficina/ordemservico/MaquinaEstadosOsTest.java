package br.com.oficina.ordemservico;

import br.com.oficina.common.RegraNegocioException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MaquinaEstadosOsTest {

    @Test
    @DisplayName("caminho da oficina: agendado -> diagnostico -> orcamento -> aprovado -> execucao -> pronto -> entregue")
    void caminhoNormal() {
        assertThat(MaquinaEstadosOs.permite(StatusOs.RECEBIDO, StatusOs.AGENDADO)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.AGENDADO, StatusOs.EM_DIAGNOSTICO)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.EM_DIAGNOSTICO, StatusOs.AGUARDANDO_APROVACAO)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.AGUARDANDO_APROVACAO, StatusOs.ORCAMENTO_APROVADO)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.ORCAMENTO_APROVADO, StatusOs.EM_EXECUCAO)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.EM_EXECUCAO, StatusOs.PRONTO_AGUARDANDO_RETIRADA)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.PRONTO_AGUARDANDO_RETIRADA, StatusOs.ENTREGUE)).isTrue();
    }

    @Test
    @DisplayName("o atalho que existia antes esta fechado: agendado nao vai direto para execucao")
    void semAtalhoParaExecucao() {
        // Era isto que deixava o fluxo virar decoracao: dava para mexer no
        // carro sem diagnostico e sem o cliente ter autorizado o gasto.
        assertThat(MaquinaEstadosOs.permite(StatusOs.AGENDADO, StatusOs.EM_EXECUCAO)).isFalse();
        assertThat(MaquinaEstadosOs.permite(StatusOs.RECEBIDO, StatusOs.EM_EXECUCAO)).isFalse();
        assertThat(MaquinaEstadosOs.permite(StatusOs.EM_DIAGNOSTICO, StatusOs.EM_EXECUCAO)).isFalse();

        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.AGENDADO, StatusOs.EM_EXECUCAO, true, false, true, true))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("Nao e possivel ir de");
    }

    @Test
    @DisplayName("orcamento reprovado volta para o diagnostico, nao morre")
    void reprovadoVoltaParaDiagnostico() {
        // "Ficou caro" quase sempre vira "tira isso, faz so o essencial".
        assertThat(MaquinaEstadosOs.permite(StatusOs.AGUARDANDO_APROVACAO, StatusOs.EM_DIAGNOSTICO)).isTrue();
    }

    @Test
    @DisplayName("nao manda orcamento sem nenhum servico no diagnostico")
    void orcamentoPrecisaDeItens() {
        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.EM_DIAGNOSTICO, StatusOs.AGUARDANDO_APROVACAO, true, false, false, false))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("nao tem nenhum servico");

        assertThatCode(() -> MaquinaEstadosOs.validar(
                StatusOs.EM_DIAGNOSTICO, StatusOs.AGUARDANDO_APROVACAO, true, false, true, true))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("OS entregue ou cancelada nao muda mais de status")
    void osFinalizadaNaoMuda() {
        assertThat(MaquinaEstadosOs.proximos(StatusOs.ENTREGUE)).isEmpty();
        assertThat(MaquinaEstadosOs.proximos(StatusOs.CANCELADO)).isEmpty();

        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.ENTREGUE, StatusOs.EM_EXECUCAO, false, true, true, false))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("nao pode mais mudar de status");
    }

    @Test
    @DisplayName("nao da para pular do recebido direto para entregue")
    void transicaoInvalida() {
        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.RECEBIDO, StatusOs.ENTREGUE, false, false, true, false))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("Nao e possivel ir de");
    }

    @Test
    @DisplayName("execucao so comeca a partir do orcamento aprovado")
    void execucaoComecaDoAprovado() {
        assertThatCode(() -> MaquinaEstadosOs.validar(
                StatusOs.ORCAMENTO_APROVADO, StatusOs.EM_EXECUCAO, true, true, true, true))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("retomar de uma pausa nao pede aprovacao de novo")
    void retomarPausaNaoPedeAprovacao() {
        // O cliente ja autorizou uma vez; pedir de novo a cada pausa para
        // almoco seria burocracia que ninguem cumpre.
        assertThatCode(() -> MaquinaEstadosOs.validar(
                StatusOs.PAUSADO, StatusOs.EM_EXECUCAO, true, false, true, true))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("nao inicia execucao de OS sem nenhum servico")
    void exigeItens() {
        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.ORCAMENTO_APROVADO, StatusOs.EM_EXECUCAO, false, false, false, false))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("ao menos um servico");
    }

    @Test
    @DisplayName("nao marca como pronto com servico em aberto")
    void exigeItensConcluidos() {
        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.EM_EXECUCAO, StatusOs.PRONTO_AGUARDANDO_RETIRADA, false, true, true, true))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("servicos nao concluidos");

        assertThatCode(() -> MaquinaEstadosOs.validar(
                StatusOs.EM_EXECUCAO, StatusOs.PRONTO_AGUARDANDO_RETIRADA, false, true, true, false))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("mudar para o mesmo status devolve erro claro")
    void mesmoStatus() {
        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.AGENDADO, StatusOs.AGENDADO, false, true, true, true))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("ja esta em");
    }

    @Test
    @DisplayName("apenas entregue e cancelado saem do patio")
    void ocupacaoDoPatio() {
        assertThat(StatusOs.ENTREGUE.noPatio()).isFalse();
        assertThat(StatusOs.CANCELADO.noPatio()).isFalse();
        assertThat(StatusOs.ORCAMENTO_APROVADO.noPatio()).isTrue();
        assertThat(StatusOs.PRONTO_AGUARDANDO_RETIRADA.noPatio()).isTrue();
        assertThat(StatusOs.PAUSADO.noPatio()).isTrue();
    }
}
