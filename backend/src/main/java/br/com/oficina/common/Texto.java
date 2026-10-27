package br.com.oficina.common;

/**
 * Plural de verdade nas frases que vao para a tela.
 *
 * "Sem nenhum apontamento ha 1 dia(s)" e software falando com parenteses. O
 * numero esta sempre ali, na linha de cima, na hora de montar a frase -- nao
 * ha razao para a tela nao concordar. Sozinho nao atrapalha ninguem;
 * repetido em todo alerta do patio, do quadro e do radar, e exatamente o que
 * faz um sistema parecer generico e inacabado.
 */
public final class Texto {

    private Texto() {
    }

    /** {@code plural(1, "dia")} -> "1 dia"; {@code plural(3, "dia")} -> "3 dias". */
    public static String plural(long quantidade, String singular) {
        return plural(quantidade, singular, singular + "s");
    }

    /** Para quando o plural nao e so acrescentar "s": item/itens, ressalva/ressalvas. */
    public static String plural(long quantidade, String singular, String plural) {
        return quantidade == 1 ? "1 " + singular : quantidade + " " + plural;
    }
}
