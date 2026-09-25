package br.com.oficina.common;

import br.com.oficina.auth.UsuarioAutenticado;
import br.com.oficina.usuario.Papel;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Atalho para o usuario/oficina da requisicao atual. */
@Component
public class Contexto {

    public UsuarioAutenticado usuario() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UsuarioAutenticado usuario)) {
            throw new AccessDeniedException("Sessao invalida.");
        }
        return usuario;
    }

    public UUID oficinaId() {
        return usuario().oficinaId();
    }

    public UUID funcionarioId() {
        return usuario().funcionarioId();
    }

    public boolean gerencia() {
        return usuario().papel().gerencia();
    }

    public void exigirGerencia() {
        if (!gerencia()) {
            throw new AccessDeniedException("Apenas o dono ou o gerente podem fazer isso.");
        }
    }

    public String nomeUsuario() {
        return usuario().nome();
    }

    public Papel papel() {
        return usuario().papel();
    }

    /**
     * Registrar a resposta do cliente ao orcamento.
     *
     * O mecanico fica de fora de proposito: foi ele quem disse o que o carro
     * precisa, e aprovar o proprio orcamento fecha o circuito em uma pessoa
     * so. Quem atende o cliente — recepcao, gerente ou dono — e quem ouve o
     * "pode fazer" e registra.
     */
    public void exigirAtendimento() {
        if (gerencia() || papel() == Papel.RECEPCAO) {
            return;
        }
        throw new AccessDeniedException(
                "Quem registra a resposta do cliente ao orcamento e o atendente, o gerente ou o dono.");
    }

    /**
     * Comecar a trabalhar no carro.
     *
     * Quem poe a mao no carro e o mecanico, entao e ele quem inicia a
     * execucao — e o cronometro passa a medir trabalho de verdade. Dono e
     * gerente continuam podendo, porque em oficina pequena o dono tambem
     * pega em chave; recepcao nao.
     */
    public void exigirMaoNaMassa() {
        if (gerencia() || papel() == Papel.MECANICO) {
            return;
        }
        throw new AccessDeniedException("Quem inicia a execucao e o mecanico.");
    }
}
