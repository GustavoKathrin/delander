package br.com.oficina.leitura;

/**
 * PENDENTE existe para a entrada automatica por e-mail: motor ligado/desligado
 * e OFICIAL/ANOMALIA nao estao no PDF, e inventar esses campos envenenaria
 * justamente o dado que a ferramenta existe para guardar.
 */
public enum SituacaoLeitura {
    PENDENTE("Falta completar"),
    COMPLETA("Completa");

    private final String descricao;

    SituacaoLeitura(String descricao) {
        this.descricao = descricao;
    }

    public String descricao() {
        return descricao;
    }
}
