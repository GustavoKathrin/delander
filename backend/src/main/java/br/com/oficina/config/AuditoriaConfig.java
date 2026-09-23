package br.com.oficina.config;

import br.com.oficina.auth.UsuarioAutenticado;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

@Configuration
public class AuditoriaConfig {

    /** Quem alterou o registro: e-mail do usuario logado, ou "sistema" nos jobs. */
    @Bean
    public AuditorAware<String> auditorAware() {
        return () -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof UsuarioAutenticado usuario) {
                return Optional.of(usuario.email());
            }
            return Optional.of("sistema");
        };
    }
}
