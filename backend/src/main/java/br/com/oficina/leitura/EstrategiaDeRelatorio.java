package br.com.oficina.leitura;

/**
 * Um jeito de ler o relatorio do scanner.
 *
 * Existe mais de um porque nao existe formato: cada fabricante, cada versao
 * de firmware e cada idioma do aparelho monta a tabela de um jeito, e o PDF
 * nao guarda "colunas" — guarda texto com espacos. O que funciona no
 * relatorio de um Autel em portugues quebra no mesmo Autel em espanhol.
 *
 * Em vez de tentar uma regex que sirva para tudo (que e como se perde 38
 * linhas sem ninguem ver), o sistema tenta uma estrategia, mede o quanto
 * leu, e passa para a proxima se sobrou linha para tras.
 */
public interface EstrategiaDeRelatorio {

    /** Aparece na tela de conferencia, para saber qual leitura deu certo. */
    String nome();

    /**
     * @throws br.com.oficina.common.RegraNegocioException quando esta
     *         estrategia nao reconhece o formato — o orquestrador trata
     *         isso como "nao serve" e segue para a proxima.
     */
    RelatorioScanner.Previa analisar(String texto);
}
