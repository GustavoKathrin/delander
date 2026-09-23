package br.com.oficina.demo;

import br.com.oficina.config.AppProperties;
import br.com.oficina.usuario.Papel;
import br.com.oficina.usuario.Usuario;
import br.com.oficina.usuario.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Cria o usuario dono no primeiro start. A senha vem de variavel de ambiente. */
@Component
@Order(1)
public class CargaInicial implements ApplicationRunner {

    public static final UUID OFICINA_PADRAO = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private static final Logger log = LoggerFactory.getLogger(CargaInicial.class);

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;

    public CargaInicial(UsuarioRepository usuarioRepository,
                        PasswordEncoder passwordEncoder,
                        AppProperties props) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String email = props.admin().email().trim().toLowerCase();
        if (usuarioRepository.existsByEmailIgnoreCase(email)) {
            return;
        }

        Usuario dono = new Usuario();
        dono.setOficinaId(OFICINA_PADRAO);
        dono.setNome(props.admin().nome());
        dono.setEmail(email);
        dono.setSenhaHash(passwordEncoder.encode(props.admin().senha()));
        dono.setPapel(Papel.DONO);
        dono.setAtivo(true);
        usuarioRepository.save(dono);

        log.info("Usuario dono criado: {} (troque a senha no primeiro acesso)", email);
    }
}
