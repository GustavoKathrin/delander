package br.com.oficina.auth;

import br.com.oficina.usuario.Papel;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {
    }

    /**
     * Aceita apelido ("tonny") ou e-mail no mesmo campo.
     *
     * O @Email saiu daqui de proposito: com ele, "tonny" era recusado na
     * validacao antes de o banco ser consultado, e a mensagem de erro falava
     * de e-mail invalido para quem nunca quis digitar um e-mail.
     *
     * Os dois nomes de campo sao aceitos porque o app publicado manda "email"
     * e o novo manda "identificador" -- durante o deploy as duas versoes
     * convivem por alguns minutos, e quem estiver com a tela velha aberta nao
     * pode levar erro de login por causa disso.
     */
    public record LoginRequisicao(
            String email,
            String identificador,
            @NotBlank(message = "Informe a senha") String senha) {

        public String quemEntra() {
            String valor = identificador != null && !identificador.isBlank() ? identificador : email;
            return valor == null ? "" : valor.trim();
        }

        @AssertTrue(message = "Informe o usuario ou o e-mail")
        public boolean isIdentificacaoPreenchida() {
            return !quemEntra().isEmpty();
        }
    }

    public record RefreshRequisicao(String refreshToken) {
    }

    public record TokenResposta(String accessToken,
                                String refreshToken,
                                long expiraEmSegundos,
                                UsuarioResposta usuario) {
    }

    public record UsuarioResposta(UUID id,
                                  String nome,
                                  String email,
                                  Papel papel,
                                  String papelDescricao,
                                  UUID funcionarioId,
                                  boolean gerencia) {

        public static UsuarioResposta de(UsuarioAutenticado u) {
            return new UsuarioResposta(u.id(), u.nome(), u.email(), u.papel(),
                    u.papel().descricao(), u.funcionarioId(), u.papel().gerencia());
        }
    }
}
