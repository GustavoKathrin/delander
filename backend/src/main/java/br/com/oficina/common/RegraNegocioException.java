package br.com.oficina.common;

/** Violacao de regra de negocio: vira HTTP 409 com mensagem em portugues. */
public class RegraNegocioException extends RuntimeException {

    public RegraNegocioException(String mensagem) {
        super(mensagem);
    }

    public static RegraNegocioException de(String formato, Object... args) {
        return new RegraNegocioException(formato.formatted(args));
    }
}
