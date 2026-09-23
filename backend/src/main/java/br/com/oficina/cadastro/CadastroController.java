package br.com.oficina.cadastro;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
@Tag(name = "Cadastros configuraveis")
public class CadastroController {

    private final CadastroService service;

    public CadastroController(CadastroService service) {
        this.service = service;
    }

    // ------------------------------------------------- especialidades

    @GetMapping("/especialidades")
    @Operation(summary = "Lista especialidades (motor, eletrica, suspensao...)")
    public List<CadastroDtos.EspecialidadeResposta> especialidades(
            @RequestParam(defaultValue = "false") boolean apenasAtivas) {
        return service.especialidades(apenasAtivas);
    }

    @PostMapping("/especialidades")
    public CadastroDtos.EspecialidadeResposta criarEspecialidade(
            @Valid @RequestBody CadastroDtos.EspecialidadeRequisicao req) {
        return service.criarEspecialidade(req);
    }

    @PutMapping("/especialidades/{id}")
    public CadastroDtos.EspecialidadeResposta atualizarEspecialidade(
            @PathVariable UUID id, @Valid @RequestBody CadastroDtos.EspecialidadeRequisicao req) {
        return service.atualizarEspecialidade(id, req);
    }

    // ------------------------------------------------- boxes

    @GetMapping("/boxes")
    @Operation(summary = "Lista as vagas fisicas da oficina")
    public List<CadastroDtos.BoxResposta> boxes(@RequestParam(defaultValue = "false") boolean apenasAtivos) {
        return service.boxes(apenasAtivos);
    }

    @PostMapping("/boxes")
    public CadastroDtos.BoxResposta criarBox(@Valid @RequestBody CadastroDtos.BoxRequisicao req) {
        CadastroDtos.BoxResposta resposta = service.criarBox(req);
        service.invalidarCache();
        return resposta;
    }

    @PutMapping("/boxes/{id}")
    public CadastroDtos.BoxResposta atualizarBox(@PathVariable UUID id,
                                                 @Valid @RequestBody CadastroDtos.BoxRequisicao req) {
        CadastroDtos.BoxResposta resposta = service.atualizarBox(id, req);
        service.invalidarCache();
        return resposta;
    }

    @PutMapping("/boxes/layout")
    @Operation(summary = "Salva a planta do patio: onde cada vaga fica e que tamanho tem")
    public List<CadastroDtos.BoxResposta> salvarLayout(
            @Valid @RequestBody CadastroDtos.LayoutRequisicao req) {
        List<CadastroDtos.BoxResposta> resposta = service.salvarLayout(req.vagas());
        service.invalidarCache();
        return resposta;
    }

    @DeleteMapping("/boxes/layout")
    @Operation(summary = "Volta a planta para o arranjo automatico")
    public List<CadastroDtos.BoxResposta> limparLayout() {
        List<CadastroDtos.BoxResposta> resposta = service.limparLayout();
        service.invalidarCache();
        return resposta;
    }

    // ------------------------------------------------- motivos de parada

    @GetMapping("/motivos-parada")
    @Operation(summary = "Lista motivos de parada (alimentam o Pareto do dashboard)")
    public List<CadastroDtos.MotivoResposta> motivos(@RequestParam(defaultValue = "false") boolean apenasAtivos) {
        return service.motivos(apenasAtivos);
    }

    @PostMapping("/motivos-parada")
    public CadastroDtos.MotivoResposta criarMotivo(@Valid @RequestBody CadastroDtos.MotivoRequisicao req) {
        return service.criarMotivo(req);
    }

    @PutMapping("/motivos-parada/{id}")
    public CadastroDtos.MotivoResposta atualizarMotivo(@PathVariable UUID id,
                                                       @Valid @RequestBody CadastroDtos.MotivoRequisicao req) {
        return service.atualizarMotivo(id, req);
    }

    // ------------------------------------------------- catalogo de servicos

    @GetMapping("/catalogo-servicos")
    @Operation(summary = "Catalogo de servicos com tempo padrao")
    public List<CadastroDtos.ServicoResposta> servicos(@RequestParam(defaultValue = "false") boolean apenasAtivos) {
        return service.servicos(apenasAtivos);
    }

    @PostMapping("/catalogo-servicos")
    public CadastroDtos.ServicoResposta criarServico(@Valid @RequestBody CadastroDtos.ServicoRequisicao req) {
        return service.criarServico(req);
    }

    @PutMapping("/catalogo-servicos/{id}")
    public CadastroDtos.ServicoResposta atualizarServico(@PathVariable UUID id,
                                                         @Valid @RequestBody CadastroDtos.ServicoRequisicao req) {
        return service.atualizarServico(id, req);
    }
}
