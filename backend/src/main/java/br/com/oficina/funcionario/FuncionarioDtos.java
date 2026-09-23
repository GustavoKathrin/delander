package br.com.oficina.funcionario;

import br.com.oficina.cadastro.CadastroDtos;
import br.com.oficina.usuario.Papel;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class FuncionarioDtos {

    private FuncionarioDtos() {
    }

    /** Acesso ao sistema (opcional: funcionario pode existir sem login). */
    public record AcessoRequisicao(
            @Email(message = "E-mail invalido") @Size(max = 180) String email,
            @Size(max = 72) String senha,
            Papel papel) {
    }

    public record Requisicao(
            @NotBlank(message = "Informe o nome") @Size(max = 160) String nome,
            @Size(max = 30) String telefone,
            @DecimalMin(value = "0.5", message = "A jornada precisa ser de ao menos 0,5 hora")
            BigDecimal horasPorDia,
            @DecimalMin(value = "0.0", message = "Custo/hora nao pode ser negativo") BigDecimal custoHora,
            Boolean ativo,
            List<UUID> especialidadeIds,
            AcessoRequisicao acesso) {
    }

    public record Resposta(UUID id,
                           String nome,
                           String telefone,
                           BigDecimal horasPorDia,
                           BigDecimal custoHora,
                           boolean ativo,
                           UUID usuarioId,
                           String email,
                           Papel papel,
                           String papelDescricao,
                           List<CadastroDtos.EspecialidadeResposta> especialidades) {
    }
}
