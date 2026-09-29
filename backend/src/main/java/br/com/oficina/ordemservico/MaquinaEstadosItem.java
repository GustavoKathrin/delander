package br.com.oficina.ordemservico;

import br.com.oficina.common.RegraNegocioException;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

import static br.com.oficina.ordemservico.StatusItem.CANCELADO;
import static br.com.oficina.ordemservico.StatusItem.CONCLUIDO;
import static br.com.oficina.ordemservico.StatusItem.EM_EXECUCAO;
import static br.com.oficina.ordemservico.StatusItem.PAUSADO;
import static br.com.oficina.ordemservico.StatusItem.PENDENTE;

/**
 * Transicoes permitidas de um servico dentro da OS.
 *
 * Ate aqui o status do servico era consequencia do cronometro e de mais nada:
 * so mudava dentro de `ApontamentoService`, e concluir ou pausar exigia um
 * apontamento aberto. Na pratica isso obrigava o mecanico a sair da tela do
 * carro para dizer que acabou um servico de dois minutos.
 *
 * Com a mudanca direta pela tela da OS, as regras precisam morar em algum
 * lugar — e o lugar e aqui, do lado da maquina de estados da OS, com o mesmo
 * formato, para quem ler uma entender a outra.
 */
public final class MaquinaEstadosItem {

    private static final Map<StatusItem, Set<StatusItem>> PERMITIDAS = new EnumMap<>(StatusItem.class);

    static {
        // Pendente pode ir direto a concluido: e o servico de dois minutos,
        // que ninguem cronometra. As horas ficam zeradas, e a tela diz isso.
        PERMITIDAS.put(PENDENTE, EnumSet.of(EM_EXECUCAO, CONCLUIDO, CANCELADO));
        PERMITIDAS.put(EM_EXECUCAO, EnumSet.of(PAUSADO, CONCLUIDO, CANCELADO));
        PERMITIDAS.put(PAUSADO, EnumSet.of(EM_EXECUCAO, CONCLUIDO, CANCELADO));
        // Terminais. Reabrir servico concluido mexeria no `prontoEm` da OS e
        // na transicao de volta dela; fica de fora ate alguem precisar.
        PERMITIDAS.put(CONCLUIDO, EnumSet.noneOf(StatusItem.class));
        PERMITIDAS.put(CANCELADO, EnumSet.noneOf(StatusItem.class));
    }

    private MaquinaEstadosItem() {
    }

    public static Set<StatusItem> proximos(StatusItem atual) {
        return PERMITIDAS.getOrDefault(atual, EnumSet.noneOf(StatusItem.class));
    }

    public static boolean permite(StatusItem de, StatusItem para) {
        return proximos(de).contains(para);
    }

    /**
     * Recusa a transicao invalida com uma frase que diz o que aconteceu.
     *
     * O caso `de == para` tem mensagem propria porque nao e erro de fluxo, e
     * sim o mesmo botao apertado duas vezes — o que ficou bem mais provavel
     * agora que a acao mora na tela da OS, aberta ao mesmo tempo no celular do
     * mecanico e no computador do balcao. Sem esta guarda, o segundo clique
     * abriria uma segunda parada e um segundo evento.
     */
    public static void validar(StatusItem de, StatusItem para) {
        if (de == para) {
            throw new RegraNegocioException(
                    "Este serviço já está '%s'.".formatted(de.descricao()));
        }
        if (!permite(de, para)) {
            throw new RegraNegocioException(
                    "Não é possível ir de '%s' para '%s'.".formatted(de.descricao(), para.descricao()));
        }
    }
}
