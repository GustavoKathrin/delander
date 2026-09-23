package br.com.oficina.configuracao;

import java.util.Map;
import java.util.UUID;

/**
 * Publicado dentro da transacao de ConfiguracaoService.atualizar.
 *
 * Existe para quebrar dependencia circular: quem reage a uma configuracao
 * (ElevadorService, por exemplo) ja depende do ConfiguracaoService, entao o
 * servico nao pode chamar esses ouvintes de volta. Ouvir com
 * {@code @TransactionalEventListener(phase = BEFORE_COMMIT)} tambem garante
 * que, se o ouvinte recusar a mudanca, o valor nao fica salvo — parametro e
 * efeito colateral voltam juntos.
 *
 * O evento carrega os VALORES, e nao so as chaves, de proposito: o ouvinte
 * roda antes do commit, entao ler pelo ConfiguracaoService encheria o cache
 * com um valor que ainda pode ser desfeito.
 */
public record ConfiguracaoAlteradaEvent(UUID oficinaId, Map<String, String> valores) {

    public boolean tocou(String chave) {
        return valores.containsKey(chave);
    }

    public int inteiro(String chave, int padrao) {
        try {
            String v = valores.get(chave);
            return v == null || v.isBlank() ? padrao : Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return padrao;
        }
    }
}
