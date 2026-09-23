package br.com.oficina.auth;

import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.usuario.Usuario;
import br.com.oficina.usuario.UsuarioRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UsuarioDetailsService usuarioDetailsService;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(UsuarioRepository usuarioRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       UsuarioDetailsService usuarioDetailsService,
                       AuthenticationManager authenticationManager,
                       JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.usuarioDetailsService = usuarioDetailsService;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthDtos.TokenResposta login(AuthDtos.LoginRequisicao req) {
        try {
            var auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.email().trim(), req.senha()));
            UsuarioAutenticado usuario = (UsuarioAutenticado) auth.getPrincipal();
            return emitirPar(usuario);
        } catch (BadCredentialsException e) {
            throw new BadCredentialsException("E-mail ou senha incorretos.");
        }
    }

    @Transactional
    public AuthDtos.TokenResposta renovar(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new RegraNegocioException("Refresh token ausente.");
        }
        RefreshToken registro = refreshTokenRepository.findByTokenHash(JwtService.hash(refreshToken))
                .orElseThrow(() -> new RegraNegocioException("Sessao expirada. Faca login novamente."));

        if (registro.isRevogado() || registro.getExpiraEm().isBefore(OffsetDateTime.now())) {
            throw new RegraNegocioException("Sessao expirada. Faca login novamente.");
        }

        // rotacao: o refresh usado e imediatamente invalidado
        registro.setRevogado(true);
        refreshTokenRepository.save(registro);

        Usuario usuario = usuarioRepository.findById(registro.getUsuarioId())
                .orElseThrow(() -> new RegraNegocioException("Usuario nao encontrado."));
        if (!usuario.isAtivo()) {
            throw new RegraNegocioException("Usuario inativo.");
        }
        return emitirPar(usuarioDetailsService.montar(usuario));
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(JwtService.hash(refreshToken))
                .ifPresent(t -> {
                    t.setRevogado(true);
                    refreshTokenRepository.save(t);
                });
    }

    private AuthDtos.TokenResposta emitirPar(UsuarioAutenticado usuario) {
        String access = jwtService.gerarAccessToken(usuario);
        String refresh = JwtService.gerarTokenOpaco();

        RefreshToken registro = new RefreshToken();
        registro.setUsuarioId(usuario.id());
        registro.setTokenHash(JwtService.hash(refresh));
        registro.setExpiraEm(OffsetDateTime.now().plusDays(jwtService.refreshTtlDias()));
        refreshTokenRepository.save(registro);

        return new AuthDtos.TokenResposta(
                access,
                refresh,
                jwtService.accessTtlSegundos(),
                AuthDtos.UsuarioResposta.de(usuario));
    }

    /** Limpeza diaria dos refresh tokens vencidos ou revogados. */
    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void limparTokens() {
        refreshTokenRepository.limpar(OffsetDateTime.now());
    }
}
