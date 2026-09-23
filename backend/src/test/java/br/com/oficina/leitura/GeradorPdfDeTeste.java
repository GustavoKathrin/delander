package br.com.oficina.leitura;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Monta um PDF com o texto do relatorio, para exercitar o caminho real
 * Loader -> PDFTextStripper -> analisador sem commitar binario no repositorio.
 *
 * Aviso honesto: um PDF gerado aqui separa colunas por espaco simples, nao
 * pelo alinhamento do Autel. Entao isto prova o caminho e o regex de recuo —
 * nao a geometria das colunas do relatorio de verdade. Essa parte so um PDF
 * real valida.
 */
final class GeradorPdfDeTeste {

    private GeradorPdfDeTeste() {
    }

    static byte[] comTexto(String texto) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream saida = new ByteArrayOutputStream()) {
            PDPage pagina = new PDPage();
            doc.addPage(pagina);

            try (PDPageContentStream fluxo = new PDPageContentStream(doc, pagina)) {
                fluxo.beginText();
                fluxo.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 9);
                fluxo.setLeading(11);
                fluxo.newLineAtOffset(40, 760);
                for (String linha : texto.split("\n")) {
                    // Standard14 nao tem acento em WinAnsi para tudo; o que
                    // importa aqui e a estrutura da tabela.
                    fluxo.showText(semAcento(linha));
                    fluxo.newLine();
                }
                fluxo.endText();
            }
            doc.save(saida);
            return saida.toByteArray();
        }
    }

    private static String semAcento(String texto) {
        return java.text.Normalizer.normalize(texto, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^\\x20-\\x7E]", " ");
    }
}
