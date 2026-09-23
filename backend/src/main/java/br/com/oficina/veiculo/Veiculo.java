package br.com.oficina.veiculo;

import br.com.oficina.cliente.Cliente;
import br.com.oficina.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "veiculo")
@Getter
@Setter
public class Veiculo extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(name = "placa", nullable = false, length = 10)
    private String placa;

    @Column(name = "marca", length = 60)
    private String marca;

    @Column(name = "modelo", length = 80)
    private String modelo;

    @Column(name = "ano")
    private Integer ano;

    @Column(name = "cor", length = 40)
    private String cor;

    /** "2.0 flex", "1.4 TSI". Junto com o modelo, e o que a oficina procura. */
    @Column(name = "motor", length = 60)
    private String motor;

    @Column(name = "km")
    private Integer km;

    @Column(name = "chassi", length = 40)
    private String chassi;

    @Column(name = "observacoes")
    private String observacoes;

    @Column(name = "ativo", nullable = false)
    private boolean ativo = true;

    public String descricaoCurta() {
        StringBuilder sb = new StringBuilder();
        if (marca != null) {
            sb.append(marca).append(' ');
        }
        if (modelo != null) {
            sb.append(modelo);
        }
        if (ano != null) {
            sb.append(' ').append(ano);
        }
        String texto = sb.toString().trim();
        return texto.isEmpty() ? placa : texto;
    }

    public static String normalizarPlaca(String placa) {
        return placa == null ? null : placa.toUpperCase().replaceAll("[^A-Z0-9]", "");
    }
}
