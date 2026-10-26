package br.com.oficina.auth;

import br.com.oficina.funcionario.FuncionarioRepository;
import br.com.oficina.usuario.Usuario;
import br.com.oficina.usuario.UsuarioRepository;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Carrega o usuario para o Spring Security.
 *
 * Fica separado do AuthService de proposito: o AuthenticationManager e montado
 * pelo Spring a partir desta classe, e o AuthService depende do
 * AuthenticationManager. Juntar as duas coisas em um unico bean cria ciclo de
 * dependencia e o contexto nao sobe.
 */
@Service
public class UsuarioDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;
    private final FuncionarioRepository funcionarioRepository;

    public UsuarioDetailsService(UsuarioRepository usuarioRepository,
                                 FuncionarioRepository funcionarioRepository) {
        this.usuarioRepository = usuarioRepository;
        this.funcionarioRepository = funcionarioRepository;
    }

    /**
     * O identificador pode ser o apelido ("tonny") ou o e-mail. Quem decide e
     * quem digita: o mecanico usa o apelido, o dono costuma usar o e-mail.
     */
    @Override
    @Transactional(readOnly = true)
    public UsuarioAutenticado loadUserByUsername(String identificador) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findByLoginOuEmail(identificador)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario nao encontrado."));
        return montar(usuario);
    }

    /** Principal da sessao, com o funcionario ligado ao usuario (se houver). */
    @Transactional(readOnly = true)
    public UsuarioAutenticado montar(Usuario usuario) {
        UUID funcionarioId = funcionarioRepository.findByUsuarioId(usuario.getId())
                .map(f -> f.getId())
                .orElse(null);

        return new UsuarioAutenticado(
                usuario.getId(),
                usuario.getOficinaId(),
                usuario.getNome(),
                usuario.getEmail(),
                usuario.getPapel(),
                funcionarioId,
                usuario.getSenhaHash(),
                usuario.isAtivo());
    }
}
