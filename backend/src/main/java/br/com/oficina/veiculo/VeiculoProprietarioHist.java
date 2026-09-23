package br.com.oficina.veiculo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Mantem o historico da placa mesmo quando o carro troca de dono. */
@Entity
@Table(name = "veiculo_proprietario_hist")
@Getter
@Setter
public class VeiculoProprietarioHist {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id = UUID.randomUUID();

    @Column(name = "veiculo_id", nullable = false)
    private UUID veiculoId;

    @Column(name = "cliente_id", nullable = false)
    private UUID clienteId;

    @Column(name = "inicio", nullable = false)
    private OffsetDateTime inicio = OffsetDateTime.now();

    @Column(name = "fim")
    private OffsetDateTime fim;
}
