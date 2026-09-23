package br.com.oficina.leitura;

/** A leitura boa do carro, ou uma leitura de quando ele estava com defeito. */
public enum TipoLeitura {

    /** Como o carro le quando esta bom. No maximo uma por veiculo. */
    OFICIAL("Oficial"),

    /** Como ele leu com algum problema; exige a condicao ("no frio", "quente"). */
    ANOMALIA("Anomalia");

    private final String descricao;

    TipoLeitura(String descricao) {
        this.descricao = descricao;
    }

    public String descricao() {
        return descricao;
    }
}
