package br.com.oficina.leitura;

import br.com.oficina.common.RegraNegocioException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Tenta ler o relatorio de varios jeitos e fica com o melhor resultado.
 *
 * Nao existe "o formato" do relatorio de scanner: cada fabricante, versao de
 * firmware e idioma do aparelho monta a tabela diferente, e o PDF nao guarda
 * colunas — guarda texto com espacos. Uma regex unica sempre vai acertar um
 * formato e errar outro.
 *
 * O que impede o erro silencioso nao e a quantidade de estrategias, e o
 * criterio: o relatorio NUMERA as proprias linhas, entao da para saber
 * quantas ficaram para tras sem ter nada com que comparar. A primeira
 * estrategia que ler tudo encerra a busca; se nenhuma ler tudo, vence a que
 * perdeu menos, e o que faltou vai escrito na tela de conferencia.
 *
 * Ordem importa: a estrategia alinhada e mais precisa nas colunas (separa
 * minimo, maximo e unidade corretamente); a tolerante le mais linhas e
 * acerta menos as colunas. Comeca pela precisa.
 */
@Component
public class AnalisadorDeRelatorios {

    private static final Logger log = LoggerFactory.getLogger(AnalisadorDeRelatorios.class);

    private final List<EstrategiaDeRelatorio> estrategias;

    public AnalisadorDeRelatorios(AnalisadorRelatorioAutel alinhado,
                                  AnalisadorPorColunas porColunas) {
        this.estrategias = List.of(alinhado, porColunas);
    }

    public RelatorioScanner.Previa analisar(String texto) {
        RelatorioScanner.Previa melhor = null;
        List<String> tentativas = new ArrayList<>();

        for (EstrategiaDeRelatorio estrategia : estrategias) {
            RelatorioScanner.Previa previa;
            try {
                previa = estrategia.analisar(texto);
            } catch (RegraNegocioException e) {
                // "Nao reconheci este formato" e resposta valida de uma
                // estrategia: quem decide se o PDF presta e o conjunto.
                tentativas.add("%s: nao reconheceu o formato".formatted(estrategia.nome()));
                continue;
            }

            RelatorioScanner.Qualidade q = previa.qualidade();
            tentativas.add("%s: %d de %d linhas".formatted(
                    estrategia.nome(), q.lidos(), q.esperados()));

            if (QualidadeDaLeitura.melhorQue(q, melhor == null ? null : melhor.qualidade())) {
                melhor = previa;
            }
            if (q.confiavel()) {
                // Leu tudo: nao ha o que uma estrategia menos precisa possa
                // melhorar, e insistir so trocaria colunas certas por erradas.
                break;
            }
        }

        if (melhor == null) {
            throw new RegraNegocioException(
                    "O PDF foi lido, mas nenhuma linha de dados foi reconhecida. "
                            + "Confira se e o relatorio de 'Dados actuais' do scanner.");
        }

        if (!melhor.qualidade().confiavel()) {
            log.warn("Leitura incompleta: {} — tentativas: {}",
                    melhor.qualidade().faltando().size(), tentativas);
        }
        return melhor;
    }
}
