package br.com.oficina.leitura;

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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/leituras")
@Tag(name = "Leituras do scanner")
public class LeituraController {

    private final LeituraService service;

    public LeituraController(LeituraService service) {
        this.service = service;
    }

    @PostMapping(path = "/importar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Le o PDF do scanner e devolve um rascunho para conferir. Nao grava a leitura.")
    public LeituraDtos.Previa importar(@RequestParam("arquivo") MultipartFile arquivo) {
        return service.importar(arquivo);
    }

    @PostMapping
    @Operation(summary = "Grava a leitura conferida (ou anexa modulos a uma existente)")
    public LeituraDtos.Detalhe criar(@Valid @RequestBody LeituraDtos.Requisicao req) {
        return service.criar(req);
    }

    @GetMapping
    @Operation(summary = "Busca por placa, marca, modelo, motor ou ano")
    public Page<LeituraDtos.Resumo> listar(@RequestParam(required = false) String busca,
                                           @RequestParam(required = false) TipoLeitura tipo,
                                           @RequestParam(defaultValue = "0") int pagina,
                                           @RequestParam(defaultValue = "20") int tamanho) {
        return service.listar(busca, tipo, PageRequest.of(pagina, Math.min(tamanho, 100)));
    }

    @GetMapping("/veiculo/{veiculoId}")
    @Operation(summary = "Leituras daquele carro: a oficial primeiro, anomalias depois")
    public List<LeituraDtos.Resumo> doVeiculo(@PathVariable UUID veiculoId) {
        return service.doVeiculo(veiculoId);
    }

    @GetMapping("/{id}")
    @Operation(summary = "A leitura com os modulos e a tabela de itens")
    public LeituraDtos.Detalhe detalhe(@PathVariable UUID id) {
        return service.detalhe(id);
    }

    @PostMapping("/{id}/completar")
    @Operation(summary = "Completa uma leitura que entrou por e-mail: carro, motor e tipo")
    public LeituraDtos.Detalhe completar(@PathVariable UUID id,
                                         @Valid @RequestBody LeituraDtos.Requisicao req) {
        return service.completar(id, req);
    }

    @PostMapping("/{id}/oficializar")
    @Operation(summary = "Marca como a leitura boa do carro; rebaixa a anterior")
    public LeituraDtos.Detalhe oficializar(@PathVariable UUID id) {
        return service.oficializar(id);
    }

    @GetMapping("/{id}/arquivo")
    @Operation(summary = "Baixa o PDF original do relatorio")
    public ResponseEntity<Resource> arquivo(@PathVariable UUID id) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"relatorio.pdf\"")
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(service.pdf(id));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Apaga a leitura (somente gerencia)")
    public void remover(@PathVariable UUID id) {
        service.remover(id);
    }
}
