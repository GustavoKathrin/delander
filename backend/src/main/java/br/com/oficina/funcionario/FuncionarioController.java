package br.com.oficina.funcionario;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
@RequestMapping("/api/funcionarios")
@Tag(name = "Funcionarios")
public class FuncionarioController {

    private final FuncionarioService service;

    public FuncionarioController(FuncionarioService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Lista funcionarios com suas especialidades")
    public List<FuncionarioDtos.Resposta> listar(
            @RequestParam(defaultValue = "false") boolean apenasAtivos) {
        return service.listar(apenasAtivos);
    }

    @GetMapping("/{id}")
    public FuncionarioDtos.Resposta buscar(@PathVariable UUID id) {
        return service.buscar(id);
    }

    @PostMapping
    @Operation(summary = "Cadastra funcionario (com acesso ao sistema, se informado)")
    public FuncionarioDtos.Resposta criar(@Valid @RequestBody FuncionarioDtos.Requisicao req) {
        return service.criar(req);
    }

    @PutMapping("/{id}")
    public FuncionarioDtos.Resposta atualizar(@PathVariable UUID id,
                                              @Valid @RequestBody FuncionarioDtos.Requisicao req) {
        return service.atualizar(id, req);
    }
}
