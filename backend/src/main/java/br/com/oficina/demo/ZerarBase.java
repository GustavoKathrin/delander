package br.com.oficina.demo;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Apaga os dados de demonstracao de uma base que virou producao.
 *
 * Existe porque a carga de exemplo foi para a base que a oficina vai usar de
 * verdade, e ali doze carros inventados nao sao enfeite: ninguem mais sabe
 * qual carro e real.
 *
 * ISTO E TEMPORARIO. E uma chave que apaga dado, e chave assim nao deve
 * morar num sistema em uso — quem a encontrar daqui a um ano nao vai saber
 * que ela existe ate flagra-la ligada. Roda uma vez, confere-se o resultado,
 * e o commit seguinte remove esta classe e a variavel do render.yaml.
 *
 * O que NAO e apagado: oficina, boxes, catalogo de servicos, especialidades,
 * motivos de parada e configuracoes. Esses nascem da migration V2, nao da
 * demonstracao — apagar so daria trabalho de recadastrar.
 *
 * @Order(10) para rodar DEPOIS da CargaInicial e da CargaDemo: senao elas
 * recriariam na mesma subida o que aqui se apaga.
 */
@Component
@Order(10)
public class ZerarBase implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ZerarBase.class);

    /** O unico login que sobrevive. Sem ele, a oficina fica sem dono e sem acesso. */
    private static final String MANTER = "demo@oficina.local";

    @PersistenceContext
    private EntityManager em;

    @Value("${app.zerar-base:false}")
    private boolean zerar;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!zerar) {
            return;
        }

        // Guarda de seguranca: sem o usuario que deve sobreviver, limpar
        // deixaria a oficina sem nenhum acesso. Melhor nao fazer nada.
        Number quantos = (Number) em
                .createNativeQuery("select count(*) from usuario where lower(email) = :e")
                .setParameter("e", MANTER)
                .getSingleResult();
        if (quantos.intValue() == 0) {
            log.error("ZERAR BASE cancelado: o usuario {} nao existe, e apagar deixaria "
                    + "a oficina sem acesso nenhum.", MANTER);
            return;
        }

        int antes = ((Number) em.createNativeQuery("select count(*) from veiculo")
                .getSingleResult()).intValue();

        // truncate ... cascade resolve a ordem das chaves estrangeiras sozinho:
        // apontamento, parada, os_item, evento_os, reserva_elevador e o resto
        // caem junto com a OS a que pertencem.
        em.createNativeQuery(
                "truncate table ordem_servico, veiculo, cliente, funcionario, leitura cascade")
                .executeUpdate();

        int usuarios = em.createNativeQuery("delete from usuario where lower(email) <> :e")
                .setParameter("e", MANTER)
                .executeUpdate();

        log.warn("BASE ZERADA: {} veiculo(s) e {} usuario(s) removidos. Ficou apenas {}. "
                + "Desligue APP_ZERAR_BASE.", antes, usuarios, MANTER);
    }
}
