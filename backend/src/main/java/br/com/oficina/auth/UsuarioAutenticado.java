package br.com.oficina.auth;

import br.com.oficina.usuario.Papel;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Principal da sessao. Carrega a oficina e o funcionario ligado ao usuario,
 * para que o mecanico so consiga apontar nos proprios servicos.
 */
public record UsuarioAutenticado(
        UUID id,
        UUID oficinaId,
        String nome,
        String email,
        Papel papel,
        UUID funcionarioId,
        String senhaHash,
        boolean ativo
) implements UserDetails {

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + papel.name()));
    }

    @Override
    public String getPassword() {
        return senhaHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return ativo;
    }

    /** Copia sem o hash da senha, usada depois que o token ja foi validado. */
    public UsuarioAutenticado semSenha() {
        return new UsuarioAutenticado(id, oficinaId, nome, email, papel, funcionarioId, null, ativo);
    }
}
