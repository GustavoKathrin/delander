package br.com.oficina.ordemservico;

import br.com.oficina.cadastro.Box;
import br.com.oficina.cliente.Cliente;
import br.com.oficina.common.BaseEntity;
import br.com.oficina.veiculo.Veiculo;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ordem_servico")
@Getter
@Setter
public class OrdemServico extends BaseEntity {

    @Column(name = "numero", nullable = false)
    private Long numero;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "veiculo_id", nullable = false)
    private Veiculo veiculo;

    @Column(name = "queixa")
    private String queixa;

    @Column(name = "diagnostico")
    private String diagnostico;

    @Enumerated(EnumType.STRING)
    @Column(name = "prioridade", nullable = false, length = 20)
    private Prioridade prioridade = Prioridade.NORMAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private StatusOs status = StatusOs.RECEBIDO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "box_id")
    private Box box;

    /**
     * O servico sobe o carro. Marcado na hora de agendar (ou herdado de um
     * servico do catalogo com exige_elevador) e e o que poe a OS na fila do
     * elevador — que corre em hora, nao em dia como a vaga.
     */
    @Column(name = "precisa_elevador", nullable = false)
    private boolean precisaElevador = false;

    @Column(name = "data_agendada")
    private LocalDate dataAgendada;

    @Column(name = "previsao_entrega")
    private LocalDate previsaoEntrega;

    @Column(name = "km_entrada")
    private Integer kmEntrada;

    @Column(name = "entrada_em", nullable = false)
    private OffsetDateTime entradaEm = OffsetDateTime.now();

    @Column(name = "aprovado_em")
    private OffsetDateTime aprovadoEm;

    /** Quando o cliente respondeu ao orcamento — aprovando OU recusando. */
    @Column(name = "orcamento_respondido_em")
    private OffsetDateTime orcamentoRespondidoEm;

    /** Quem da oficina registrou a resposta do cliente. */
    @Column(name = "orcamento_respondido_por", length = 120)
    private String orcamentoRespondidoPor;

    /** Por que o cliente recusou. Guardar o "nao" explica a venda perdida. */
    @Column(name = "orcamento_recusa_motivo", length = 300)
    private String orcamentoRecusaMotivo;

    @Column(name = "inicio_execucao_em")
    private OffsetDateTime inicioExecucaoEm;

    @Column(name = "pronto_em")
    private OffsetDateTime prontoEm;

    @Column(name = "entregue_em")
    private OffsetDateTime entregueEm;

    @Column(name = "cancelado_em")
    private OffsetDateTime canceladoEm;

    @Column(name = "motivo_cancelamento", length = 300)
    private String motivoCancelamento;

    @Column(name = "valor_pecas", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorPecas = BigDecimal.ZERO;

    @Column(name = "valor_mao_obra", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorMaoObra = BigDecimal.ZERO;

    @Column(name = "desconto", nullable = false, precision = 12, scale = 2)
    private BigDecimal desconto = BigDecimal.ZERO;

    @OneToMany(mappedBy = "ordemServico", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordem asc")
    private List<OsItem> itens = new ArrayList<>();

    // ------------------------------------------------------------------ calculos

    public BigDecimal valorTotal() {
        return valorPecas.add(valorMaoObra).subtract(desconto).max(BigDecimal.ZERO);
    }

    /** Horas estimadas somadas dos itens ainda nao cancelados. */
    public BigDecimal horasEstimadas() {
        return itens.stream()
                .filter(i -> i.getStatus() != StatusItem.CANCELADO)
                .map(OsItem::getHorasEstimadas)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Permanencia: quanto tempo o carro esta (ou ficou) na oficina.
     * E a metrica que revela o patio entupido.
     */
    public BigDecimal horasPermanencia(OffsetDateTime agora) {
        OffsetDateTime fim = entregueEm != null ? entregueEm : (canceladoEm != null ? canceladoEm : agora);
        long minutos = Duration.between(entradaEm, fim).toMinutes();
        return BigDecimal.valueOf(Math.max(minutos, 0))
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    public long diasPermanencia(OffsetDateTime agora) {
        OffsetDateTime fim = entregueEm != null ? entregueEm : (canceladoEm != null ? canceladoEm : agora);
        return Math.max(Duration.between(entradaEm, fim).toDays(), 0);
    }

    public long diasAguardandoRetirada(OffsetDateTime agora) {
        if (status != StatusOs.PRONTO_AGUARDANDO_RETIRADA || prontoEm == null) {
            return 0;
        }
        return Math.max(Duration.between(prontoEm, agora).toDays(), 0);
    }

    public boolean atrasada(LocalDate hoje) {
        return previsaoEntrega != null
                && status.noPatio()
                && previsaoEntrega.isBefore(hoje);
    }

    public void adicionarItem(OsItem item) {
        item.setOrdemServico(this);
        item.setOficinaId(getOficinaId());
        item.setOrdem(itens.size());
        itens.add(item);
    }
}
