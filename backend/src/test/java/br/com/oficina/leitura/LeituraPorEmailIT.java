package br.com.oficina.leitura;

import br.com.oficina.arquivo.ArmazenamentoArquivos;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.demo.CargaInicial;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * O caminho que entra sozinho: anexo de e-mail -> leitura PENDENTE.
 *
 * Existe porque este e o unico caminho de gravacao que ninguem confere na
 * tela. O IMAP em si nao esta aqui — nao vale subir um servidor de e-mail
 * para provar o que o jakarta.mail ja faz. O que este teste cobre e o que e
 * nosso: no que a leitura se transforma quando nasce sem usuario nenhum.
 */
@SpringBootTest
@Testcontainers
@TestPropertySource(properties = {
        "app.carga-demo=false",
        "app.admin.email=dono.email@oficina.local",
        "app.admin.senha=teste123456",
        "app.jwt.secret=segredo-de-teste-com-mais-de-trinta-e-dois-caracteres-ok-1234567890",
        // O teste grava PDF de verdade no disco; fora do diretorio de dados.
        "app.uploads-dir=target/test-uploads"
})
class LeituraPorEmailIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final String RELATORIO = """
            2014/Honda/Civic
            Quilometragem: 175811 km
            Ferramenta: MaxiDAS DS900-BT
            Numero do relatorio: EMAIL20260923120000
            Tempo de teste: 2026-09-23 12:00:00
            Caminho: Selecao automatica > GERAL > Unidade de controlo > PGM-FI > Dados actuais >
            Dados actuais
            NO. Nome Valor MIN MAX Unidade
            1 Rotacao do motor 728 0 9973 RPM
            6 SENSOR MAP 24 1 255 kPa
            """;

    @Autowired
    private LeituraService service;

    @Autowired
    private LeituraRepository repository;

    @Autowired
    private LeitorPdfAutel leitor;

    @Autowired
    private AnalisadorRelatorioAutel analisador;

    @Autowired
    private ArmazenamentoArquivos armazenamento;

    @Autowired
    private TransactionTemplate transacao;

    @Test
    @DisplayName("anexo vira leitura pendente, sem carro, e o mesmo relatorio nao entra duas vezes")
    void anexoViraPendente() throws Exception {
        byte[] pdf = GeradorPdfDeTeste.comTexto(RELATORIO);
        RelatorioScanner.Previa previa = analisador.analisar(leitor.extrairTexto(pdf));

        UUID id = service.registrarPendente(
                CargaInicial.OFICINA_PADRAO, previa, pdf, "relatorio.pdf", "scanner@oficina.local");
        assertThat(id).isNotNull();

        // Le numa transacao nova, nao na que gravou: assim o que se ve e o
        // que ficou no banco, e nao o objeto que ainda esta na memoria.
        transacao.executeWithoutResult(status -> {
            Leitura gravada = repository.buscarCompleta(id).orElseThrow();

            // Nasce esperando gente: o PDF nao diz de que carro e nem se o
            // motor estava ligado, e chutar isso estragaria o dado.
            assertThat(gravada.getSituacao()).isEqualTo(SituacaoLeitura.PENDENTE);
            assertThat(gravada.getOrigem()).isEqualTo(OrigemLeitura.EMAIL);
            assertThat(gravada.getVeiculo()).isNull();
            assertThat(gravada.isMotorLigado()).isFalse();

            // O que o PDF diz, esse sim, chega inteiro.
            assertThat(gravada.getMarca()).isEqualTo("Honda");
            assertThat(gravada.getAno()).isEqualTo(2014);
            assertThat(gravada.getNumeroRelatorio()).isEqualTo("EMAIL20260923120000");
            assertThat(gravada.getModulos()).hasSize(1);
            assertThat(gravada.totalDeItens()).isEqualTo(2);

            // De onde veio fica escrito: e o que permite confiar ou desconfiar.
            assertThat(gravada.getDescricao()).contains("scanner@oficina.local");
        });

        // Reenviar o mesmo relatorio nao duplica. O indice unico parcial
        // garante no banco; aqui a resposta e um nao silencioso.
        UUID repetido = service.registrarPendente(
                CargaInicial.OFICINA_PADRAO, previa, pdf, "relatorio.pdf", "scanner@oficina.local");
        assertThat(repetido).isNull();
    }

    @Test
    @DisplayName("anexo com nome de PDF mas bytes de outra coisa e recusado")
    void nomeDeArquivoNaoDecideNada() {
        assertThatThrownBy(() -> armazenamento.guardarPdf(
                "MZ isto e um executavel".getBytes(), "relatorio.pdf", "leituras"))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("PDF");
    }
}
