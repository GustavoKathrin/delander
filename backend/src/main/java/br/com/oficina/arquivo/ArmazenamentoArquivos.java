package br.com.oficina.arquivo;

import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.config.AppProperties;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Guarda arquivo no disco com as regras que valem para todo upload do sistema.
 *
 * Extraido de ArquivoService quando as leituras do scanner passaram a precisar
 * do mesmo cuidado: o tipo vem dos BYTES iniciais e nao da extensao, o nome e
 * gerado pelo servidor, e a leitura confere que o caminho nao escapou da raiz
 * de uploads. A API publica do ArquivoService nao mudou.
 */
@Component
public class ArmazenamentoArquivos {

    private static final long TAMANHO_MAXIMO = 8L * 1024 * 1024;

    private static final Map<String, String> ASSINATURAS = Map.of(
            "ffd8ff", "image/jpeg",
            "89504e47", "image/png",
            "52494646", "image/webp",
            "25504446", "application/pdf");

    private final AppProperties props;

    public ArmazenamentoArquivos(AppProperties props) {
        this.props = props;
    }

    public record Guardado(String caminhoRelativo, String nomeOriginal,
                           String contentType, long tamanho) {
    }

    public Guardado guardar(MultipartFile arquivo, String subpasta) {
        return guardar(arquivo, subpasta, false);
    }

    /** Recusa qualquer coisa que nao seja PDF, conferindo pelos bytes. */
    public Guardado guardarPdf(MultipartFile arquivo, String subpasta) {
        return guardar(arquivo, subpasta, true);
    }

    /**
     * O mesmo, para quem nao tem MultipartFile: anexo de e-mail.
     *
     * As regras sao as mesmas de um upload pela tela — limite de tamanho,
     * tipo pelos bytes, nome gerado pelo servidor. Um caminho de entrada
     * mais frouxo que o outro seria so uma porta dos fundos.
     */
    public Guardado guardarPdf(byte[] conteudo, String nomeOriginal, String subpasta) {
        if (conteudo == null || conteudo.length == 0) {
            throw new RegraNegocioException("Anexo vazio.");
        }
        if (conteudo.length > TAMANHO_MAXIMO) {
            throw new RegraNegocioException("Arquivo muito grande. O limite e 8 MB.");
        }
        if (!"application/pdf".equals(tipoPorAssinatura(conteudo))) {
            throw new RegraNegocioException("O anexo nao e um PDF.");
        }

        try {
            Path diretorio = Paths.get(props.uploadsDir(), subpasta);
            Files.createDirectories(diretorio);

            String nomeGerado = UUID.randomUUID() + ".pdf";
            Files.write(diretorio.resolve(nomeGerado), conteudo);

            return new Guardado(subpasta + "/" + nomeGerado,
                    sanitizar(nomeOriginal), "application/pdf", conteudo.length);
        } catch (IOException e) {
            throw new RegraNegocioException("Nao foi possivel salvar o arquivo. Tente novamente.");
        }
    }

    private Guardado guardar(MultipartFile arquivo, String subpasta, boolean somentePdf) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new RegraNegocioException("Selecione um arquivo.");
        }
        if (arquivo.getSize() > TAMANHO_MAXIMO) {
            throw new RegraNegocioException("Arquivo muito grande. O limite e 8 MB.");
        }

        String tipo = detectarTipo(arquivo);
        if (somentePdf && !"application/pdf".equals(tipo)) {
            throw new RegraNegocioException("Envie o relatorio em PDF.");
        }

        String extensao = switch (tipo) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".pdf";
        };

        try {
            Path diretorio = Paths.get(props.uploadsDir(), subpasta);
            Files.createDirectories(diretorio);

            String nomeGerado = UUID.randomUUID() + extensao;
            arquivo.transferTo(diretorio.resolve(nomeGerado).toFile());

            return new Guardado(subpasta + "/" + nomeGerado,
                    sanitizar(arquivo.getOriginalFilename()), tipo, arquivo.getSize());
        } catch (IOException e) {
            throw new RegraNegocioException("Nao foi possivel salvar o arquivo. Tente novamente.");
        }
    }

    public Resource conteudo(String caminhoRelativo) {
        try {
            Path raiz = Paths.get(props.uploadsDir()).normalize().toAbsolutePath();
            Path caminho = raiz.resolve(caminhoRelativo).normalize();
            if (!caminho.startsWith(raiz)) {
                throw new RegraNegocioException("Caminho de arquivo invalido.");
            }
            Resource recurso = new UrlResource(caminho.toUri());
            if (!recurso.exists() || !recurso.isReadable()) {
                throw new RegraNegocioException("Arquivo nao encontrado.");
            }
            return recurso;
        } catch (IOException e) {
            throw new RegraNegocioException("Arquivo nao encontrado.");
        }
    }

    public void apagar(String caminhoRelativo) {
        try {
            Path raiz = Paths.get(props.uploadsDir()).normalize().toAbsolutePath();
            Path caminho = raiz.resolve(caminhoRelativo).normalize();
            if (caminho.startsWith(raiz)) {
                Files.deleteIfExists(caminho);
            }
        } catch (IOException e) {
            // Arquivo orfao no disco nao justifica derrubar a operacao.
        }
    }

    public String detectarTipo(MultipartFile arquivo) {
        try {
            byte[] inicio = new byte[8];
            int lidos = arquivo.getInputStream().read(inicio);
            if (lidos < 4) {
                throw new RegraNegocioException("Arquivo invalido.");
            }
            String tipo = tipoPorAssinatura(inicio);
            if (tipo == null) {
                throw new RegraNegocioException("Formato nao aceito. Envie JPG, PNG, WEBP ou PDF.");
            }
            return tipo;
        } catch (IOException e) {
            throw new RegraNegocioException("Nao foi possivel ler o arquivo.");
        }
    }

    /** O tipo real, pelos primeiros bytes. Null quando nao reconhece. */
    private String tipoPorAssinatura(byte[] conteudo) {
        if (conteudo.length < 4) {
            return null;
        }
        String hex = HexFormat.of()
                .formatHex(conteudo, 0, Math.min(8, conteudo.length))
                .toLowerCase();
        for (Map.Entry<String, String> assinatura : ASSINATURAS.entrySet()) {
            if (hex.startsWith(assinatura.getKey())) {
                return assinatura.getValue();
            }
        }
        return null;
    }

    public String sanitizar(String nome) {
        if (nome == null || nome.isBlank()) {
            return "arquivo";
        }
        String limpo = nome.replaceAll("[^a-zA-Z0-9._ -]", "_");
        return limpo.length() > 200 ? limpo.substring(0, 200) : limpo;
    }
}
