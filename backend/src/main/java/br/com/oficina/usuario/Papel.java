package br.com.oficina.usuario;

/** Perfis de acesso. O que cada um pode fazer tambem depende das configuracoes do grupo FLUXO. */
public enum Papel {
    DONO,
    GERENTE,
    RECEPCAO,
    MECANICO;

    public boolean gerencia() {
        return this == DONO || this == GERENTE;
    }

    public String descricao() {
        return switch (this) {
            case DONO -> "Dono";
            case GERENTE -> "Gerente";
            case RECEPCAO -> "Recepcao";
            case MECANICO -> "Mecanico";
        };
    }
}
