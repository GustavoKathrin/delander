package br.com.oficina.usuario;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Usuarios")
public class UsuarioController {

    private final UsuarioService service;

    public UsuarioController(UsuarioService service) {
        this.service = service;
    }

    @GetMapping("/sem-bancada")
    @Operation(summary = "Contas que entram no sistema mas nao pegam servico")
    public List<UsuarioDtos.Resposta> semBancada() {
        return service.semBancada();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Troca nome, apelido, perfil ou senha de uma conta sem ficha")
    public UsuarioDtos.Resposta atualizar(@PathVariable UUID id,
                                          @Valid @RequestBody UsuarioDtos.Requisicao req) {
        return service.atualizar(id, req);
    }
}
