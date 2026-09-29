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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@Tag(name = "Pecas")
public class PecaController {

    private final PecaService service;
    private final PecaCatalogoService catalogo;

    public PecaController(PecaService service, PecaCatalogoService catalogo) {
        this.service = service;
        this.catalogo = catalogo;
    }

    @GetMapping("/pecas/pendentes")
    @Operation(summary = "Pecas solicitadas ou compradas que ainda nao chegaram")
    public List<PecaDtos.Pendente> pendentes() {
        return service.pendentes();
    }

    // ---------------- catalogo ----------------

    @GetMapping("/pecas/catalogo")
    @Operation(summary = "Pecas cadastradas, com o saldo de estoque")
    public List<PecaCatalogoDtos.Resposta> catalogo(
            @RequestParam(defaultValue = "false") boolean apenasAtivas) {
        return catalogo.listar(apenasAtivas);
    }

    @GetMapping("/pecas/catalogo/autocompletar")
    @Operation(summary = "Busca peca do catalogo enquanto o mecanico digita")
    public List<PecaCatalogoDtos.Resposta> autocompletar(@RequestParam String termo) {
        return catalogo.autocompletar(termo);
    }

    @GetMapping("/pecas/catalogo/no-minimo")
    @Operation(summary = "O que acabou ou esta acabando na prateleira")
    public List<PecaCatalogoDtos.Resposta> noMinimo() {
        return catalogo.noMinimo();
    }

    @PostMapping("/pecas/catalogo")
    public PecaCatalogoDtos.Resposta cadastrar(@Valid @RequestBody PecaCatalogoDtos.Requisicao req) {
        return catalogo.criar(req);
    }

    @PutMapping("/pecas/catalogo/{id}")
    public PecaCatalogoDtos.Resposta editar(@PathVariable UUID id,
                                            @Valid @RequestBody PecaCatalogoDtos.Requisicao req) {
        return catalogo.atualizar(id, req);
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

    /**
     * A peca comprada chegou.
     *
     * Endpoint proprio, e nao `status = RECEBIDA` no PUT: aqui a peca entra no
     * estoque obrigatoriamente, e com o status solto o caminho de receber sem
     * guardar continuaria existindo.
     */
    @PostMapping("/os/{osId}/pecas/{pecaId}/recebimento")
    @Operation(summary = "Registra a chegada da peca e guarda no catalogo/estoque")
    public OsDtos.PecaResposta receber(@PathVariable UUID osId,
                                       @PathVariable UUID pecaId,
                                       @Valid @RequestBody PecaCatalogoDtos.Recebimento req) {
        return service.receber(osId, pecaId, req);
    }

    @DeleteMapping("/os/{osId}/pecas/{pecaId}")
    public ResponseEntity<Void> remover(@PathVariable UUID osId, @PathVariable UUID pecaId) {
        service.remover(osId, pecaId);
        return ResponseEntity.noContent().build();
    }
}
