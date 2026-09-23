package br.com.oficina.auth;

import br.com.oficina.config.AppProperties;
import br.com.oficina.usuario.Papel;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretKey chave;
    private final long accessTtlMinutos;
    private final long refreshTtlDias;

    public JwtService(AppProperties props) {
        byte[] segredo = props.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (segredo.length < 32) {
            throw new IllegalStateException(
                    "APP_JWT_SECRET precisa ter no minimo 32 caracteres (recomendado 64).");
        }
        this.chave = Keys.hmacShaKeyFor(segredo);
        this.accessTtlMinutos = props.jwt().accessTtlMinutos();
        this.refreshTtlDias = props.jwt().refreshTtlDias();
    }

    public String gerarAccessToken(UsuarioAutenticado usuario) {
        Instant agora = Instant.now();
        return Jwts.builder()
                .subject(usuario.id().toString())
                .claims(Map.of(
                        "nome", usuario.nome(),
                        "email", usuario.email(),
                        "papel", usuario.papel().name(),
                        "oficinaId", usuario.oficinaId().toString(),
                        "funcionarioId", usuario.funcionarioId() == null
                                ? "" : usuario.funcionarioId().toString()))
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plusSeconds(accessTtlMinutos * 60)))
                .signWith(chave)
                .compact();
    }

    /** Devolve o principal a partir do token, sem ida ao banco. */
    public UsuarioAutenticado ler(String token) {
        try {
            Claims c = Jwts.parser()
                    .verifyWith(chave)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String funcionarioId = c.get("funcionarioId", String.class);
            return new UsuarioAutenticado(
                    UUID.fromString(c.getSubject()),
                    UUID.fromString(c.get("oficinaId", String.class)),
                    c.get("nome", String.class),
                    c.get("email", String.class),
                    Papel.valueOf(c.get("papel", String.class)),
                    funcionarioId == null || funcionarioId.isBlank() ? null : UUID.fromString(funcionarioId),
                    null,
                    true);
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public long accessTtlSegundos() {
        return accessTtlMinutos * 60;
    }

    public long refreshTtlDias() {
        return refreshTtlDias;
    }

    /** Token opaco de 32 bytes: usado no refresh e no link publico de acompanhamento. */
    public static String gerarTokenOpaco() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Guardamos sempre o hash, nunca o token em si. */
    public static String hash(String valor) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(valor.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponivel", e);
        }
    }
}
