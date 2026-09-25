package br.com.oficina;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Teste de ponta a ponta do fluxo que resolve o problema do patio:
 * check-in -> aprovacao -> execucao -> parada com motivo -> conclusao ->
 * entrega (libera a vaga) -> link publico com escopo respeitado.
 *
 * Precisa do Docker rodando (Testcontainers sobe um PostgreSQL real).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestPropertySource(properties = {
        "app.carga-demo=false",
        "app.admin.email=dono.teste@oficina.local",
        "app.admin.senha=teste123456",
        "app.jwt.secret=segredo-de-teste-com-mais-de-trinta-e-dois-caracteres-ok-1234567890"
})
class FluxoOficinaIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String token;

    @Test
    @Order(1)
    @DisplayName("endpoint protegido sem token devolve 401")
    void exigeAutenticacao() throws Exception {
        mvc.perform(MockMvcRequestBuilders.get("/api/quadro")).andExpect(status().isUnauthorized());
    }

    @Test
    @Order(2)
    @DisplayName("fluxo completo: check-in, execucao, parada, conclusao, entrega e link publico")
    void fluxoCompleto() throws Exception {
        String auth = token();

        // ---------- cadastros que vem da migracao ----------
        JsonNode especialidades = buscar("/api/especialidades?apenasAtivas=true", auth);
        assertThat(especialidades).isNotEmpty();
        String especialidadeId = especialidades.get(0).get("id").asText();

        JsonNode boxes = buscar("/api/boxes?apenasAtivos=true", auth);
        assertThat(boxes).isNotEmpty();
        String boxId = boxes.get(0).get("id").asText();

        String motivoPecaId = null;
        for (JsonNode motivo : buscar("/api/motivos-parada?apenasAtivos=true", auth)) {
            if ("PECA".equals(motivo.get("categoria").asText())) {
                motivoPecaId = motivo.get("id").asText();
                break;
            }
        }
        assertThat(motivoPecaId).isNotNull();

        // ---------- funcionario com especialidade ----------
        JsonNode funcionario = enviar("/api/funcionarios", Map.of(
                "nome", "Mecanico de Teste",
                "horasPorDia", 8,
                "ativo", true,
                "especialidadeIds", List.of(especialidadeId)), auth);
        String funcionarioId = funcionario.get("id").asText();

        // ---------- check-in: cliente + veiculo + OS + item de uma vez ----------
        JsonNode os = enviar("/api/os/check-in", Map.of(
                "novoCliente", Map.of("nome", "Ana de Teste", "telefone", "(11) 90000-0000"),
                "novoVeiculo", Map.of("placa", "TST1A23", "marca", "Fiat", "modelo", "Uno", "ano", 2015),
                "queixa", "Barulho na suspensao dianteira",
                "prioridade", "NORMAL",
                "boxId", boxId,
                "itens", List.of(Map.of(
                        "descricao", "Trocar amortecedores",
                        "especialidadeId", especialidadeId,
                        "horasEstimadas", 3,
                        "funcionarioId", funcionarioId))), auth);

        String osId = os.get("resumo").get("id").asText();
        String itemId = os.get("itens").get(0).get("id").asText();
        assertThat(os.get("resumo").get("placa").asText()).isEqualTo("TST1A23");
        assertThat(os.get("resumo").get("horasEstimadas").asDouble()).isEqualTo(3.0);

        // ---------- transicao invalida devolve 409 com mensagem em portugues ----------
        MvcResult invalida = mvc.perform(MockMvcRequestBuilders.post("/api/os/{id}/transicao", osId)
                        .header("Authorization", "Bearer " + auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("status", "ENTREGUE"))))
                .andExpect(status().isConflict())
                .andReturn();
        assertThat(invalida.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("Nao e possivel ir de");

        // ---------- o caminho obrigatorio: diagnostico -> orcamento -> aprovacao ----------
        // Nao existe atalho: quem tenta pular o diagnostico leva 409. E o que
        // impede comecar a mexer no carro sem o cliente ter autorizado o gasto.
        mvc.perform(MockMvcRequestBuilders.post("/api/os/{id}/transicao", osId)
                        .header("Authorization", "Bearer " + auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("status", "EM_EXECUCAO"))))
                .andExpect(status().isConflict());

        enviar("/api/os/%s/transicao".formatted(osId), Map.of("status", "EM_DIAGNOSTICO"), auth);
        enviar("/api/os/%s/transicao".formatted(osId), Map.of("status", "AGUARDANDO_APROVACAO"), auth);
        JsonNode aprovada = enviar("/api/os/%s/transicao".formatted(osId),
                Map.of("status", "ORCAMENTO_APROVADO"), auth);
        assertThat(aprovada.get("aprovadoEm").asText()).isNotBlank();

        // ---------- pecas: o que temos aqui x o que precisa comprar ----------
        // Peca de estoque entra no orcamento e nao vira trabalho de ninguem.
        JsonNode comEstoque = enviar("/api/os/%s/pecas".formatted(osId), Map.of(
                "descricao", "Fluido de freio",
                "quantidade", 1,
                "origem", "ESTOQUE",
                "momentoNecessario", "DURANTE",
                "valorUnitario", 40), auth);
        assertThat(comEstoque.get("origem").asText()).isEqualTo("ESTOQUE");
        // Se temos aqui, ela chegou: sem isto o patio acenderia "esperando peca".
        assertThat(comEstoque.get("status").asText()).isEqualTo("RECEBIDA");

        JsonNode paraComprar = enviar("/api/os/%s/pecas".formatted(osId), Map.of(
                "descricao", "Kit de embreagem",
                "quantidade", 1,
                "origem", "COMPRAR",
                "momentoNecessario", "INICIO",
                "valorUnitario", 420), auth);
        String pecaId = paraComprar.get("id").asText();

        JsonNode fila = corpo(mvc.perform(MockMvcRequestBuilders.get("/api/pecas/pendentes")
                        .header("Authorization", "Bearer " + auth))
                .andExpect(status().isOk()).andReturn());
        assertThat(fila).hasSize(1);
        assertThat(fila.get(0).get("descricao").asText()).isEqualTo("Kit de embreagem");
        assertThat(fila.get(0).get("momentoNecessario").asText()).isEqualTo("INICIO");

        // O defeito de dinheiro: marcar "Comprei" reenvia a peca, e o valor
        // nao pode sumir. Antes, cada clique zerava o preco e encolhia a OS.
        JsonNode antes = corpo(mvc.perform(MockMvcRequestBuilders.get("/api/os/{id}", osId)
                        .header("Authorization", "Bearer " + auth))
                .andExpect(status().isOk()).andReturn());
        double valorPecasAntes = antes.get("valorPecas").asDouble();
        assertThat(valorPecasAntes).isEqualTo(460.0);

        mvc.perform(MockMvcRequestBuilders.put("/api/os/{osId}/pecas/{pecaId}", osId, pecaId)
                        .header("Authorization", "Bearer " + auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "descricao", "Kit de embreagem",
                                "quantidade", 1,
                                "status", "COMPRADA"))))
                .andExpect(status().isOk());

        JsonNode depois = corpo(mvc.perform(MockMvcRequestBuilders.get("/api/os/{id}", osId)
                        .header("Authorization", "Bearer " + auth))
                .andExpect(status().isOk()).andReturn());
        assertThat(depois.get("valorPecas").asDouble()).isEqualTo(valorPecasAntes);

        // ---------- cronometro ----------
        JsonNode iniciado = enviar("/api/apontamentos/iniciar", Map.of(
                "osItemId", itemId, "horasEstimadas", 3), auth);
        String apontamentoId = iniciado.get("apontamentoAbertoId").asText();
        assertThat(apontamentoId).isNotBlank();

        // um item nunca tem dois cronometros abertos
        mvc.perform(MockMvcRequestBuilders.post("/api/apontamentos/iniciar")
                        .header("Authorization", "Bearer " + auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("osItemId", itemId, "horasEstimadas", 1))))
                .andExpect(status().isConflict());

        // ---------- pausar com motivo: a parada vira metrica ----------
        enviar("/api/apontamentos/%s/pausar".formatted(apontamentoId), Map.of(
                "motivoParadaId", motivoPecaId,
                "descricao", "Amortecedor em falta no fornecedor",
                "visivelCliente", true), auth);

        JsonNode comParada = buscar("/api/os/" + osId, auth);
        assertThat(comParada.get("resumo").get("status").asText()).isEqualTo("PAUSADO");
        assertThat(comParada.get("paradas")).hasSize(1);
        assertThat(comParada.get("resumo").get("paradaMotivo").asText()).isNotBlank();

        // ---------- retomar e concluir ----------
        JsonNode retomado = enviar("/api/apontamentos/iniciar", Map.of(
                "osItemId", itemId, "horasEstimadas", 1), auth);
        String segundoApontamento = retomado.get("apontamentoAbertoId").asText();

        enviar("/api/apontamentos/%s/concluir".formatted(segundoApontamento),
                Map.of("observacao", "Amortecedores trocados"), auth);

        JsonNode pronta = buscar("/api/os/" + osId, auth);
        assertThat(pronta.get("resumo").get("status").asText()).isEqualTo("PRONTO_AGUARDANDO_RETIRADA");
        // a parada foi encerrada quando o servico voltou a andar
        assertThat(pronta.get("resumo").hasNonNull("paradaMotivo")).isFalse();
        assertThat(pronta.get("apontamentos")).hasSize(2);

        // ---------- link publico respeita o escopo configurado ----------
        JsonNode link = enviar("/api/os/%s/compartilhamento".formatted(osId), Map.of(), auth);
        String tokenPublico = link.get("token").asText();
        assertThat(link.get("url").asText()).contains("/acompanhar/");

        JsonNode publico = buscar("/api/publico/os/" + tokenPublico, null);
        assertThat(publico.get("placa").asText()).isEqualTo("TST1A23");
        assertThat(publico.get("cliente").asText()).isEqualTo("Ana");
        // valores vem desligados por padrao: o cliente nao ve preco
        assertThat(publico.hasNonNull("valorTotal")).isFalse();
        assertThat(publico.get("progresso").asInt()).isEqualTo(95);

        // token inexistente nao vaza nada
        mvc.perform(MockMvcRequestBuilders.get("/api/publico/os/{token}", "token-que-nao-existe"))
                .andExpect(status().isNotFound());

        // ---------- entrega libera a vaga fisica ----------
        JsonNode entregue = enviar("/api/os/%s/transicao".formatted(osId),
                Map.of("status", "ENTREGUE"), auth);
        assertThat(entregue.get("resumo").get("status").asText()).isEqualTo("ENTREGUE");
        assertThat(entregue.get("resumo").hasNonNull("boxId")).isFalse();

        for (JsonNode noPatio : buscar("/api/os/patio", auth)) {
            assertThat(noPatio.get("id").asText()).isNotEqualTo(osId);
        }
    }

    @Test
    @Order(3)
    @DisplayName("quadro da semana traz capacidade por dia e a sugestao de primeira folga")
    void quadroECapacidade() throws Exception {
        String auth = token();

        JsonNode quadro = buscar("/api/quadro?dias=7", auth);
        assertThat(quadro.get("dias")).hasSize(7);
        assertThat(quadro.get("dias").get(0).get("capacidade").get("semaforo").asText())
                .isIn("verde", "amarelo", "vermelho", "fechado");

        JsonNode sugestoes = buscar("/api/capacidade/sugestao?horas=2&quantidade=3", auth);
        assertThat(sugestoes).isNotEmpty();
        assertThat(sugestoes.get(0).get("data").asText()).isNotBlank();
    }

    @Test
    @Order(4)
    @DisplayName("configuracao desligada bloqueia o recurso: sem compartilhamento global nao ha link")
    void configuracaoDesliga() throws Exception {
        String auth = token();

        JsonNode os = enviar("/api/os/check-in", Map.of(
                "novoCliente", Map.of("nome", "Bruno de Teste"),
                "novoVeiculo", Map.of("placa", "TST9Z99"),
                "queixa", "Revisao preventiva"), auth);
        String osId = os.get("resumo").get("id").asText();

        alterarConfiguracao(auth, "compartilhamento.ativo_global", "false");

        mvc.perform(MockMvcRequestBuilders.post("/api/os/{id}/compartilhamento", osId)
                        .header("Authorization", "Bearer " + auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());

        alterarConfiguracao(auth, "compartilhamento.ativo_global", "true");
    }

    @Test
    @Order(5)
    @DisplayName("painel de metricas responde com os indicadores do patio")
    void painelDeMetricas() throws Exception {
        JsonNode painel = buscar("/api/metricas/painel", token());

        assertThat(painel.get("resumo").get("carrosNoPatio").asInt()).isGreaterThanOrEqualTo(0);
        assertThat(painel.get("resumo").has("aproveitamentoPercentual")).isTrue();
        assertThat(painel.get("throughput")).isNotEmpty();
    }

    // ------------------------------------------------------------------ apoio

    private String token() throws Exception {
        if (token == null) {
            JsonNode resposta = enviar("/api/auth/login",
                    Map.of("email", "dono.teste@oficina.local", "senha", "teste123456"), null);
            token = resposta.get("accessToken").asText();
        }
        return token;
    }

    private void alterarConfiguracao(String auth, String chave, String valor) throws Exception {
        mvc.perform(MockMvcRequestBuilders.put("/api/configuracoes")
                        .header("Authorization", "Bearer " + auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("valores", Map.of(chave, valor)))))
                .andExpect(status().isOk());
    }

    private JsonNode buscar(String caminho, String auth) throws Exception {
        MockHttpServletRequestBuilder requisicao = MockMvcRequestBuilders.get(caminho);
        if (auth != null) {
            requisicao = requisicao.header("Authorization", "Bearer " + auth);
        }
        return corpo(mvc.perform(requisicao).andExpect(status().isOk()).andReturn());
    }

    private JsonNode enviar(String caminho, Object corpo, String auth) throws Exception {
        MockHttpServletRequestBuilder requisicao = MockMvcRequestBuilders.post(caminho)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(corpo));
        if (auth != null) {
            requisicao = requisicao.header("Authorization", "Bearer " + auth);
        }
        return corpo(mvc.perform(requisicao).andExpect(status().isOk()).andReturn());
    }

    private JsonNode corpo(MvcResult resultado) throws Exception {
        return json.readTree(resultado.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
