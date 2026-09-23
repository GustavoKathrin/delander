package br.com.oficina.cadastro;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class CadastroDtos {

    private CadastroDtos() {
    }

    // ------------------------------------------------------- especialidade

    public record EspecialidadeRequisicao(
            @NotBlank(message = "Informe o nome da especialidade") @Size(max = 80) String nome,
            @Size(max = 20) String cor,
            Boolean ativo) {
    }

    public record EspecialidadeResposta(UUID id, String nome, String cor, boolean ativo) {

        public static EspecialidadeResposta de(Especialidade e) {
            return new EspecialidadeResposta(e.getId(), e.getNome(), e.getCor(), e.isAtivo());
        }
    }

    // ------------------------------------------------------- box

    public record BoxRequisicao(
            @NotBlank(message = "Informe o nome do box") @Size(max = 60) String nome,
            TipoBox tipo,
            Boolean ativo) {
    }

    public record BoxResposta(UUID id, String nome, TipoBox tipo, boolean ativo,
                              Integer layoutColuna, Integer layoutLinha,
                              int layoutLargura, int layoutAltura) {

        public static BoxResposta de(Box b) {
            return new BoxResposta(b.getId(), b.getNome(), b.getTipo(), b.isAtivo(),
                    b.getLayoutColuna(), b.getLayoutLinha(),
                    b.getLayoutLargura(), b.getLayoutAltura());
        }
    }

    /** Onde uma vaga fica na planta. Coluna/linha nulas = tirar do layout. */
    public record PosicaoVaga(
            @NotNull(message = "Informe a vaga") UUID boxId,
            @Min(value = 1, message = "A coluna comeca em 1") Integer coluna,
            @Min(value = 1, message = "A linha comeca em 1") Integer linha,
            @Min(value = 1, message = "A largura minima e 1")
            @Max(value = 6, message = "A largura maxima e 6") int largura,
            @Min(value = 1, message = "A altura minima e 1")
            @Max(value = 3, message = "A altura maxima e 3") int altura) {
    }

    public record LayoutRequisicao(@Valid @NotNull List<PosicaoVaga> vagas) {
    }

    // ------------------------------------------------------- motivo de parada

    public record MotivoRequisicao(
            @NotBlank(message = "Informe o nome do motivo") @Size(max = 100) String nome,
            @NotNull(message = "Informe a categoria") CategoriaParada categoria,
            Boolean bloqueiaExecucao,
            Boolean visivelClientePadrao,
            Boolean ativo) {
    }

    public record MotivoResposta(UUID id,
                                 String nome,
                                 CategoriaParada categoria,
                                 String categoriaDescricao,
                                 boolean bloqueiaExecucao,
                                 boolean visivelClientePadrao,
                                 boolean ativo) {

        public static MotivoResposta de(MotivoParada m) {
            return new MotivoResposta(m.getId(), m.getNome(), m.getCategoria(),
                    m.getCategoria().descricao(), m.isBloqueiaExecucao(),
                    m.isVisivelClientePadrao(), m.isAtivo());
        }
    }

    // ------------------------------------------------------- catalogo

    public record ServicoRequisicao(
            @NotBlank(message = "Informe a descricao do servico") @Size(max = 200) String descricao,
            UUID especialidadeId,
            @DecimalMin(value = "0.0", message = "Horas padrao nao pode ser negativa") BigDecimal horasPadrao,
            @DecimalMin(value = "0.0", message = "Preco nao pode ser negativo") BigDecimal precoSugerido,
            /** O servico sobe o carro: quem marca isso alimenta a fila do elevador. */
            Boolean exigeElevador,
            Boolean ativo) {
    }

    public record ServicoResposta(UUID id,
                                  String descricao,
                                  UUID especialidadeId,
                                  String especialidadeNome,
                                  String especialidadeCor,
                                  BigDecimal horasPadrao,
                                  BigDecimal precoSugerido,
                                  boolean exigeElevador,
                                  boolean ativo) {

        public static ServicoResposta de(CatalogoServico c) {
            return new ServicoResposta(
                    c.getId(),
                    c.getDescricao(),
                    c.getEspecialidade() == null ? null : c.getEspecialidade().getId(),
                    c.getEspecialidade() == null ? null : c.getEspecialidade().getNome(),
                    c.getEspecialidade() == null ? null : c.getEspecialidade().getCor(),
                    c.getHorasPadrao(),
                    c.getPrecoSugerido(),
                    c.isExigeElevador(),
                    c.isAtivo());
        }
    }
}
