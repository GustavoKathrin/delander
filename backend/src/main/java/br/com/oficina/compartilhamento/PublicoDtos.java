package br.com.oficina.compartilhamento;

import br.com.oficina.ordemservico.StatusOs;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * O que o dono do carro ve na pagina publica.
 * Nenhum campo aqui existe sem passar pelo escopo configurado pelo dono da oficina.
 */
public final class PublicoDtos {

    private PublicoDtos() {
    }

    public record ItemPublico(String descricao, String status, boolean concluido, String mecanico) {
    }

    public record ParadaPublica(String motivo, OffsetDateTime desde, BigDecimal horas) {
    }

    /**
     * Uma foto no link do cliente, com o momento em que foi tirada.
     *
     * O momento importa: foto de ENTRADA e o checklist — como o carro
     * chegou — e serve de prova para os dois lados. Misturada com as fotos
     * do servico, ela vira so mais uma imagem e perde essa funcao.
     */
    public record FotoPublica(String url, String momento) {
    }

    public record EventoPublico(String tipo, String descricao, OffsetDateTime quando) {
    }

    public record Acompanhamento(String oficina,
                                 long numeroOs,
                                 String placa,
                                 String veiculo,
                                 String cliente,
                                 StatusOs status,
                                 String statusDescricao,
                                 String mensagem,
                                 int progresso,
                                 LocalDate previsaoEntrega,
                                 BigDecimal horasTrabalhadas,
                                 BigDecimal valorTotal,
                                 List<ItemPublico> itens,
                                 ParadaPublica parada,
                                 List<EventoPublico> timeline,
                                 List<FotoPublica> fotos,
                                 OffsetDateTime entradaEm,
                                 OffsetDateTime prontoEm) {
    }
}
