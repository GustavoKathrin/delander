package br.com.oficina.common;

/** Recurso inexistente: vira HTTP 404. */
public class RecursoNaoEncontradoException extends RuntimeException {

    public RecursoNaoEncontradoException(String mensagem) {
        super(mensagem);
    }

    public static RecursoNaoEncontradoException de(String recurso, Object id) {
        return new RecursoNaoEncontradoException("%s nao encontrado(a): %s".formatted(recurso, id));
    }
}
