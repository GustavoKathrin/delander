package br.com.oficina.ordemservico;

import br.com.oficina.common.RegraNegocioException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * As regras do servico dentro da OS.
 *
 * Elas passaram a existir porque o dono pediu botoes de concluir, pausar e
 * cancelar na linha do servico. Antes disso o status era consequencia do
 * cronometro, e nao havia o que validar — nao dava para chegar num estado
 * invalido porque so havia um caminho.
 */
class MaquinaEstadosItemTest {

    @Test
    @DisplayName("servico de dois minutos vai direto de pendente a concluido")
    void pendentePodeConcluirSemPassarPorExecucao() {
        // O caso que motivou o botao: "apertei o parafuso, acabou". Obrigar a
        // passar pelo cronometro faria o mecanico iniciar e concluir na mesma
        // batida so para satisfazer o sistema.
        assertThat(MaquinaEstadosItem.permite(StatusItem.PENDENTE, StatusItem.CONCLUIDO)).isTrue();
    }

    @Test
    @DisplayName("servico trava antes de comecar: pendente pode ir a pausado")
    void pendentePodePausar() {
        // "Nem adianta abrir, a peca nao chegou" e o caso mais comum. Sem esta
        // transicao, registrar o motivo exigiria iniciar o cronometro de um
        // servico que ninguem vai tocar — e a espera viraria mao de obra.
        assertThat(MaquinaEstadosItem.permite(StatusItem.PENDENTE, StatusItem.PAUSADO)).isTrue();
    }

    @Test
    @DisplayName("servico pausado pode ser retomado, concluido ou cancelado")
    void pausadoTemTresSaidas() {
        assertThat(MaquinaEstadosItem.proximos(StatusItem.PAUSADO))
                .containsExactlyInAnyOrder(StatusItem.EM_EXECUCAO, StatusItem.CONCLUIDO, StatusItem.CANCELADO);
    }

    @Test
    @DisplayName("concluido e cancelado sao fim de linha")
    void terminaisNaoVoltam() {
        assertThat(MaquinaEstadosItem.proximos(StatusItem.CONCLUIDO)).isEmpty();
        assertThat(MaquinaEstadosItem.proximos(StatusItem.CANCELADO)).isEmpty();
    }

    @Test
    @DisplayName("apertar o mesmo botao duas vezes nao abre duas paradas")
    void mesmoStatusRecusadoComFrasePropria() {
        // Ficou provavel agora que a acao mora na tela da OS: o celular do
        // mecanico e o computador do balcao abrem o mesmo servico.
        assertThatThrownBy(() -> MaquinaEstadosItem.validar(StatusItem.PAUSADO, StatusItem.PAUSADO))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("já está");
    }

    @Test
    @DisplayName("nao se volta de concluido para execucao")
    void naoReabreServicoConcluido() {
        assertThatThrownBy(() -> MaquinaEstadosItem.validar(StatusItem.CONCLUIDO, StatusItem.EM_EXECUCAO))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("Não é possível ir de");
    }

    @Test
    @DisplayName("servico cancelado nao ressuscita")
    void canceladoNaoVolta() {
        assertThatThrownBy(() -> MaquinaEstadosItem.validar(StatusItem.CANCELADO, StatusItem.PENDENTE))
                .isInstanceOf(RegraNegocioException.class);
    }
}
