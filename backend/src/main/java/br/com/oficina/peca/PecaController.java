package br.com.oficina.peca;

import br.com.oficina.ordemservico.OsDtos;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@Tag(name = "Pecas")
public class PecaController {

    private final PecaService service;

    public PecaController(PecaService service) {
        this.service = service;
    }

    @GetMapping("/pecas/pendentes")
    @Operation(summary = "Pecas solicitadas ou compradas que ainda nao chegaram")
    public List<PecaDtos.Pendente> pendentes() {
        return service.pendentes();
    }

    @PostMapping("/os/{osId}/pecas")
    public OsDtos.PecaResposta adicionar(@PathVariable UUID osId,
                                         @Valid @RequestBody PecaDtos.Requisicao req) {
        return service.adicionar(osId, req);
    }

    @PutMapping("/os/{osId}/pecas/{pecaId}")
    public OsDtos.PecaResposta atualizar(@PathVariable UUID osId,
                                         @PathVariable UUID pecaId,
                                         @Valid @RequestBody PecaDtos.Requisicao req) {
        return service.atualizar(osId, pecaId, req);
    }

    @DeleteMapping("/os/{osId}/pecas/{pecaId}")
    public ResponseEntity<Void> remover(@PathVariable UUID osId, @PathVariable UUID pecaId) {
        service.remover(osId, pecaId);
        return ResponseEntity.noContent().build();
    }
}
