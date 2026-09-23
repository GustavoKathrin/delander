package br.com.oficina;

import br.com.oficina.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
@EnableScheduling
public class OficinaApplication {

    public static void main(String[] args) {
        SpringApplication.run(OficinaApplication.class, args);
    }

    /**
     * Relogio injetavel: todo timestamp de apontamento e parada sai daqui,
     * nunca do relogio do navegador. Nos testes o Clock e fixado.
     */
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
