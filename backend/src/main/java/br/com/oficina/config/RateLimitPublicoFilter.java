package br.com.oficina.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Limite de requisicoes por IP no endpoint publico de acompanhamento.
 * Sem isso, um token vazado (ou um robo) consegue varrer a API sem custo.
 * Janela fixa de 1 minuto, em memoria - suficiente para uma oficina.
 */
@Component
public class RateLimitPublicoFilter extends OncePerRequestFilter {

    private record Janela(long minuto, AtomicInteger contador) {
    }

    private final Map<String, Janela> janelas = new ConcurrentHashMap<>();
    private final int limitePorMinuto;

    public RateLimitPublicoFilter(AppProperties props) {
        this.limitePorMinuto = props.rateLimitPublicoPorMinuto();
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {

        String ip = ipDoCliente(request);
        long minutoAtual = Instant.now().getEpochSecond() / 60;

        Janela janela = janelas.compute(ip, (chave, atual) ->
                atual == null || atual.minuto() != minutoAtual
                        ? new Janela(minutoAtual, new AtomicInteger(0))
                        : atual);

        if (janela.contador().incrementAndGet() > limitePorMinuto) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("""
                    {"title":"Muitas requisicoes",\
                    "status":429,\
                    "detail":"Aguarde um minuto e tente novamente."}""");
            return;
        }

        if (janelas.size() > 10_000) {
            janelas.entrySet().removeIf(e -> e.getValue().minuto() < minutoAtual);
        }

        chain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/publico/");
    }

    private String ipDoCliente(HttpServletRequest request) {
        String encaminhado = request.getHeader("X-Forwarded-For");
        if (encaminhado != null && !encaminhado.isBlank()) {
            return encaminhado.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
