package br.com.oficina.usuario;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    Optional<Usuario> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByLoginIgnoreCase(String login);

    /**
     * Uma consulta so para os dois jeitos de entrar. Fazer duas (tenta login,
     * depois tenta e-mail) custaria duas idas ao banco em toda tentativa de
     * senha errada, e o banco fica em outro continente.
     */
    @Query("""
            select u from Usuario u
            where lower(u.login) = lower(:identificador)
               or lower(u.email) = lower(:identificador)
            """)
    Optional<Usuario> findByLoginOuEmail(@Param("identificador") String identificador);

    List<Usuario> findByOficinaIdOrderByNome(UUID oficinaId);
}
