package br.com.oficina.cliente;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/clientes")
@Tag(name = "Clientes")
public class ClienteController {

    private final ClienteService service;

    public ClienteController(ClienteService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Lista clientes com busca por nome, telefone ou documento")
    public Page<ClienteDtos.Resposta> listar(@RequestParam(required = false) String busca,
                                             @RequestParam(defaultValue = "0") int pagina,
                                             @RequestParam(defaultValue = "20") int tamanho) {
        return service.listar(busca, PageRequest.of(pagina, Math.min(tamanho, 100)));
    }

    @GetMapping("/autocompletar")
    @Operation(summary = "Busca rapida do check-in (traz os veiculos do cliente)")
    public List<ClienteDtos.Resposta> autocompletar(@RequestParam String termo) {
        return service.autocompletar(termo);
    }

    @GetMapping("/{id}")
    public ClienteDtos.Resposta buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping
    public ClienteDtos.Resposta criar(@Valid @RequestBody ClienteDtos.Requisicao req) {
        return service.criar(req);
    }

    @PutMapping("/{id}")
    public ClienteDtos.Resposta atualizar(@PathVariable UUID id,
                                          @Valid @RequestBody ClienteDtos.Requisicao req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Anonimiza o cliente (LGPD) preservando o historico de OS")
    public ResponseEntity<Void> anonimizar(@PathVariable UUID id) {
        service.anonimizar(id);
        return ResponseEntity.noContent().build();
    }
}
