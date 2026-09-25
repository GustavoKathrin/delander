package br.com.oficina.common;

import org.springframework.security.access.AccessDeniedException;

/**
 * Recusa por papel, com o motivo que vai para a tela.
 *
 * Existe para separar duas recusas que nao sao a mesma coisa:
 *
 * - **papel**: "quem compra peca e o atendente". Dizer isso ajuda — a pessoa
 *   entende que nao errou o caminho, e sabe a quem pedir.
 * - **outra oficina**: a recusa fica generica de proposito. Explicar que o
 *   registro e de outra oficina ja confirma que ele existe, e isso e a
 *   resposta que ninguem de fora deveria conseguir arrancar.
 *
 * O handler devolve a mensagem desta excecao ao usuario, e so dela: uma
 * {@link AccessDeniedException} comum pode vir do proprio Spring Security,
 * com texto interno em ingles que nao serve para ninguem ler.
 */
public class PermissaoException extends AccessDeniedException {

    public PermissaoException(String motivo) {
        super(motivo);
    }
}
