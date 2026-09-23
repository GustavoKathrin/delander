package br.com.oficina.ordemservico;

import br.com.oficina.auth.UsuarioAutenticado;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Trilha de eventos da OS. Alimenta ao mesmo tempo a timeline interna,
 * a auditoria e a pagina publica de acompanhamento.
 */
@Service
public class EventoService {

    public static final String OS_CRIADA = "OS_CRIADA";
    public static final String STATUS_ALTERADO = "STATUS_ALTERADO";
    public static final String ITEM_ADICIONADO = "ITEM_ADICIONADO";
    public static final String ITEM_REMOVIDO = "ITEM_REMOVIDO";
    public static final String ITEM_ATRIBUIDO = "ITEM_ATRIBUIDO";
    public static final String SERVICO_INICIADO = "SERVICO_INICIADO";
    public static final String SERVICO_PAUSADO = "SERVICO_PAUSADO";
    public static final String SERVICO_RETOMADO = "SERVICO_RETOMADO";
    public static final String SERVICO_CONCLUIDO = "SERVICO_CONCLUIDO";
    public static final String PECA_SOLICITADA = "PECA_SOLICITADA";
    public static final String PECA_ATUALIZADA = "PECA_ATUALIZADA";
    public static final String AGENDAMENTO = "AGENDAMENTO";
    public static final String ORCAMENTO_APROVADO = "ORCAMENTO_APROVADO";
    public static final String LINK_GERADO = "LINK_GERADO";
    public static final String FOTO_ANEXADA = "FOTO_ANEXADA";
    public static final String OBSERVACAO = "OBSERVACAO";

    private final EventoOsRepository repository;
    private final Clock clock;

    public EventoService(EventoOsRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    public EventoOs registrar(UUID oficinaId, UUID ordemServicoId, String tipo,
                              String descricao, boolean visivelCliente) {
        return registrar(oficinaId, ordemServicoId, tipo, descricao, visivelCliente, null);
    }

    @Transactional
    public EventoOs registrar(UUID oficinaId, UUID ordemServicoId, String tipo,
                              String descricao, boolean visivelCliente, Map<String, Object> dados) {
        EventoOs evento = new EventoOs();
        evento.setOficinaId(oficinaId);
        evento.setOrdemServicoId(ordemServicoId);
        evento.setTipo(tipo);
        evento.setDescricao(descricao);
        evento.setVisivelCliente(visivelCliente);
        evento.setDados(dados);
        evento.setAutor(autor());
        evento.setCriadoEm(OffsetDateTime.now(clock));
        return repository.save(evento);
    }

    @Transactional(readOnly = true)
    public List<OsDtos.EventoResposta> listar(UUID ordemServicoId) {
        return repository.findByOrdemServicoIdOrderByCriadoEmAsc(ordemServicoId).stream()
                .map(this::mapear)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EventoOs> listarPublicos(UUID ordemServicoId) {
        return repository.findByOrdemServicoIdAndVisivelClienteTrueOrderByCriadoEmAsc(ordemServicoId);
    }

    private OsDtos.EventoResposta mapear(EventoOs e) {
        return new OsDtos.EventoResposta(e.getId(), e.getTipo(), e.getDescricao(),
                e.getAutor(), e.getCriadoEm(), e.isVisivelCliente());
    }

    private String autor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UsuarioAutenticado usuario) {
            return usuario.nome();
        }
        return "sistema";
    }
}
