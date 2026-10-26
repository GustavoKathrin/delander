package br.com.oficina.demo;

import br.com.oficina.config.AppProperties;
import br.com.oficina.funcionario.Funcionario;
import br.com.oficina.funcionario.FuncionarioRepository;
import br.com.oficina.usuario.LoginUsuario;
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

import java.math.BigDecimal;
import java.util.List;

/**
 * Cria a equipe da oficina no primeiro start.
 *
 * Por que em codigo e nao numa migration SQL: a senha precisa passar pelo
 * PasswordEncoder. Hash chumbado em arquivo .sql congela o custo do BCrypt no
 * valor do dia em que foi escrito -- e foi exatamente esse custo que acabamos
 * de baixar para o login parar de demorar.
 *
 * Roda depois da CargaInicial (@Order(2)) porque o dono do sistema precisa
 * existir antes. E idempotente: quem ja existe e pulado pelo apelido, entao
 * reiniciar a aplicacao nao duplica ninguem nem reseta senha trocada.
 */
@Component
@Order(2)
public class CargaEquipe implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CargaEquipe.class);

    /**
     * A equipe. O e-mail aqui e so endereco interno: ninguem precisa receber
     * mensagem nele, e o mecanico entra pelo apelido mesmo.
     */
    private record Pessoa(String login, String nome, String email, Papel papel, boolean naBancada) {
    }

    private static final List<Pessoa> EQUIPE = List.of(
            new Pessoa("delander", "Delander", "delander@delander.local", Papel.DONO, false),
            new Pessoa("gustavo", "Gustavo", "gustavo@delander.local", Papel.DONO, false),
            new Pessoa("secretaria", "Secretaria", "secretaria@delander.local", Papel.RECEPCAO, false),
            new Pessoa("tonny", "Tonny", "tonny@delander.local", Papel.MECANICO, true),
            new Pessoa("kevim", "Kevim", "kevim@delander.local", Papel.MECANICO, true));

    private final UsuarioRepository usuarioRepository;
    private final FuncionarioRepository funcionarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;

    public CargaEquipe(UsuarioRepository usuarioRepository,
                       FuncionarioRepository funcionarioRepository,
                       PasswordEncoder passwordEncoder,
                       AppProperties props) {
        this.usuarioRepository = usuarioRepository;
        this.funcionarioRepository = funcionarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String senhaPadrao = props.equipeSenhaPadrao();
        if (senhaPadrao == null || senhaPadrao.isBlank()) {
            log.info("APP_EQUIPE_SENHA_PADRAO vazia: carga da equipe nao executada.");
            return;
        }

        int criados = 0;
        for (Pessoa pessoa : EQUIPE) {
            if (usuarioRepository.existsByLoginIgnoreCase(pessoa.login())
                    || usuarioRepository.existsByEmailIgnoreCase(pessoa.email())) {
                continue;
            }

            Usuario usuario = new Usuario();
            usuario.setOficinaId(CargaInicial.OFICINA_PADRAO);
            usuario.setNome(pessoa.nome());
            usuario.setEmail(pessoa.email());
            usuario.setLogin(LoginUsuario.normalizar(pessoa.login()));
            usuario.setSenhaHash(passwordEncoder.encode(senhaPadrao));
            usuario.setPapel(pessoa.papel());
            usuario.setAtivo(true);
            usuarioRepository.save(usuario);

            // Mecanico precisa de ficha de funcionario: e dela que saem a
            // agenda, o apontamento de hora e a alocacao no patio. Dono e
            // recepcao nao pegam servico, entao nao entram na bancada.
            if (pessoa.naBancada()) {
                Funcionario funcionario = new Funcionario();
                funcionario.setOficinaId(CargaInicial.OFICINA_PADRAO);
                funcionario.setUsuarioId(usuario.getId());
                funcionario.setNome(pessoa.nome());
                funcionario.setHorasPorDia(new BigDecimal("8"));
                funcionario.setAtivo(true);
                funcionarioRepository.save(funcionario);
            }

            criados++;
        }

        if (criados > 0) {
            log.info("Equipe criada: {} usuarios. Entram pelo apelido (ex.: tonny). "
                    + "Troque a senha padrao em Funcionarios.", criados);
        }
    }
}
