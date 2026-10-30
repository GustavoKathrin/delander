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

    // ------------------------------------------- o estado do CARRO tambem conta

    @Test
    @DisplayName("servico pendente em carro no diagnostico nao oferece 'Iniciar'")
    void naoIniciaComCarroEmDiagnostico() {
        assertThat(MaquinaEstadosItem.proximos(StatusItem.PENDENTE, StatusOs.EM_DIAGNOSTICO))
                .doesNotContain(StatusItem.EM_EXECUCAO)
                .contains(StatusItem.PAUSADO, StatusItem.CONCLUIDO, StatusItem.CANCELADO);
    }

    @Test
    @DisplayName("carro esperando o cliente responder tambem nao oferece 'Iniciar'")
    void naoIniciaEsperandoAprovacao() {
        assertThat(MaquinaEstadosItem.proximos(StatusItem.PENDENTE, StatusOs.AGUARDANDO_APROVACAO))
                .doesNotContain(StatusItem.EM_EXECUCAO);
    }

    @Test
    @DisplayName("orcamento aprovado libera o inicio: e dali que a execucao comeca")
    void iniciaDepoisDoSim() {
        assertThat(MaquinaEstadosItem.proximos(StatusItem.PENDENTE, StatusOs.ORCAMENTO_APROVADO))
                .contains(StatusItem.EM_EXECUCAO);
    }

    @Test
    @DisplayName("servico pausado volta a rodar com o carro em execucao ou pausado")
    void retomaNaBancada() {
        assertThat(MaquinaEstadosItem.proximos(StatusItem.PAUSADO, StatusOs.EM_EXECUCAO))
                .contains(StatusItem.EM_EXECUCAO);
        assertThat(MaquinaEstadosItem.proximos(StatusItem.PAUSADO, StatusOs.PAUSADO))
                .contains(StatusItem.EM_EXECUCAO);
    }

    @Test
    @DisplayName("cancelar continua valendo em qualquer ponto do carro")
    void cancelaSempre() {
        for (StatusOs doCarro : StatusOs.values()) {
            assertThat(MaquinaEstadosItem.proximos(StatusItem.PENDENTE, doCarro))
                    .as("cancelar com o carro em %s", doCarro)
                    .contains(StatusItem.CANCELADO);
        }
    }
}
