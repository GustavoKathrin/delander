package br.com.oficina.arquivo;

import br.com.oficina.ordemservico.OsDtos;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/os/{osId}/arquivos")
@Tag(name = "Fotos e documentos da OS")
public class ArquivoController {

    private final ArquivoService service;

    public ArquivoController(ArquivoService service) {
        this.service = service;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Anexa foto ou documento (JPG, PNG, WEBP ou PDF, ate 8 MB)")
    public OsDtos.ArquivoResposta enviar(@PathVariable UUID osId,
                                         @RequestParam("arquivo") MultipartFile arquivo,
                                         @RequestParam(defaultValue = "EXECUCAO") String momento,
                                         @RequestParam(defaultValue = "false") boolean visivelCliente) {
        ArquivoOs salvo = service.salvar(osId, arquivo, momento, visivelCliente);
        return new OsDtos.ArquivoResposta(
                salvo.getId(),
                salvo.getNomeOriginal(),
                "/api/os/%s/arquivos/%s".formatted(osId, salvo.getId()),
                salvo.getMomento(),
                salvo.isVisivelCliente(),
                salvo.getCriadoEm());
    }

    @GetMapping("/{arquivoId}")
    @Operation(summary = "Baixa o arquivo")
    public ResponseEntity<Resource> baixar(@PathVariable UUID osId, @PathVariable UUID arquivoId) {
        ArquivoOs arquivo = service.metadados(osId, arquivoId);
        Resource recurso = service.conteudo(arquivo);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        arquivo.getContentType() == null ? "application/octet-stream" : arquivo.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"%s\"".formatted(arquivo.getNomeOriginal()))
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(recurso);
    }
}
