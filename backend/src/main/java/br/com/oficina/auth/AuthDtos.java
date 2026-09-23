package br.com.oficina.auth;

import br.com.oficina.usuario.Papel;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequisicao(
            @NotBlank(message = "Informe o e-mail") @Email(message = "E-mail invalido") String email,
            @NotBlank(message = "Informe a senha") String senha) {
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
