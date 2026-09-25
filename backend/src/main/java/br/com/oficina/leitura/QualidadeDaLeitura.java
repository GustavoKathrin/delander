package br.com.oficina.leitura;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/**
 * Mede o quanto de um relatorio foi realmente lido.
 *
 * O truque e que o proprio relatorio se denuncia: as linhas da tabela vem
 * numeradas. Se o maior numero lido e 133 e existem 95 itens, 38 linhas
 * ficaram para tras — e da para afirmar isso sem ter o PDF na mao.
 *
 * Isto existe porque a falha anterior foi silenciosa: o sistema guardou 95
 * de 133 itens, mostrou "95 itens" com ar de sucesso, e o furo so apareceu
 * quando alguem foi procurar um sensor que nao estava la. Leitura incompleta
 * que se parece com leitura completa estraga o acervo inteiro, porque a
 * comparacao com a leitura oficial passa a mentir.
 */
final class QualidadeDaLeitura {

    private QualidadeDaLeitura() {
    }

    static RelatorioScanner.Qualidade medir(List<RelatorioScanner.Modulo> modulos, String estrategia) {
        TreeSet<Integer> numeros = new TreeSet<>();
        int lidos = 0;

        for (RelatorioScanner.Modulo modulo : modulos) {
            for (RelatorioScanner.Item item : modulo.itens()) {
                lidos++;
                if (item.numero() != null) {
                    numeros.add(item.numero());
                }
            }
        }

        if (numeros.isEmpty()) {
            return new RelatorioScanner.Qualidade(lidos, lidos, List.of(), estrategia);
        }

        int maior = numeros.last();
        List<Integer> faltando = new ArrayList<>();
        for (int n = 1; n <= maior; n++) {
            if (!numeros.contains(n)) {
                faltando.add(n);
            }
        }
        return new RelatorioScanner.Qualidade(lidos, maior, faltando, estrategia);
    }

    /**
     * Qual das duas leituras ficou melhor.
     *
     * Criterio: quem deixou menos linha para tras. Empate desempata por
     * quantidade de itens — entre duas leituras igualmente completas,
     * a que trouxe mais informacao ganha.
     */
    static boolean melhorQue(RelatorioScanner.Qualidade candidata, RelatorioScanner.Qualidade atual) {
        if (atual == null) {
            return true;
        }
        int faltaCandidata = candidata.faltando().size();
        int faltaAtual = atual.faltando().size();
        if (faltaCandidata != faltaAtual) {
            return faltaCandidata < faltaAtual;
        }
        return candidata.lidos() > atual.lidos();
    }
}
