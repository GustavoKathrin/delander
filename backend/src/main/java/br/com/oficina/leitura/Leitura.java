package br.com.oficina.leitura;

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

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Uma leitura do scanner: os dados dos modulos de um carro num momento.
 *
 * Guarda o veiculo E uma copia solta de marca/modelo/ano/motor. A copia e o
 * que faz a leitura de um Civic 2014 servir de referencia para outro Civic
 * 2014 — e o que o dono chamou de "livro da empresa". O carro pode ate ser
 * recadastrado depois; a leitura continua achavel pelo modelo.
 */
@Entity
@Table(name = "leitura")
@Getter
@Setter
public class Leitura extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "veiculo_id")
    private Veiculo veiculo;

    @Column(name = "marca", length = 60)
    private String marca;

    @Column(name = "modelo", length = 80)
    private String modelo;

    @Column(name = "ano")
    private Integer ano;

    @Column(name = "motor", length = 60)
    private String motor;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 20)
    private TipoLeitura tipo = TipoLeitura.ANOMALIA;

    /** "Carro com problema no frio". Obrigatorio em anomalia completa. */
    @Column(name = "condicao", length = 160)
    private String condicao;

    @Column(name = "descricao")
    private String descricao;

    @Column(name = "motor_ligado", nullable = false)
    private boolean motorLigado = false;

    @Column(name = "ignicao_ligada", nullable = false)
    private boolean ignicaoLigada = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "origem", nullable = false, length = 10)
    private OrigemLeitura origem = OrigemLeitura.MANUAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "situacao", nullable = false, length = 20)
    private SituacaoLeitura situacao = SituacaoLeitura.COMPLETA;

    @Column(name = "ferramenta", length = 120)
    private String ferramenta;

    @Column(name = "ferramenta_versao", length = 40)
    private String ferramentaVersao;

    @Column(name = "numero_relatorio", length = 60)
    private String numeroRelatorio;

    @Column(name = "momento_teste")
    private OffsetDateTime momentoTeste;

    @Column(name = "km")
    private Integer km;

    @Column(name = "ordem_servico_id")
    private UUID ordemServicoId;

    @OneToMany(mappedBy = "leitura", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordem")
    private List<LeituraModulo> modulos = new ArrayList<>();

    public void adicionarModulo(LeituraModulo modulo) {
        modulo.setLeitura(this);
        modulo.setOrdem(modulos.size());
        modulos.add(modulo);
    }

    public boolean oficial() {
        return tipo == TipoLeitura.OFICIAL;
    }

    /** "Honda Civic 2014" — o que o mecanico digita na busca. */
    public String descricaoDoModelo() {
        StringBuilder sb = new StringBuilder();
        if (marca != null) {
            sb.append(marca);
        }
        if (modelo != null) {
            sb.append(sb.isEmpty() ? "" : " ").append(modelo);
        }
        if (ano != null) {
            sb.append(sb.isEmpty() ? "" : " ").append(ano);
        }
        return sb.isEmpty() ? "Veiculo" : sb.toString();
    }

    public int totalDeItens() {
        return modulos.stream().mapToInt(m -> m.getItens().size()).sum();
    }
}
