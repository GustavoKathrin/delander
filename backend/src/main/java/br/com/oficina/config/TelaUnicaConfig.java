package br.com.oficina.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * A mesma aplicacao serve a API e a tela.
 *
 * Existe para o deploy: o front chama "/api" relativo, sem URL absoluta
 * nenhuma. Isso significa que front e back TEM que sair da mesma origem —
 * e, de brinde, some o CORS, some o segundo servico de hospedagem e some a
 * variavel de ambiente com a URL da API. Um servico gratuito em vez de dois.
 *
 * Em desenvolvimento nada muda: o Vite continua servindo a tela na 5173 com
 * proxy para a 8080, e a pasta static simplesmente nao existe no classpath.
 *
 * O React Router usa caminhos de verdade ("/leituras/abc"), que nao sao
 * arquivos. Recarregar essa URL daria 404 sem este resolvedor: qualquer
 * caminho que nao exista como arquivo volta o index.html, e o roteador do
 * navegador decide o resto. O que NAO cai nessa regra e /api e /actuator —
 * la um caminho errado tem que continuar sendo 404, e nao uma tela.
 */
@Configuration
public class TelaUnicaConfig implements WebMvcConfigurer {

    private static final String[] NAO_E_TELA = {"api/", "actuator/", "v3/api-docs", "swagger-ui"};

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String caminho, Resource local) throws IOException {
                        Resource pedido = local.createRelative(caminho);
                        if (pedido.exists() && pedido.isReadable()) {
                            return pedido;
                        }
                        for (String prefixo : NAO_E_TELA) {
                            if (caminho.startsWith(prefixo)) {
                                return null;
                            }
                        }
                        ClassPathResource index = new ClassPathResource("/static/index.html");
                        return index.exists() ? index : null;
                    }
                });
    }
}
