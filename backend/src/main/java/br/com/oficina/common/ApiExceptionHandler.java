package br.com.oficina.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Todas as respostas de erro seguem RFC 7807 (Problem Details),
 * com mensagem em portugues pronta para exibir na tela.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    public ProblemDetail naoEncontrado(RecursoNaoEncontradoException ex, HttpServletRequest req) {
        return montar(HttpStatus.NOT_FOUND, "Nao encontrado", ex.getMessage(), req);
    }

    @ExceptionHandler(RegraNegocioException.class)
    public ProblemDetail regraNegocio(RegraNegocioException ex, HttpServletRequest req) {
        return montar(HttpStatus.CONFLICT, "Operacao nao permitida", ex.getMessage(), req);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail validacao(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> erros = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(e -> erros.putIfAbsent(e.getField(), e.getDefaultMessage()));
        ex.getBindingResult().getGlobalErrors()
                .forEach(e -> erros.putIfAbsent(e.getObjectName(), e.getDefaultMessage()));

        ProblemDetail pd = montar(HttpStatus.BAD_REQUEST, "Dados invalidos",
                "Confira os campos destacados.", req);
        pd.setProperty("erros", erros);
        return pd;
    }

    @ExceptionHandler({MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class})
    public ProblemDetail requisicaoInvalida(Exception ex, HttpServletRequest req) {
        return montar(HttpStatus.BAD_REQUEST, "Requisicao invalida",
                "Nao foi possivel interpretar os dados enviados.", req);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ProblemDetail credenciaisInvalidas(BadCredentialsException ex, HttpServletRequest req) {
        return montar(HttpStatus.UNAUTHORIZED, "Credenciais invalidas",
                "E-mail ou senha incorretos.", req);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail acessoNegado(AccessDeniedException ex, HttpServletRequest req) {
        return montar(HttpStatus.FORBIDDEN, "Acesso negado",
                "Seu perfil nao tem permissao para esta acao.", req);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail integridade(DataIntegrityViolationException ex, HttpServletRequest req) {
        String detalhe = traduzirIntegridade(ex);
        log.warn("Violacao de integridade em {}: {}", req.getRequestURI(), ex.getMostSpecificCause().getMessage());
        return montar(HttpStatus.CONFLICT, "Conflito de dados", detalhe, req);
    }

    /**
     * Sem isto, arrastar um arquivo grande cai no handler generico e volta 500
     * — um erro do servidor para algo que e so um arquivo acima do limite.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ProblemDetail arquivoGrande(MaxUploadSizeExceededException ex, HttpServletRequest req) {
        return montar(HttpStatus.CONFLICT, "Operacao nao permitida",
                "Arquivo muito grande. O limite e 8 MB.", req);
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail erroInterno(Exception ex, HttpServletRequest req) {
        log.error("Erro inesperado em {}", req.getRequestURI(), ex);
        return montar(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno",
                "Algo deu errado no servidor. Tente novamente.", req);
    }

    private String traduzirIntegridade(DataIntegrityViolationException ex) {
        String causa = ex.getMostSpecificCause().getMessage();
        if (causa == null) {
            return "Registro duplicado ou em uso.";
        }
        String c = causa.toLowerCase();
        if (c.contains("uk_leitura_oficial")) {
            return "Este veiculo ja tem uma leitura oficial. Recarregue a tela.";
        }
        if (c.contains("uk_leitura_relatorio")) {
            return "Este relatorio do scanner ja foi importado.";
        }
        if (c.contains("uk_elevador_em_uso")) {
            return "Este elevador ja esta com um carro. Desca antes de subir outro.";
        }
        if (c.contains("uk_veiculo_placa")) {
            return "Ja existe um veiculo cadastrado com esta placa.";
        }
        if (c.contains("uk_usuario_email")) {
            return "Ja existe um usuario com este e-mail.";
        }
        if (c.contains("uk_especialidade_nome")) {
            return "Ja existe uma especialidade com este nome.";
        }
        if (c.contains("uk_box_nome")) {
            return "Ja existe um box com este nome.";
        }
        if (c.contains("uk_motivo_parada_nome")) {
            return "Ja existe um motivo de parada com este nome.";
        }
        if (c.contains("uk_catalogo_descricao")) {
            return "Ja existe um servico com esta descricao no catalogo.";
        }
        if (c.contains("uk_apontamento_aberto_item")) {
            return "Este servico ja tem um apontamento em andamento.";
        }
        if (c.contains("uk_parada_aberta")) {
            return "Esta OS ja tem uma parada em aberto.";
        }
        if (c.contains("foreign key") || c.contains("violates foreign key")) {
            return "Este registro esta em uso e nao pode ser removido.";
        }
        return "Registro duplicado ou em uso.";
    }

    private ProblemDetail montar(HttpStatus status, String titulo, String detalhe, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detalhe);
        pd.setTitle(titulo);
        pd.setType(URI.create("https://oficina.flow/erros/" + status.value()));
        pd.setProperty("momento", OffsetDateTime.now().toString());
        pd.setProperty("caminho", req.getRequestURI());
        return pd;
    }
}
