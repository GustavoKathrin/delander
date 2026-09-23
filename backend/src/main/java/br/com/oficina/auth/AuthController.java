package br.com.oficina.auth;

import br.com.oficina.common.Contexto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticacao")
public class AuthController {

    private final AuthService authService;
    private final Contexto contexto;

    public AuthController(AuthService authService, Contexto contexto) {
        this.authService = authService;
        this.contexto = contexto;
    }

    @PostMapping("/login")
    @Operation(summary = "Entrar com e-mail e senha")
    public AuthDtos.TokenResposta login(@Valid @RequestBody AuthDtos.LoginRequisicao req) {
        return authService.login(req);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Renovar o access token (o refresh usado e invalidado)")
    public AuthDtos.TokenResposta refresh(@RequestBody AuthDtos.RefreshRequisicao req) {
        return authService.renovar(req.refreshToken());
    }

    @PostMapping("/logout")
    @Operation(summary = "Encerrar a sessao")
    public ResponseEntity<Void> logout(@RequestBody AuthDtos.RefreshRequisicao req) {
        authService.logout(req.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    @Operation(summary = "Dados do usuario logado")
    public AuthDtos.UsuarioResposta eu() {
        return AuthDtos.UsuarioResposta.de(contexto.usuario());
    }
}
