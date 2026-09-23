package br.com.oficina.cliente;

import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.veiculo.Veiculo;
import br.com.oficina.veiculo.VeiculoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;

@Service
public class ClienteService {

    private final ClienteRepository repository;
    private final VeiculoRepository veiculoRepository;
    private final Contexto contexto;

    public ClienteService(ClienteRepository repository,
                          VeiculoRepository veiculoRepository,
                          Contexto contexto) {
        this.repository = repository;
        this.veiculoRepository = veiculoRepository;
        this.contexto = contexto;
    }

    @Transactional(readOnly = true)
    public Page<ClienteDtos.Resposta> listar(String busca, Pageable pageable) {
        return repository.buscar(contexto.oficinaId(), busca, pageable)
                .map(c -> montar(c, false));
    }

    /** Busca do check-in: digita telefone ou nome e ja aparece com os carros. */
    @Transactional(readOnly = true)
    public List<ClienteDtos.Resposta> autocompletar(String termo) {
        if (termo == null || termo.trim().length() < 2) {
            return List.of();
        }
        return repository.autocompletar(contexto.oficinaId(), termo.trim(), PageRequest.of(0, 10))
                .stream()
                .map(c -> montar(c, true))
                .toList();
    }

    @Transactional(readOnly = true)
    public ClienteDtos.Resposta buscar(UUID id) {
        return montar(carregar(id), true);
    }

    @Transactional
    public ClienteDtos.Resposta criar(ClienteDtos.Requisicao req) {
        Cliente cliente = new Cliente();
        cliente.setOficinaId(contexto.oficinaId());
        aplicar(cliente, req);
        return montar(repository.save(cliente), false);
    }

    @Transactional
    public ClienteDtos.Resposta atualizar(UUID id, ClienteDtos.Requisicao req) {
        Cliente cliente = carregar(id);
        aplicar(cliente, req);
        return montar(repository.save(cliente), true);
    }

    /**
     * LGPD: nao apagamos o cliente (isso destruiria o historico de OS).
     * Anonimizamos os dados pessoais e mantemos as metricas.
     */
    @Transactional
    public void anonimizar(UUID id) {
        contexto.exigirGerencia();
        Cliente cliente = carregar(id);
        cliente.setNome("Cliente removido");
        cliente.setDocumento(null);
        cliente.setTelefone(null);
        cliente.setEmail(null);
        cliente.setObservacoes(null);
        cliente.setAnonimizado(true);
        cliente.setAtivo(false);
        cliente.setCompartilhamentoHabilitado(false);
        repository.save(cliente);
    }

    private Cliente carregar(UUID id) {
        return repository.findById(id)
                .filter(c -> c.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Cliente", id));
    }

    private void aplicar(Cliente cliente, ClienteDtos.Requisicao req) {
        cliente.setNome(req.nome().trim());
        cliente.setDocumento(vazioParaNulo(req.documento()));
        cliente.setTelefone(vazioParaNulo(req.telefone()));
        cliente.setEmail(vazioParaNulo(req.email()));
        cliente.setObservacoes(vazioParaNulo(req.observacoes()));
        if (req.consentimentoContato() != null) {
            cliente.setConsentimentoContato(req.consentimentoContato());
        }
        cliente.setCompartilhamentoHabilitado(req.compartilhamentoHabilitado());
        if (req.escopoCompartilhamento() != null) {
            cliente.setEscopoCompartilhamento(new LinkedHashMap<>(req.escopoCompartilhamento()));
        }
        if (req.ativo() != null) {
            cliente.setAtivo(req.ativo());
        }
    }

    private ClienteDtos.Resposta montar(Cliente cliente, boolean comVeiculos) {
        List<ClienteDtos.VeiculoResumo> veiculos = comVeiculos
                ? veiculoRepository.listarPorCliente(cliente.getId()).stream()
                .map(this::resumoVeiculo)
                .toList()
                : List.of();

        return new ClienteDtos.Resposta(
                cliente.getId(),
                cliente.getNome(),
                cliente.getDocumento(),
                cliente.getTelefone(),
                cliente.getEmail(),
                cliente.getObservacoes(),
                cliente.isConsentimentoContato(),
                cliente.getCompartilhamentoHabilitado(),
                cliente.getEscopoCompartilhamento(),
                cliente.isAtivo(),
                cliente.isAnonimizado(),
                veiculos);
    }

    private ClienteDtos.VeiculoResumo resumoVeiculo(Veiculo v) {
        return new ClienteDtos.VeiculoResumo(v.getId(), v.getPlaca(), v.descricaoCurta(),
                v.getMarca(), v.getModelo(), v.getAno(), v.getCor(), v.getKm());
    }

    private String vazioParaNulo(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
