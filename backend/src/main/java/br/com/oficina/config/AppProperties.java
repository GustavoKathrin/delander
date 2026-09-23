package br.com.oficina.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        Admin admin,
        boolean cargaDemo,
        String corsOrigens,
        String urlPublica,
        String uploadsDir,
        int rateLimitPublicoPorMinuto,
        /** Tamanho minimo da senha. Baixe so em ambiente de teste. */
        int senhaMinima,
        Imap imap
) {

    public record Jwt(String secret, long accessTtlMinutos, long refreshTtlDias) {
    }

    public record Admin(String email, String senha, String nome) {
    }

    /**
     * A caixa de e-mail de onde os relatorios do scanner sao lidos.
     *
     * Fica aqui, e nao na tabela configuracao, porque
     * GET /api/configuracoes/mapa devolve todo valor em texto claro para
     * qualquer usuario autenticado: a senha da caixa chegaria a cada
     * mecanico. O que a tela configura e o comportamento (ligado, assunto,
     * remetentes); a credencial vem do ambiente.
     */
    public record Imap(String host, int porta, String usuario, String senha, boolean ssl) {

        public boolean configurado() {
            return host != null && !host.isBlank()
                    && usuario != null && !usuario.isBlank()
                    && senha != null && !senha.isBlank();
        }
    }

    public List<String> origensPermitidas() {
        return Arrays.stream(corsOrigens.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }
}
