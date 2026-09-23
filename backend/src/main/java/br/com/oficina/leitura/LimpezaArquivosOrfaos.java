package br.com.oficina.leitura;

import br.com.oficina.arquivo.ArmazenamentoArquivos;
import br.com.oficina.arquivo.ArquivoLeitura;
import br.com.oficina.arquivo.ArquivoLeituraRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * PDF que alguem importou e nunca confirmou fica no disco a toa.
 *
 * E o preco de deixar o usuario conferir antes de gravar — vale a pena, e
 * custa este job. Um dia de carencia porque a conferencia pode ficar aberta.
 */
@Component
public class LimpezaArquivosOrfaos {

    private static final Logger log = LoggerFactory.getLogger(LimpezaArquivosOrfaos.class);
    private static final Duration CARENCIA = Duration.ofDays(1);

    private final ArquivoLeituraRepository repository;
    private final br.com.oficina.wiki.WikiArquivoRepository wikiRepository;
    private final ArmazenamentoArquivos armazenamento;
    private final Clock clock;

    public LimpezaArquivosOrfaos(ArquivoLeituraRepository repository,
                                 br.com.oficina.wiki.WikiArquivoRepository wikiRepository,
                                 ArmazenamentoArquivos armazenamento,
                                 Clock clock) {
        this.repository = repository;
        this.wikiRepository = wikiRepository;
        this.armazenamento = armazenamento;
        this.clock = clock;
    }

    @Scheduled(cron = "0 20 3 * * *")
    @Transactional
    public void limpar() {
        OffsetDateTime limite = OffsetDateTime.now(clock).minus(CARENCIA);

        List<ArquivoLeitura> leituras = repository.orfaos(limite);
        if (!leituras.isEmpty()) {
            leituras.forEach(a -> armazenamento.apagar(a.getCaminho()));
            repository.deleteAll(leituras);
        }

        var wiki = wikiRepository.orfaos(limite);
        if (!wiki.isEmpty()) {
            wiki.forEach(a -> armazenamento.apagar(a.getCaminho()));
            wikiRepository.deleteAll(wiki);
        }

        if (!leituras.isEmpty() || !wiki.isEmpty()) {
            log.info("Limpeza de arquivos soltos: {} de leitura, {} de wiki",
                    leituras.size(), wiki.size());
        }
    }
}
