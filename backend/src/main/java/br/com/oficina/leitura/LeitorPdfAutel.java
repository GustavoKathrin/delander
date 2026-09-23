package br.com.oficina.leitura;

import br.com.oficina.common.RegraNegocioException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * PDF -> texto. So isso.
 *
 * Fica separado do analisador de proposito: assim a parte dificil (texto ->
 * dado) e testavel sem nenhum arquivo binario no repositorio.
 */
@Component
public class LeitorPdfAutel {

    private static final int MAXIMO_DE_PAGINAS = 40;

    public String extrairTexto(byte[] conteudo) {
        if (conteudo == null || conteudo.length == 0) {
            throw new RegraNegocioException("O arquivo esta vazio.");
        }
        try (PDDocument documento = Loader.loadPDF(conteudo)) {
            if (documento.isEncrypted()) {
                throw new RegraNegocioException(
                        "O PDF esta protegido por senha. Exporte o relatorio sem protecao.");
            }
            if (documento.getNumberOfPages() > MAXIMO_DE_PAGINAS) {
                throw new RegraNegocioException(
                        "O PDF tem %d paginas; o limite e %d. Exporte so o relatorio de dados."
                                .formatted(documento.getNumberOfPages(), MAXIMO_DE_PAGINAS));
            }

            PDFTextStripper extrator = new PDFTextStripper();
            // Sem isto as colunas da tabela vem embaralhadas.
            extrator.setSortByPosition(true);
            return extrator.getText(documento);

        } catch (RegraNegocioException e) {
            throw e;
        } catch (IOException e) {
            throw new RegraNegocioException(
                    "Nao foi possivel abrir o PDF. Confira se o arquivo nao esta corrompido.");
        } catch (RuntimeException e) {
            // PDFBox lanca varias coisas em arquivo malformado; nada disso pode
            // virar 500 na cara de quem so arrastou um arquivo para a tela.
            throw new RegraNegocioException("Nao foi possivel ler este PDF.");
        }
    }
}
