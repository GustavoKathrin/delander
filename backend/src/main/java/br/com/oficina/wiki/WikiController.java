package br.com.oficina.wiki;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/wiki")
@Tag(name = "Wiki da oficina")
public class WikiController {

    private final WikiService service;

    public WikiController(WikiService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Busca por titulo, texto, marca, modelo ou motor")
    public Page<WikiDtos.Resumo> listar(@RequestParam(required = false) String busca,
                                        @RequestParam(defaultValue = "0") int pagina,
                                        @RequestParam(defaultValue = "20") int tamanho) {
        return service.listar(busca, PageRequest.of(pagina, Math.min(tamanho, 100)));
    }

    @GetMapping("/veiculo/{veiculoId}")
    @Operation(summary = "Artigos que servem para aquele carro (casando o ano por faixa)")
    public List<WikiDtos.Resumo> paraOVeiculo(@PathVariable UUID veiculoId) {
        return service.paraOVeiculo(veiculoId);
    }

    @GetMapping("/{id}")
    public WikiDtos.Detalhe detalhe(@PathVariable UUID id) {
        return service.detalhe(id);
    }

    @PostMapping
    @Operation(summary = "Escreve um artigo")
    public WikiDtos.Detalhe criar(@Valid @RequestBody WikiDtos.Requisicao req) {
        return service.criar(req);
    }

    @PutMapping("/{id}")
    public WikiDtos.Detalhe atualizar(@PathVariable UUID id,
                                      @Valid @RequestBody WikiDtos.Requisicao req) {
        return service.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Apaga o artigo e as fotos (somente gerencia)")
    public void remover(@PathVariable UUID id) {
        service.remover(id);
    }

    @PostMapping(path = "/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Envia uma foto; sem artigoId, fica solta ate o artigo ser salvo")
    public WikiDtos.FotoEnviada enviarFoto(@RequestParam("arquivo") MultipartFile arquivo,
                                           @RequestParam(required = false) UUID artigoId) {
        return service.enviarFoto(arquivo, artigoId);
    }

    @GetMapping("/fotos/{fotoId}")
    public ResponseEntity<Resource> foto(@PathVariable UUID fotoId) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(service.tipoDaFoto(fotoId)))
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(service.foto(fotoId));
    }

    @DeleteMapping("/fotos/{fotoId}")
    public void removerFoto(@PathVariable UUID fotoId) {
        service.removerFoto(fotoId);
    }
}
