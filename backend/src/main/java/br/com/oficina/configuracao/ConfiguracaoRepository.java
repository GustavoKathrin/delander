package br.com.oficina.configuracao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConfiguracaoRepository extends JpaRepository<Configuracao, UUID> {

    List<Configuracao> findByOficinaIdOrderByGrupoAscChaveAsc(UUID oficinaId);

    Optional<Configuracao> findByOficinaIdAndChave(UUID oficinaId, String chave);

    /**
     * As oficinas que um job automatico deve percorrer.
     *
     * Nao ha entidade Oficina no sistema; quem tem uma linha por oficina e a
     * propria configuracao, criada pelas migrations. Para um job que so roda
     * se estiver ligado na configuracao, esta e a lista certa — nao um atalho.
     */
    @Query("select distinct c.oficinaId from Configuracao c")
    List<UUID> oficinasConfiguradas();
}
