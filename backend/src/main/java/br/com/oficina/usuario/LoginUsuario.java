package br.com.oficina.usuario;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Regras do apelido de entrada.
 *
 * Fica fora do servico porque tres lugares precisam do mesmo resultado: o
 * cadastro de funcionario, a criacao do dono no primeiro start e a carga da
 * equipe. Se cada um normalizasse do seu jeito, "José" viraria "josé" num
 * lugar e "jose" no outro, e a pessoa nao conseguiria entrar com o apelido
 * que viu na tela.
 */
public final class LoginUsuario {

    /** O mesmo limite da coluna: o banco recusaria depois, com erro feio. */
    public static final int TAMANHO_MAXIMO = 40;

    private LoginUsuario() {
    }

    /**
     * Minusculas, sem acento e so com o que da para digitar sem pensar.
     *
     * Acento sai de proposito: o teclado do tablet da oficina troca de camada
     * para digitar "ç", e ninguem lembra se cadastrou "gonçalves" ou
     * "goncalves" quando esta com a mao suja.
     */
    public static String normalizar(String bruto) {
        if (bruto == null) {
            return "";
        }
        String semAcento = Normalizer.normalize(bruto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        String limpo = semAcento.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "");
        return limpo.length() > TAMANHO_MAXIMO ? limpo.substring(0, TAMANHO_MAXIMO) : limpo;
    }

    /** O pedaco antes do @, normalizado. Usado quando o apelido veio vazio. */
    public static String derivarDe(String email) {
        if (email == null || email.isBlank()) {
            return "";
        }
        int arroba = email.indexOf('@');
        return normalizar(arroba > 0 ? email.substring(0, arroba) : email);
    }

    /**
     * Resolve o apelido final: o informado, ou o derivado do e-mail.
     * Devolve vazio quando nenhum dos dois produz algo utilizavel -- quem
     * chama decide se isso e erro ou se inventa um valor.
     */
    public static String resolver(String informado, String email) {
        String escolhido = normalizar(informado);
        return escolhido.isEmpty() ? derivarDe(email) : escolhido;
    }
}
