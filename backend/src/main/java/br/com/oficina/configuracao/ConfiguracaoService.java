package br.com.oficina.configuracao;

import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Leitura tipada das configuracoes, com cache em memoria.
 * Todo "vai ou nao vai" do sistema passa por aqui.
 */
@Service
public class ConfiguracaoService {

    private final ConfiguracaoRepository repository;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventos;
    private final Map<UUID, Map<String, String>> cache = new ConcurrentHashMap<>();

    public ConfiguracaoService(ConfiguracaoRepository repository,
                               ObjectMapper objectMapper,
                               ApplicationEventPublisher eventos) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.eventos = eventos;
    }

    // ------------------------------------------------------------------ leitura

    @Transactional(readOnly = true)
    public Map<String, String> valores(UUID oficinaId) {
        return cache.computeIfAbsent(oficinaId, id -> {
            Map<String, String> mapa = new ConcurrentHashMap<>();
            repository.findByOficinaIdOrderByGrupoAscChaveAsc(id)
                    .forEach(c -> mapa.put(c.getChave(), c.getValor() == null ? "" : c.getValor()));
            return mapa;
        });
    }

    public boolean flag(UUID oficinaId, String chave) {
        return Boolean.parseBoolean(valores(oficinaId).getOrDefault(chave, "false"));
    }

    public int inteiro(UUID oficinaId, String chave, int padrao) {
        try {
            String v = valores(oficinaId).get(chave);
            return v == null || v.isBlank() ? padrao : Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return padrao;
        }
    }

    public BigDecimal decimal(UUID oficinaId, String chave, BigDecimal padrao) {
        try {
            String v = valores(oficinaId).get(chave);
            return v == null || v.isBlank() ? padrao : new BigDecimal(v.trim());
        } catch (NumberFormatException e) {
            return padrao;
        }
    }

    public String texto(UUID oficinaId, String chave, String padrao) {
        String v = valores(oficinaId).get(chave);
        return v == null || v.isBlank() ? padrao : v;
    }

    public LocalTime hora(UUID oficinaId, String chave, LocalTime padrao) {
        try {
            String v = valores(oficinaId).get(chave);
            return v == null || v.isBlank() ? padrao : LocalTime.parse(v.trim());
        } catch (RuntimeException e) {
            return padrao;
        }
    }

    /** Dias de funcionamento no padrao ISO (1 = segunda ... 7 = domingo). */
    public List<Integer> diasFuncionamento(UUID oficinaId) {
        try {
            String v = valores(oficinaId).get(Chaves.DIAS_FUNCIONAMENTO);
            if (v == null || v.isBlank()) {
                return List.of(1, 2, 3, 4, 5);
            }
            List<?> lista = objectMapper.readValue(v, List.class);
            List<Integer> dias = new ArrayList<>();
            for (Object o : lista) {
                dias.add(Integer.parseInt(String.valueOf(o)));
            }
            return dias.isEmpty() ? List.of(1, 2, 3, 4, 5) : dias;
        } catch (Exception e) {
            return List.of(1, 2, 3, 4, 5);
        }
    }

    /** Escopo padrao do link publico (o que o dono do carro enxerga). */
    public Map<String, Boolean> escopoPadrao(UUID oficinaId) {
        Map<String, Boolean> escopo = new LinkedHashMap<>();
        for (String chave : Chaves.ESCOPO_COMPARTILHAMENTO) {
            escopo.put(chave, flag(oficinaId, chave));
        }
        return escopo;
    }

    // ------------------------------------------------------------------ escrita

    @Transactional(readOnly = true)
    public List<ConfiguracaoDtos.Item> listar(UUID oficinaId) {
        return repository.findByOficinaIdOrderByGrupoAscChaveAsc(oficinaId).stream()
                .map(c -> new ConfiguracaoDtos.Item(c.getChave(), c.getValor(), c.getTipo(), c.getGrupo()))
                .toList();
    }

    @Transactional
    public List<ConfiguracaoDtos.Item> atualizar(UUID oficinaId, Map<String, String> alteracoes) {
        alteracoes.forEach((chave, valor) -> {
            Configuracao config = repository.findByOficinaIdAndChave(oficinaId, chave)
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Configuracao", chave));
            validar(config, valor);
            config.setValor(valor);
            config.setAtualizadoEm(OffsetDateTime.now());
            repository.save(config);
        });
        cache.remove(oficinaId);
        // Limpar so aqui nao basta: entre este ponto e o commit alguem pode
        // reencher o cache com o valor antigo, e um rollback deixaria o cache
        // com o valor novo que nunca existiu. Limpar de novo quando a transacao
        // fechar, dando certo ou nao, resolve os dois casos.
        limparCacheAoFecharTransacao(oficinaId);

        // Dentro da transacao, de proposito: um ouvinte que recuse a mudanca
        // (elevador ocupado, por exemplo) derruba o commit junto.
        eventos.publishEvent(new ConfiguracaoAlteradaEvent(oficinaId, Map.copyOf(alteracoes)));

        return listar(oficinaId);
    }

    private void limparCacheAoFecharTransacao(UUID oficinaId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                cache.remove(oficinaId);
            }
        });
    }

    private void validar(Configuracao config, String valor) {
        String v = valor == null ? "" : valor.trim();
        switch (config.getTipo()) {
            case "BOOLEAN" -> {
                if (!v.equals("true") && !v.equals("false")) {
                    throw new RegraNegocioException("A configuracao '%s' aceita apenas true ou false."
                            .formatted(config.getChave()));
                }
            }
            case "INTEIRO" -> exigirNumero(config, v, true);
            case "DECIMAL" -> exigirNumero(config, v, false);
            case "HORA" -> {
                try {
                    LocalTime.parse(v);
                } catch (RuntimeException e) {
                    throw new RegraNegocioException("A configuracao '%s' precisa estar no formato HH:MM."
                            .formatted(config.getChave()));
                }
            }
            case "JSON" -> {
                try {
                    objectMapper.readTree(v);
                } catch (Exception e) {
                    throw new RegraNegocioException("A configuracao '%s' precisa ser um JSON valido."
                            .formatted(config.getChave()));
                }
            }
            default -> {
                // TEXTO: qualquer valor
            }
        }
    }

    private void exigirNumero(Configuracao config, String valor, boolean inteiro) {
        try {
            if (inteiro) {
                int n = Integer.parseInt(valor);
                if (n < 0) {
                    throw new NumberFormatException();
                }
            } else {
                BigDecimal n = new BigDecimal(valor);
                if (n.signum() < 0) {
                    throw new NumberFormatException();
                }
            }
        } catch (NumberFormatException e) {
            throw new RegraNegocioException("A configuracao '%s' precisa ser um numero maior ou igual a zero."
                    .formatted(config.getChave()));
        }
    }

    public void limparCache(UUID oficinaId) {
        cache.remove(oficinaId);
    }
}
