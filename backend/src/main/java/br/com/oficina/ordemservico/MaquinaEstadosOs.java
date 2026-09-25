package br.com.oficina.ordemservico;

import br.com.oficina.common.RegraNegocioException;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static br.com.oficina.ordemservico.StatusOs.AGENDADO;
import static br.com.oficina.ordemservico.StatusOs.AGUARDANDO_APROVACAO;
import static br.com.oficina.ordemservico.StatusOs.CANCELADO;
import static br.com.oficina.ordemservico.StatusOs.EM_DIAGNOSTICO;
import static br.com.oficina.ordemservico.StatusOs.EM_EXECUCAO;
import static br.com.oficina.ordemservico.StatusOs.ENTREGUE;
import static br.com.oficina.ordemservico.StatusOs.ORCAMENTO_APROVADO;
import static br.com.oficina.ordemservico.StatusOs.PAUSADO;
import static br.com.oficina.ordemservico.StatusOs.PRONTO_AGUARDANDO_RETIRADA;
import static br.com.oficina.ordemservico.StatusOs.RECEBIDO;

/**
 * Transicoes permitidas da OS. Toda mudanca de status passa por aqui;
 * transicao invalida devolve 409 com mensagem em portugues.
 */
public final class MaquinaEstadosOs {

    private static final Map<StatusOs, Set<StatusOs>> PERMITIDAS = new EnumMap<>(StatusOs.class);

    static {
        // O caminho e um so: agenda -> diagnostico -> orcamento -> resposta do
        // cliente -> execucao. Antes daqui, RECEBIDO ia direto para EM_EXECUCAO
        // e o fluxo virava decoracao: dava para comecar a mexer no carro sem
        // ninguem ter olhado o que ele precisa nem o cliente ter autorizado o
        // gasto. Quem precisa furar a fila cancela e abre outra OS.
        PERMITIDAS.put(RECEBIDO, EnumSet.of(EM_DIAGNOSTICO, AGENDADO, CANCELADO));
        PERMITIDAS.put(AGENDADO, EnumSet.of(EM_DIAGNOSTICO, CANCELADO));
        PERMITIDAS.put(EM_DIAGNOSTICO, EnumSet.of(AGUARDANDO_APROVACAO, AGENDADO, CANCELADO));
        // Reprovado volta para o diagnostico: o orcamento caro quase sempre
        // vira "tira isso, faz so o essencial", e nao o fim do servico.
        PERMITIDAS.put(AGUARDANDO_APROVACAO, EnumSet.of(ORCAMENTO_APROVADO, EM_DIAGNOSTICO, CANCELADO));
        PERMITIDAS.put(ORCAMENTO_APROVADO, EnumSet.of(EM_EXECUCAO, EM_DIAGNOSTICO, CANCELADO));
        PERMITIDAS.put(EM_EXECUCAO, EnumSet.of(PAUSADO, PRONTO_AGUARDANDO_RETIRADA, ORCAMENTO_APROVADO, CANCELADO));
        PERMITIDAS.put(PAUSADO, EnumSet.of(EM_EXECUCAO, ORCAMENTO_APROVADO, PRONTO_AGUARDANDO_RETIRADA, CANCELADO));
        PERMITIDAS.put(PRONTO_AGUARDANDO_RETIRADA, EnumSet.of(ENTREGUE, EM_EXECUCAO, CANCELADO));
        PERMITIDAS.put(ENTREGUE, EnumSet.noneOf(StatusOs.class));
        PERMITIDAS.put(CANCELADO, EnumSet.noneOf(StatusOs.class));
    }

    private MaquinaEstadosOs() {
    }

    public static Set<StatusOs> proximos(StatusOs atual) {
        return PERMITIDAS.getOrDefault(atual, EnumSet.noneOf(StatusOs.class));
    }

    public static boolean permite(StatusOs de, StatusOs para) {
        return proximos(de).contains(para);
    }

    /**
     * Valida a transicao considerando as regras configuraveis da oficina.
     *
     * @param exigirAprovacao   configuracao fluxo.exigir_aprovacao_orcamento
     * @param aprovada          a OS ja teve o orcamento aprovado
     * @param temItens          a OS tem ao menos um item de servico
     * @param temItemEmAberto   existe item ainda nao concluido
     */
    public static void validar(StatusOs de,
                               StatusOs para,
                               boolean exigirAprovacao,
                               boolean aprovada,
                               boolean temItens,
                               boolean temItemEmAberto) {

        if (de == para) {
            throw new RegraNegocioException("A OS ja esta em '%s'.".formatted(para.descricao()));
        }

        if (!permite(de, para)) {
            if (de.finalizada()) {
                throw new RegraNegocioException(
                        "Esta OS esta '%s' e nao pode mais mudar de status.".formatted(de.descricao()));
            }
            throw new RegraNegocioException("Nao e possivel ir de '%s' para '%s'."
                    .formatted(de.descricao(), para.descricao()));
        }

        // O diagnostico e onde o mecanico diz o que o carro precisa. Mandar
        // para o cliente um orcamento sem nenhum item e mandar um papel em
        // branco — o "nao" volta na hora e a oficina perde a viagem.
        if (para == AGUARDANDO_APROVACAO && !temItens) {
            throw new RegraNegocioException(
                    "O diagnostico ainda nao tem nenhum servico. Adicione o que precisa ser feito "
                            + "antes de mandar o orcamento para o cliente.");
        }

        if (para == EM_EXECUCAO) {
            if (!temItens) {
                throw new RegraNegocioException(
                        "Adicione ao menos um servico na OS antes de iniciar a execucao.");
            }
            // A aprovacao agora e um estado, nao um campo solto: so da para
            // chegar em EM_EXECUCAO vindo de ORCAMENTO_APROVADO ou de uma
            // pausa. A checagem fica como rede para quem desligar a exigencia
            // em Configuracoes e depois liga-la de novo com OS no meio.
            if (exigirAprovacao && !aprovada && de != PAUSADO) {
                throw new RegraNegocioException(
                        "O orcamento precisa ser aprovado antes de iniciar a execucao. "
                                + "Se a sua oficina nao trabalha com aprovacao, desligue essa exigencia em Configuracoes.");
            }
        }

        if (para == PRONTO_AGUARDANDO_RETIRADA && temItemEmAberto) {
            throw new RegraNegocioException(
                    "Ainda existem servicos nao concluidos nesta OS. Conclua ou cancele os itens pendentes.");
        }
    }
}
