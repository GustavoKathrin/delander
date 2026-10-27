package br.com.oficina.usuario;

import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.config.AppProperties;
import br.com.oficina.funcionario.FuncionarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * As contas que entram no sistema sem ficha de funcionario.
 *
 * A tela de Funcionarios cuida de quem pega servico, e so dela sai a
 * capacidade de mao de obra da oficina. Dono, segundo dono e recepcao nao
 * entram ali de proposito -- mas tambem nao entravam em lugar nenhum, e com
 * isso a senha deles so era trocavel por variavel de ambiente no servidor.
 *
 * Este servico e a outra metade: lista essas contas e deixa a gerencia
 * trocar nome, apelido, perfil e senha. Nao cria conta nova, porque conta
 * que pega servico nasce com a ficha, em Funcionarios.
 */
@Service
public class UsuarioService {

    private final UsuarioRepository repository;
    private final FuncionarioRepository funcionarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;
    private final Contexto contexto;

    public UsuarioService(UsuarioRepository repository,
                          FuncionarioRepository funcionarioRepository,
                          PasswordEncoder passwordEncoder,
                          AppProperties props,
                          Contexto contexto) {
        this.repository = repository;
        this.funcionarioRepository = funcionarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
        this.contexto = contexto;
    }

    @Transactional(readOnly = true)
    public List<UsuarioDtos.Resposta> semBancada() {
        contexto.exigirGerencia();
        return repository.findByOficinaIdOrderByNome(contexto.oficinaId()).stream()
                .filter(u -> funcionarioRepository.findByUsuarioId(u.getId()).isEmpty())
                .map(UsuarioDtos.Resposta::de)
                .toList();
    }

    @Transactional
    public UsuarioDtos.Resposta atualizar(UUID id, UsuarioDtos.Requisicao req) {
        contexto.exigirGerencia();

        Usuario usuario = repository.findById(id)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Usuario", id));
        if (!usuario.getOficinaId().equals(contexto.oficinaId())) {
            throw RecursoNaoEncontradoException.de("Usuario", id);
        }
        if (funcionarioRepository.findByUsuarioId(id).isPresent()) {
            throw new RegraNegocioException(
                    "Esta conta tem ficha de funcionario: edite por Funcionarios, para a jornada"
                            + " continuar batendo com a capacidade da oficina.");
        }

        usuario.setNome(req.nome().trim());

        // Apelido so muda quando vem preenchido: em branco nao apaga o que a
        // pessoa ja usa para entrar.
        String novoLogin = LoginUsuario.normalizar(req.login());
        if (!novoLogin.isEmpty() && !novoLogin.equalsIgnoreCase(usuario.getLogin())) {
            if (repository.existsByLoginIgnoreCase(novoLogin)) {
                throw new RegraNegocioException("Ja existe um usuario com o apelido " + novoLogin + ".");
            }
            usuario.setLogin(novoLogin);
        }

        if (req.papel() != null) {
            // Tirar o ultimo dono deixaria a oficina sem ninguem que mexe em
            // configuracao, e sem jeito de voltar atras pela propria tela.
            if (usuario.getPapel() == Papel.DONO && req.papel() != Papel.DONO
                    && contarDonosAtivos() <= 1) {
                throw new RegraNegocioException(
                        "Este e o unico dono ativo. Promova outra pessoa a dono antes de mudar o perfil.");
            }
            usuario.setPapel(req.papel());
        }

        if (req.senha() != null && !req.senha().isBlank()) {
            if (req.senha().length() < props.senhaMinima()) {
                throw new RegraNegocioException("A senha precisa ter ao menos %d caracteres."
                        .formatted(props.senhaMinima()));
            }
            usuario.setSenhaHash(passwordEncoder.encode(req.senha()));
        }

        if (req.ativo() != null) {
            if (!req.ativo() && usuario.getPapel() == Papel.DONO && contarDonosAtivos() <= 1) {
                throw new RegraNegocioException(
                        "Este e o unico dono ativo. Desativar deixaria a oficina sem acesso de dono.");
            }
            usuario.setAtivo(req.ativo());
        }

        return UsuarioDtos.Resposta.de(repository.save(usuario));
    }

    private long contarDonosAtivos() {
        return repository.findByOficinaIdOrderByNome(contexto.oficinaId()).stream()
                .filter(u -> u.isAtivo() && u.getPapel() == Papel.DONO)
                .count();
    }
}
