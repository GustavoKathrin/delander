package br.com.oficina.ordemservico;

import br.com.oficina.common.RegraNegocioException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MaquinaEstadosOsTest {

    @Test
    @DisplayName("caminho normal da oficina: recebido -> orcamento -> agendado -> execucao -> pronto -> entregue")
    void caminhoNormal() {
        assertThat(MaquinaEstadosOs.permite(StatusOs.RECEBIDO, StatusOs.AGUARDANDO_APROVACAO)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.AGUARDANDO_APROVACAO, StatusOs.AGENDADO)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.AGENDADO, StatusOs.EM_EXECUCAO)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.EM_EXECUCAO, StatusOs.PRONTO_AGUARDANDO_RETIRADA)).isTrue();
        assertThat(MaquinaEstadosOs.permite(StatusOs.PRONTO_AGUARDANDO_RETIRADA, StatusOs.ENTREGUE)).isTrue();
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
    @DisplayName("com aprovacao exigida, execucao so comeca depois do orcamento aprovado")
    void exigeAprovacao() {
        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.AGENDADO, StatusOs.EM_EXECUCAO, true, false, true, true))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("orcamento precisa ser aprovado");

        assertThatCode(() -> MaquinaEstadosOs.validar(
                StatusOs.AGENDADO, StatusOs.EM_EXECUCAO, true, true, true, true))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("oficina sem aprovacao formal inicia a execucao direto")
    void semAprovacaoIniciaDireto() {
        assertThatCode(() -> MaquinaEstadosOs.validar(
                StatusOs.AGENDADO, StatusOs.EM_EXECUCAO, false, false, true, true))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("nao inicia execucao de OS sem nenhum servico")
    void exigeItens() {
        assertThatThrownBy(() -> MaquinaEstadosOs.validar(
                StatusOs.AGENDADO, StatusOs.EM_EXECUCAO, false, false, false, false))
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
        assertThat(StatusOs.PRONTO_AGUARDANDO_RETIRADA.noPatio()).isTrue();
        assertThat(StatusOs.PAUSADO.noPatio()).isTrue();
    }
}
