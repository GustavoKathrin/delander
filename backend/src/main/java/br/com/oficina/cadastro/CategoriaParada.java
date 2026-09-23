package br.com.oficina.cadastro;

/** Categoria do motivo de parada: e o eixo do Pareto que mostra o gargalo real. */
public enum CategoriaParada {
    PECA,
    APROVACAO,
    TERCEIRO,
    CLIENTE,
    INTERNO,
    PAGAMENTO;

    public String descricao() {
        return switch (this) {
            case PECA -> "Peca";
            case APROVACAO -> "Aprovacao";
            case TERCEIRO -> "Terceiro";
            case CLIENTE -> "Cliente";
            case INTERNO -> "Interno";
            case PAGAMENTO -> "Pagamento";
        };
    }

    /** Parada por culpa da oficina? Serve para separar o que o dono controla do que nao controla. */
    public boolean responsabilidadeDaOficina() {
        return this == INTERNO;
    }
}
