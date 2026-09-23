package br.com.oficina.veiculo;

import br.com.oficina.ordemservico.OrdemServicoService;
import br.com.oficina.ordemservico.OsDtos;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/veiculos")
@Tag(name = "Veiculos")
public class VeiculoController {

    private final VeiculoService service;
    private final OrdemServicoService osService;

    public VeiculoController(VeiculoService service, OrdemServicoService osService) {
        this.service = service;
        this.osService = osService;
    }

    @GetMapping
    @Operation(summary = "Lista veiculos com busca por placa, modelo ou cliente")
    public Page<VeiculoDtos.Resposta> listar(@RequestParam(required = false) String busca,
                                             @RequestParam(defaultValue = "0") int pagina,
                                             @RequestParam(defaultValue = "20") int tamanho) {
        return service.listar(busca, PageRequest.of(pagina, Math.min(tamanho, 100)));
    }

    @GetMapping("/placa/{placa}")
    @Operation(summary = "Busca por placa: no check-in, digitar a placa ja traz o carro e o cliente")
    public ResponseEntity<VeiculoDtos.Resposta> porPlaca(@PathVariable String placa) {
        return service.porPlaca(placa)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public VeiculoDtos.Resposta buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @GetMapping("/{id}/historico")
    @Operation(summary = "Todas as OS deste veiculo, da mais recente para a mais antiga")
    public List<OsDtos.Resumo> historico(@PathVariable UUID id) {
        return osService.historicoDoVeiculo(id);
    }

    @GetMapping("/{id}/proprietarios")
    @Operation(summary = "Historico de donos do veiculo")
    public List<VeiculoDtos.ProprietarioHistorico> proprietarios(@PathVariable UUID id) {
        return service.historicoProprietarios(id);
    }

    @PostMapping
    public VeiculoDtos.Resposta criar(@Valid @RequestBody VeiculoDtos.Requisicao req) {
        return service.criar(req);
    }

    @PutMapping("/{id}")
    public VeiculoDtos.Resposta atualizar(@PathVariable UUID id,
                                          @Valid @RequestBody VeiculoDtos.Requisicao req) {
        return service.atualizar(id, req);
    }
}
