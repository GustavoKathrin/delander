package br.com.oficina.common;

import br.com.oficina.auth.UsuarioAutenticado;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Atalho para o usuario/oficina da requisicao atual. */
@Component
public class Contexto {

    public UsuarioAutenticado usuario() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UsuarioAutenticado usuario)) {
            throw new AccessDeniedException("Sessao invalida.");
        }
        return usuario;
    }

    public UUID oficinaId() {
        return usuario().oficinaId();
    }

    public UUID funcionarioId() {
        return usuario().funcionarioId();
    }

    public boolean gerencia() {
        return usuario().papel().gerencia();
    }

    public void exigirGerencia() {
        if (!gerencia()) {
            throw new AccessDeniedException("Apenas o dono ou o gerente podem fazer isso.");
        }
    }
}
