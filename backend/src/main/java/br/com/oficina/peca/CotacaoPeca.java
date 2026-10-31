package br.com.oficina.peca;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Um preco que alguem deu para uma peca.
 *
 * Varios por peca de proposito. O dono pediu assim e a razao e pratica: a
 * secretaria liga para tres lugares, e guardar so o escolhido joga fora
 * exatamente a informacao que faz a proxima negociacao -- "na vez passada o
 * Silva cobrou 180 e o Souza 210".
 *
 * O preco fica AQUI, e nao em PecaOs. PecaOs continua tendo valor_unitario e
 * fornecedor porque e dali que o orcamento soma; o que acontece e que marcar
 * uma cotacao como escolhida COPIA os dois para la. Assim nada do que ja
 * existe precisou mudar, e o total do orcamento continua saindo de um lugar
 * so.
 */
@Entity
@Table(name = "cotacao_peca")
@Getter
@Setter
public class CotacaoPeca extends BaseEntity {

    @Column(name = "peca_os_id", nullable = false)
    private UUID pecaOsId;

    /** Null quando foi um lugar avulso, que nao esta no cadastro. */
    @Column(name = "fornecedor_id")
    private UUID fornecedorId;

    /**
     * O nome no instante da cotacao.
     *
     * Guardado mesmo quando ha fornecedor_id: se o cadastro for renomeado ou
     * apagado, a cotacao de seis meses atras ainda precisa dizer de quem era
     * aquele preco.
     */
    @Column(name = "fornecedor_nome", nullable = false, length = 180)
    private String fornecedorNome;

    @Column(name = "valor_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorUnitario;

    /** Quantos dias ele prometeu. Entra na decisao junto com o preco. */
    @Column(name = "prazo_dias")
    private Integer prazoDias;

    @Column(name = "observacao", length = 300)
    private String observacao;

    /** Uma por peca, no maximo. E a que vai para o orcamento. */
    @Column(name = "escolhida", nullable = false)
    private boolean escolhida = false;
}
