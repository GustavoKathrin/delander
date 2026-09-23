package br.com.oficina.compartilhamento;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api")
@Tag(name = "Compartilhamento com o cliente")
public class CompartilhamentoController {

    private final CompartilhamentoService service;

    public CompartilhamentoController(CompartilhamentoService service) {
        this.service = service;
    }

    @PostMapping("/os/{osId}/compartilhamento")
    @Operation(summary = "Gera (ou recupera) o link de acompanhamento da OS")
    public CompartilhamentoDtos.Resposta gerar(@PathVariable UUID osId,
                                               @RequestBody(required = false)
                                               CompartilhamentoDtos.Requisicao req) {
        return service.criarOuRecuperar(osId, req);
    }

    @PostMapping("/os/{osId}/compartilhamento/rotacionar")
    @Operation(summary = "Gera um link novo e invalida o anterior")
    public CompartilhamentoDtos.Resposta rotacionar(@PathVariable UUID osId) {
        return service.rotacionar(osId);
    }

    @PatchMapping("/compartilhamentos/{id}")
    @Operation(summary = "Liga/desliga o link, muda a validade, o PIN ou o que ele mostra")
    public CompartilhamentoDtos.Resposta atualizar(@PathVariable UUID id,
                                                   @RequestBody CompartilhamentoDtos.AtualizacaoRequisicao req) {
        return service.atualizar(id, req);
    }
}
