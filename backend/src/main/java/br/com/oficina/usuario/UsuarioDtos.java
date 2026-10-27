package br.com.oficina.usuario;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public final class UsuarioDtos {

    private UsuarioDtos() {
    }

    /**
     * Quem entra no sistema mas nao pega servico.
     *
     * Dono, segundo dono e recepcao tem login e nao tem ficha de
     * funcionario -- de proposito, porque a jornada de quem tem ficha vira
     * capacidade de mao de obra da oficina, e somar o dono ali faria o
     * sistema prometer prazo que a bancada nao cobre.
     *
     * O efeito colateral e que eles nao apareciam em tela nenhuma, e a
     * troca de senha deles nao existia na interface: a unica forma era
     * variavel de ambiente no servidor. Com cinco contas nascendo com a
     * mesma senha padrao, isso nao e detalhe.
     */
    public record Resposta(UUID id,
                           String nome,
                           String email,
                           String login,
                           Papel papel,
                           String papelDescricao,
                           boolean ativo) {

        public static Resposta de(Usuario u) {
            return new Resposta(u.getId(), u.getNome(), u.getEmail(), u.getLogin(),
                    u.getPapel(), u.getPapel().descricao(), u.isAtivo());
        }
    }

    /** Senha vazia significa "nao mexer" — nunca "apagar". */
    public record Requisicao(@NotBlank(message = "Informe o nome") @Size(max = 160) String nome,
                             @Size(max = 40) String login,
                             @Size(max = 72) String senha,
                             Papel papel,
                             Boolean ativo) {
    }
}
