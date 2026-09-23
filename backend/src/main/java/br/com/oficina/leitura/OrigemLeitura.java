package br.com.oficina.leitura;

public enum OrigemLeitura {
    PDF("Importada do PDF"),
    MANUAL("Digitada"),
    EMAIL("Chegou por e-mail");

    private final String descricao;

    OrigemLeitura(String descricao) {
        this.descricao = descricao;
    }

    public String descricao() {
        return descricao;
    }
}
