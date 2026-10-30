package br.com.oficina.apontamento;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/execucao")
@Tag(name = "Execucao")
public class ExecucaoController {

    private final ExecucaoService service;

    public ExecucaoController(ExecucaoService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Painel da Etapa 6: a oficina inteira, por carro, agora")
    public ExecucaoDtos.Painel painel() {
        return service.painel();
    }
}
