package br.com.oficina.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update RefreshToken t set t.revogado = true where t.usuarioId = :usuarioId")
    void revogarTodosDoUsuario(@Param("usuarioId") UUID usuarioId);

    @Modifying
    @Query("delete from RefreshToken t where t.expiraEm < :limite or t.revogado = true")
    void limpar(@Param("limite") OffsetDateTime limite);
}
