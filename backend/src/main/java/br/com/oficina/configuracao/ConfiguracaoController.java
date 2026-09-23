package br.com.oficina.configuracao;

import br.com.oficina.common.Contexto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/configuracoes")
@Tag(name = "Configuracoes")
public class ConfiguracaoController {

    private final ConfiguracaoService service;
    private final Contexto contexto;

    public ConfiguracaoController(ConfiguracaoService service, Contexto contexto) {
        this.service = service;
        this.contexto = contexto;
    }

    @GetMapping
    @Operation(summary = "Lista todas as configuracoes (o front usa para mostrar/esconder telas e campos)")
    public List<ConfiguracaoDtos.Item> listar() {
        return service.listar(contexto.oficinaId());
    }

    @GetMapping("/mapa")
    @Operation(summary = "Configuracoes como mapa chave -> valor")
    public Map<String, String> mapa() {
        return service.valores(contexto.oficinaId());
    }

    @PutMapping
    @PreAuthorize("hasRole('DONO')")
    @Operation(summary = "Atualiza configuracoes (somente o dono)")
    public List<ConfiguracaoDtos.Item> atualizar(@Valid @RequestBody ConfiguracaoDtos.AtualizacaoRequisicao req) {
        return service.atualizar(contexto.oficinaId(), req.valores());
    }
}
