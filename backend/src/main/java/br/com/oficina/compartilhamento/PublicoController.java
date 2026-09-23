package br.com.oficina.compartilhamento;

import br.com.oficina.arquivo.ArquivoOs;
import br.com.oficina.arquivo.ArquivoService;
import br.com.oficina.common.RecursoNaoEncontradoException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Pagina publica de acompanhamento: sem login, somente leitura,
 * com escopo definido pelo dono da oficina e limite de requisicoes por IP.
 */
@RestController
@RequestMapping("/api/publico")
@Tag(name = "Acompanhamento publico")
public class PublicoController {

    private final CompartilhamentoService service;
    private final ArquivoService arquivoService;

    public PublicoController(CompartilhamentoService service, ArquivoService arquivoService) {
        this.service = service;
        this.arquivoService = arquivoService;
    }

    @GetMapping("/os/{token}")
    @Operation(summary = "Situacao do veiculo para o cliente")
    public PublicoDtos.Acompanhamento acompanhar(@PathVariable String token,
                                                 @RequestParam(required = false) String pin,
                                                 HttpServletRequest request) {
        return service.acompanhar(token, pin, ipDe(request), request.getHeader("User-Agent"));
    }

    @GetMapping("/os/{token}/fotos/{arquivoId}")
    @Operation(summary = "Foto liberada para o cliente")
    public ResponseEntity<Resource> foto(@PathVariable String token, @PathVariable UUID arquivoId) {
        CompartilhamentoOs link = service.porToken(token)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Link invalido ou expirado."));

        ArquivoOs arquivo = arquivoService.metadadosPublicos(link.getOrdemServicoId(), arquivoId);
        Resource recurso = arquivoService.conteudo(arquivo);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        arquivo.getContentType() == null ? "application/octet-stream" : arquivo.getContentType()))
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=600")
                .body(recurso);
    }

    private String ipDe(HttpServletRequest request) {
        String encaminhado = request.getHeader("X-Forwarded-For");
        if (encaminhado != null && !encaminhado.isBlank()) {
            return encaminhado.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
