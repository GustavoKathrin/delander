package br.com.oficina.cadastro;

import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * De quem a oficina compra peca.
 *
 * Existe por causa da cotacao: a secretaria liga para tres lugares, anota o
 * preco de cada um e escolhe. Sem cadastro, o nome do fornecedor era digitado
 * de novo a cada peca -- e "Auto Pecas Silva", "autopecas silva" e "Silva"
 * viravam tres fornecedores diferentes na hora de comparar o historico.
 *
 * Quase tudo e opcional de proposito. O que a oficina tem na mao no comeco e
 * um nome e um telefone; obrigar CNPJ e endereco so faria o cadastro ficar
 * vazio e a secretaria continuar anotando no papel.
 */
@Entity
@Table(name = "fornecedor")
@Getter
@Setter
public class Fornecedor extends BaseEntity {

    @Column(name = "nome", nullable = false, length = 180)
    private String nome;

    /** O que esse fornecedor costuma vender -- texto livre, serve de lembrete. */
    @Column(name = "especialidade", length = 200)
    private String especialidade;

    @Column(name = "telefone", length = 40)
    private String telefone;

    /** So digitos, para virar link de WhatsApp sem adivinhacao na hora. */
    @Column(name = "whatsapp", length = 40)
    private String whatsapp;

    @Column(name = "email", length = 180)
    private String email;

    @Column(name = "cnpj", length = 20)
    private String cnpj;

    @Column(name = "cidade", length = 120)
    private String cidade;

    /**
     * Quantos dias ele costuma levar para entregar.
     *
     * Nao e promessa: e a media do que ja aconteceu, digitada por quem liga.
     * Serve para a cotacao mostrar "este e R$ 20 mais barato e chega tres
     * dias depois" -- que e a decisao de verdade, e nao o preco sozinho.
     */
    @Column(name = "prazo_dias_tipico")
    private Integer prazoDiasTipico;

    @Column(name = "observacao", length = 500)
    private String observacao;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;
}
