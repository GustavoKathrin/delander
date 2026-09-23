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
        PERMITIDAS.put(RECEBIDO, EnumSet.of(EM_DIAGNOSTICO, AGUARDANDO_APROVACAO, AGENDADO, EM_EXECUCAO, CANCELADO));
        PERMITIDAS.put(EM_DIAGNOSTICO, EnumSet.of(AGUARDANDO_APROVACAO, AGENDADO, EM_EXECUCAO, CANCELADO));
        PERMITIDAS.put(AGUARDANDO_APROVACAO, EnumSet.of(AGENDADO, EM_EXECUCAO, RECEBIDO, CANCELADO));
        PERMITIDAS.put(AGENDADO, EnumSet.of(EM_EXECUCAO, PAUSADO, AGUARDANDO_APROVACAO, CANCELADO));
        PERMITIDAS.put(EM_EXECUCAO, EnumSet.of(PAUSADO, PRONTO_AGUARDANDO_RETIRADA, AGENDADO, CANCELADO));
        PERMITIDAS.put(PAUSADO, EnumSet.of(EM_EXECUCAO, AGENDADO, PRONTO_AGUARDANDO_RETIRADA, CANCELADO));
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

        if (para == EM_EXECUCAO) {
            if (!temItens) {
                throw new RegraNegocioException(
                        "Adicione ao menos um servico na OS antes de iniciar a execucao.");
            }
            if (exigirAprovacao && !aprovada) {
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
