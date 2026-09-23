package br.com.oficina.funcionario;

import br.com.oficina.cadastro.CadastroDtos;
import br.com.oficina.cadastro.Especialidade;
import br.com.oficina.cadastro.EspecialidadeRepository;
import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.config.AppProperties;
import br.com.oficina.configuracao.ConfiguracaoService;
import br.com.oficina.usuario.Papel;
import br.com.oficina.usuario.Usuario;
import br.com.oficina.usuario.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class FuncionarioService {

    private final FuncionarioRepository repository;
    private final EspecialidadeRepository especialidadeRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final ConfiguracaoService config;
    private final AppProperties props;
    private final Contexto contexto;

    public FuncionarioService(FuncionarioRepository repository,
                              EspecialidadeRepository especialidadeRepository,
                              UsuarioRepository usuarioRepository,
                              PasswordEncoder passwordEncoder,
                              ConfiguracaoService config,
                              AppProperties props,
                              Contexto contexto) {
        this.repository = repository;
        this.especialidadeRepository = especialidadeRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.config = config;
        this.props = props;
        this.contexto = contexto;
    }

    @Transactional(readOnly = true)
    public List<FuncionarioDtos.Resposta> listar(boolean apenasAtivos) {
        UUID oficinaId = contexto.oficinaId();
        List<Funcionario> lista = apenasAtivos
                ? repository.listarAtivosComEspecialidades(oficinaId)
                : repository.listarComEspecialidades(oficinaId);
        return lista.stream().map(this::montar).toList();
    }

    @Transactional(readOnly = true)
    public FuncionarioDtos.Resposta buscar(UUID id) {
        return montar(carregar(id));
    }

    @Transactional
    public FuncionarioDtos.Resposta criar(FuncionarioDtos.Requisicao req) {
        contexto.exigirGerencia();
        UUID oficinaId = contexto.oficinaId();

        Funcionario funcionario = new Funcionario();
        funcionario.setOficinaId(oficinaId);
        aplicar(funcionario, req);

        if (req.acesso() != null && req.acesso().email() != null && !req.acesso().email().isBlank()) {
            funcionario.setUsuarioId(criarAcesso(req, oficinaId).getId());
        }

        return montar(repository.save(funcionario));
    }

    @Transactional
    public FuncionarioDtos.Resposta atualizar(UUID id, FuncionarioDtos.Requisicao req) {
        contexto.exigirGerencia();
        Funcionario funcionario = carregar(id);
        aplicar(funcionario, req);

        if (req.acesso() != null && req.acesso().email() != null && !req.acesso().email().isBlank()) {
            if (funcionario.getUsuarioId() == null) {
                funcionario.setUsuarioId(criarAcesso(req, funcionario.getOficinaId()).getId());
            } else {
                atualizarAcesso(funcionario.getUsuarioId(), req);
            }
        }

        // funcionario desativado perde o acesso ao sistema
        if (!funcionario.isAtivo() && funcionario.getUsuarioId() != null) {
            usuarioRepository.findById(funcionario.getUsuarioId()).ifPresent(u -> {
                u.setAtivo(false);
                usuarioRepository.save(u);
            });
        }

        return montar(repository.save(funcionario));
    }

    private Usuario criarAcesso(FuncionarioDtos.Requisicao req, UUID oficinaId) {
        String email = req.acesso().email().trim().toLowerCase();
        if (usuarioRepository.existsByEmailIgnoreCase(email)) {
            throw new RegraNegocioException("Ja existe um usuario com o e-mail " + email + ".");
        }
        if (req.acesso().senha() == null || req.acesso().senha().length() < props.senhaMinima()) {
            throw new RegraNegocioException("Informe uma senha de ao menos %d caracteres para o acesso."
                    .formatted(props.senhaMinima()));
        }

        Usuario usuario = new Usuario();
        usuario.setOficinaId(oficinaId);
        usuario.setNome(req.nome().trim());
        usuario.setEmail(email);
        usuario.setSenhaHash(passwordEncoder.encode(req.acesso().senha()));
        usuario.setPapel(req.acesso().papel() == null ? Papel.MECANICO : req.acesso().papel());
        usuario.setAtivo(req.ativo() == null || req.ativo());
        return usuarioRepository.save(usuario);
    }

    private void atualizarAcesso(UUID usuarioId, FuncionarioDtos.Requisicao req) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Usuario", usuarioId));

        String email = req.acesso().email().trim().toLowerCase();
        if (!usuario.getEmail().equalsIgnoreCase(email)
                && usuarioRepository.existsByEmailIgnoreCase(email)) {
            throw new RegraNegocioException("Ja existe um usuario com o e-mail " + email + ".");
        }

        usuario.setNome(req.nome().trim());
        usuario.setEmail(email);
        if (req.acesso().papel() != null) {
            usuario.setPapel(req.acesso().papel());
        }
        if (req.acesso().senha() != null && !req.acesso().senha().isBlank()) {
            if (req.acesso().senha().length() < props.senhaMinima()) {
                throw new RegraNegocioException("A senha precisa ter ao menos %d caracteres."
                        .formatted(props.senhaMinima()));
            }
            usuario.setSenhaHash(passwordEncoder.encode(req.acesso().senha()));
        }
        if (req.ativo() != null) {
            usuario.setAtivo(req.ativo());
        }
        usuarioRepository.save(usuario);
    }

    private Funcionario carregar(UUID id) {
        return repository.findById(id)
                .filter(f -> f.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Funcionario", id));
    }

    private void aplicar(Funcionario funcionario, FuncionarioDtos.Requisicao req) {
        funcionario.setNome(req.nome().trim());
        funcionario.setTelefone(req.telefone());
        funcionario.setHorasPorDia(req.horasPorDia() == null ? new BigDecimal("8") : req.horasPorDia());
        funcionario.setCustoHora(req.custoHora());
        if (req.ativo() != null) {
            funcionario.setAtivo(req.ativo());
        }

        if (req.especialidadeIds() != null) {
            Set<Especialidade> especialidades = new LinkedHashSet<>();
            for (UUID especialidadeId : req.especialidadeIds()) {
                especialidades.add(especialidadeRepository.findById(especialidadeId)
                        .filter(e -> e.getOficinaId().equals(funcionario.getOficinaId()))
                        .orElseThrow(() -> RecursoNaoEncontradoException.de("Especialidade", especialidadeId)));
            }
            funcionario.getEspecialidades().clear();
            funcionario.getEspecialidades().addAll(especialidades);
        }

        // a jornada dos funcionarios ativos e a capacidade de horas da oficina
        config.limparCache(funcionario.getOficinaId());
    }

    private FuncionarioDtos.Resposta montar(Funcionario funcionario) {
        Optional<Usuario> usuario = funcionario.getUsuarioId() == null
                ? Optional.empty()
                : usuarioRepository.findById(funcionario.getUsuarioId());

        return new FuncionarioDtos.Resposta(
                funcionario.getId(),
                funcionario.getNome(),
                funcionario.getTelefone(),
                funcionario.getHorasPorDia(),
                funcionario.getCustoHora(),
                funcionario.isAtivo(),
                funcionario.getUsuarioId(),
                usuario.map(Usuario::getEmail).orElse(null),
                usuario.map(Usuario::getPapel).orElse(null),
                usuario.map(u -> u.getPapel().descricao()).orElse(null),
                funcionario.getEspecialidades().stream()
                        .map(CadastroDtos.EspecialidadeResposta::de)
                        .toList());
    }
}
