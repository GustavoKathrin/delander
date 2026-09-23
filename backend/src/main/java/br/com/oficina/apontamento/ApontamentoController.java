package br.com.oficina.apontamento;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/apontamentos")
@Tag(name = "Apontamento de horas")
public class ApontamentoController {

    private final ApontamentoService service;

    public ApontamentoController(ApontamentoService service) {
        this.service = service;
    }

    @GetMapping("/meus")
    @Operation(summary = "Painel do Mecanico: meus servicos abertos")
    public List<ApontamentoDtos.MeuServico> meus() {
        return service.meusServicos();
    }

    @GetMapping("/abertos")
    @Operation(summary = "Todos os servicos abertos da oficina (dono e modo TV)")
    public List<ApontamentoDtos.MeuServico> abertos() {
        return service.servicosAbertos();
    }

    @PostMapping("/iniciar")
    @Operation(summary = "Inicia o cronometro informando a previsao de horas")
    public ApontamentoDtos.MeuServico iniciar(@Valid @RequestBody ApontamentoDtos.IniciarRequisicao req) {
        return service.iniciar(req);
    }

    @PostMapping("/{id}/pausar")
    @Operation(summary = "Pausa o servico registrando o motivo (falta de peca, aprovacao...)")
    public ApontamentoDtos.MeuServico pausar(@PathVariable UUID id,
                                             @RequestBody ApontamentoDtos.PausarRequisicao req) {
        return service.pausar(id, req);
    }

    @PostMapping("/{id}/concluir")
    @Operation(summary = "Conclui o servico (se for o ultimo, a OS vira Pronto para retirada)")
    public ApontamentoDtos.MeuServico concluir(@PathVariable UUID id,
                                               @RequestBody(required = false)
                                               ApontamentoDtos.ConcluirRequisicao req) {
        return service.concluir(id, req);
    }
}
