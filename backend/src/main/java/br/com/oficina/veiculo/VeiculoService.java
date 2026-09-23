package br.com.oficina.veiculo;

import br.com.oficina.cliente.Cliente;
import br.com.oficina.cliente.ClienteRepository;
import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class VeiculoService {

    private final VeiculoRepository repository;
    private final VeiculoProprietarioHistRepository historicoRepository;
    private final ClienteRepository clienteRepository;
    private final Contexto contexto;
    private final Clock clock;

    public VeiculoService(VeiculoRepository repository,
                          VeiculoProprietarioHistRepository historicoRepository,
                          ClienteRepository clienteRepository,
                          Contexto contexto,
                          Clock clock) {
        this.repository = repository;
        this.historicoRepository = historicoRepository;
        this.clienteRepository = clienteRepository;
        this.contexto = contexto;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<VeiculoDtos.Resposta> listar(String busca, Pageable pageable) {
        return repository.buscar(contexto.oficinaId(), busca, pageable).map(VeiculoDtos.Resposta::de);
    }

    @Transactional(readOnly = true)
    public VeiculoDtos.Resposta buscar(UUID id) {
        return VeiculoDtos.Resposta.de(carregar(id));
    }

    @Transactional(readOnly = true)
    public Optional<VeiculoDtos.Resposta> porPlaca(String placa) {
        return repository.findByOficinaIdAndPlaca(contexto.oficinaId(), Veiculo.normalizarPlaca(placa))
                .map(VeiculoDtos.Resposta::de);
    }

    @Transactional
    public VeiculoDtos.Resposta criar(VeiculoDtos.Requisicao req) {
        UUID oficinaId = contexto.oficinaId();
        String placa = validarPlaca(req.placa());

        if (repository.findByOficinaIdAndPlaca(oficinaId, placa).isPresent()) {
            throw new RegraNegocioException("Ja existe um veiculo cadastrado com a placa " + placa + ".");
        }

        Veiculo veiculo = new Veiculo();
        veiculo.setOficinaId(oficinaId);
        veiculo.setPlaca(placa);
        aplicar(veiculo, req);
        Veiculo salvo = repository.save(veiculo);

        VeiculoProprietarioHist hist = new VeiculoProprietarioHist();
        hist.setVeiculoId(salvo.getId());
        hist.setClienteId(salvo.getCliente().getId());
        hist.setInicio(OffsetDateTime.now(clock));
        historicoRepository.save(hist);

        return VeiculoDtos.Resposta.de(salvo);
    }

    @Transactional
    public VeiculoDtos.Resposta atualizar(UUID id, VeiculoDtos.Requisicao req) {
        Veiculo veiculo = carregar(id);
        UUID clienteAnterior = veiculo.getCliente().getId();

        veiculo.setPlaca(validarPlaca(req.placa()));
        aplicar(veiculo, req);

        if (!clienteAnterior.equals(veiculo.getCliente().getId())) {
            OffsetDateTime agora = OffsetDateTime.now(clock);
            historicoRepository.findByVeiculoIdOrderByInicioDesc(id).stream()
                    .filter(h -> h.getFim() == null)
                    .forEach(h -> {
                        h.setFim(agora);
                        historicoRepository.save(h);
                    });
            VeiculoProprietarioHist hist = new VeiculoProprietarioHist();
            hist.setVeiculoId(id);
            hist.setClienteId(veiculo.getCliente().getId());
            hist.setInicio(agora);
            historicoRepository.save(hist);
        }

        return VeiculoDtos.Resposta.de(repository.save(veiculo));
    }

    /** O historico da placa sobrevive a venda do carro. */
    @Transactional(readOnly = true)
    public List<VeiculoDtos.ProprietarioHistorico> historicoProprietarios(UUID veiculoId) {
        carregar(veiculoId);
        return historicoRepository.findByVeiculoIdOrderByInicioDesc(veiculoId).stream()
                .map(h -> new VeiculoDtos.ProprietarioHistorico(
                        h.getClienteId(),
                        clienteRepository.findById(h.getClienteId())
                                .map(Cliente::getNome).orElse("Cliente removido"),
                        h.getInicio(),
                        h.getFim()))
                .toList();
    }

    private Veiculo carregar(UUID id) {
        Veiculo veiculo = repository.buscarComCliente(id)
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Veiculo", id));
        if (!veiculo.getOficinaId().equals(contexto.oficinaId())) {
            throw RecursoNaoEncontradoException.de("Veiculo", id);
        }
        return veiculo;
    }

    private void aplicar(Veiculo veiculo, VeiculoDtos.Requisicao req) {
        Cliente cliente = clienteRepository.findById(req.clienteId())
                .filter(c -> c.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Cliente", req.clienteId()));
        veiculo.setCliente(cliente);
        veiculo.setMarca(req.marca());
        veiculo.setModelo(req.modelo());
        veiculo.setAno(req.ano());
        veiculo.setCor(req.cor());
        veiculo.setKm(req.km());
        veiculo.setChassi(req.chassi());
        veiculo.setObservacoes(req.observacoes());
        if (req.ativo() != null) {
            veiculo.setAtivo(req.ativo());
        }
    }

    private String validarPlaca(String bruta) {
        String placa = Veiculo.normalizarPlaca(bruta);
        if (placa == null || placa.length() < 6 || placa.length() > 8) {
            throw new RegraNegocioException("Placa invalida. Use o formato ABC1D23 ou ABC1234.");
        }
        return placa;
    }
}
