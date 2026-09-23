package br.com.oficina.cadastro;

import br.com.oficina.common.Contexto;
import br.com.oficina.common.RecursoNaoEncontradoException;
import br.com.oficina.common.RegraNegocioException;
import br.com.oficina.configuracao.ConfiguracaoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Cadastros que o dono configura: especialidades, boxes, motivos de parada
 * e catalogo de servicos. Nada disso e fixo no codigo.
 */
@Service
public class CadastroService {

    private final EspecialidadeRepository especialidadeRepository;
    private final BoxRepository boxRepository;
    private final MotivoParadaRepository motivoRepository;
    private final CatalogoServicoRepository catalogoRepository;
    private final ConfiguracaoService config;
    private final Contexto contexto;

    public CadastroService(EspecialidadeRepository especialidadeRepository,
                           BoxRepository boxRepository,
                           MotivoParadaRepository motivoRepository,
                           CatalogoServicoRepository catalogoRepository,
                           ConfiguracaoService config,
                           Contexto contexto) {
        this.especialidadeRepository = especialidadeRepository;
        this.boxRepository = boxRepository;
        this.motivoRepository = motivoRepository;
        this.catalogoRepository = catalogoRepository;
        this.config = config;
        this.contexto = contexto;
    }

    // ------------------------------------------------------- especialidades

    @Transactional(readOnly = true)
    public List<CadastroDtos.EspecialidadeResposta> especialidades(boolean apenasAtivas) {
        UUID oficinaId = contexto.oficinaId();
        List<Especialidade> lista = apenasAtivas
                ? especialidadeRepository.findByOficinaIdAndAtivoTrueOrderByNome(oficinaId)
                : especialidadeRepository.findByOficinaIdOrderByNome(oficinaId);
        return lista.stream().map(CadastroDtos.EspecialidadeResposta::de).toList();
    }

    @Transactional
    public CadastroDtos.EspecialidadeResposta criarEspecialidade(CadastroDtos.EspecialidadeRequisicao req) {
        contexto.exigirGerencia();
        Especialidade e = new Especialidade();
        e.setOficinaId(contexto.oficinaId());
        aplicar(e, req);
        return CadastroDtos.EspecialidadeResposta.de(especialidadeRepository.save(e));
    }

    @Transactional
    public CadastroDtos.EspecialidadeResposta atualizarEspecialidade(UUID id,
                                                                     CadastroDtos.EspecialidadeRequisicao req) {
        contexto.exigirGerencia();
        Especialidade e = especialidadeRepository.findById(id)
                .filter(x -> x.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Especialidade", id));
        aplicar(e, req);
        return CadastroDtos.EspecialidadeResposta.de(especialidadeRepository.save(e));
    }

    private void aplicar(Especialidade e, CadastroDtos.EspecialidadeRequisicao req) {
        e.setNome(req.nome().trim());
        if (req.cor() != null && !req.cor().isBlank()) {
            e.setCor(req.cor().trim());
        }
        if (req.ativo() != null) {
            e.setAtivo(req.ativo());
        }
    }

    // ------------------------------------------------------- boxes

    @Transactional(readOnly = true)
    public List<CadastroDtos.BoxResposta> boxes(boolean apenasAtivos) {
        UUID oficinaId = contexto.oficinaId();
        List<Box> lista = apenasAtivos
                ? boxRepository.findByOficinaIdAndAtivoTrueOrderByNome(oficinaId)
                : boxRepository.findByOficinaIdOrderByNome(oficinaId);
        return lista.stream().map(CadastroDtos.BoxResposta::de).toList();
    }

    /**
     * Salva a planta do patio.
     *
     * Valida sobreposicao aqui e nao so na tela: a tela evita, mas o servidor
     * nao confia na tela — duas vagas na mesma celula deixariam a planta
     * ilegivel e o CSS Grid empilharia os cards um sobre o outro.
     */
    @Transactional
    public List<CadastroDtos.BoxResposta> salvarLayout(List<CadastroDtos.PosicaoVaga> vagas) {
        contexto.exigirGerencia();
        UUID oficinaId = contexto.oficinaId();
        Map<UUID, Box> porId = boxRepository.findByOficinaIdOrderByNome(oficinaId).stream()
                .collect(Collectors.toMap(Box::getId, b -> b));

        // celula ocupada -> nome da vaga que a ocupa
        Map<String, String> ocupadas = new LinkedHashMap<>();

        for (CadastroDtos.PosicaoVaga pedido : vagas) {
            Box box = porId.get(pedido.boxId());
            if (box == null) {
                throw RecursoNaoEncontradoException.de("Box", pedido.boxId());
            }
            if (pedido.coluna() == null || pedido.linha() == null) {
                box.setLayoutColuna(null);
                box.setLayoutLinha(null);
                box.setLayoutLargura(1);
                box.setLayoutAltura(1);
                continue;
            }

            for (int c = pedido.coluna(); c < pedido.coluna() + pedido.largura(); c++) {
                for (int l = pedido.linha(); l < pedido.linha() + pedido.altura(); l++) {
                    String celula = c + ":" + l;
                    String jaOcupa = ocupadas.putIfAbsent(celula, box.getNome());
                    if (jaOcupa != null) {
                        throw new RegraNegocioException(
                                "%s e %s estao no mesmo lugar da planta. Separe as duas."
                                        .formatted(jaOcupa, box.getNome()));
                    }
                }
            }

            box.setLayoutColuna(pedido.coluna());
            box.setLayoutLinha(pedido.linha());
            box.setLayoutLargura(pedido.largura());
            box.setLayoutAltura(pedido.altura());
        }

        boxRepository.saveAll(porId.values());
        return boxes(false);
    }

    /** Volta a planta para o arranjo automatico. */
    @Transactional
    public List<CadastroDtos.BoxResposta> limparLayout() {
        contexto.exigirGerencia();
        List<Box> todos = boxRepository.findByOficinaIdOrderByNome(contexto.oficinaId());
        todos.forEach(b -> {
            b.setLayoutColuna(null);
            b.setLayoutLinha(null);
            b.setLayoutLargura(1);
            b.setLayoutAltura(1);
        });
        boxRepository.saveAll(todos);
        return boxes(false);
    }

    @Transactional
    public CadastroDtos.BoxResposta criarBox(CadastroDtos.BoxRequisicao req) {
        contexto.exigirGerencia();
        Box b = new Box();
        b.setOficinaId(contexto.oficinaId());
        aplicar(b, req);
        return CadastroDtos.BoxResposta.de(boxRepository.save(b));
    }

    @Transactional
    public CadastroDtos.BoxResposta atualizarBox(UUID id, CadastroDtos.BoxRequisicao req) {
        contexto.exigirGerencia();
        Box b = boxRepository.findById(id)
                .filter(x -> x.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Box", id));
        aplicar(b, req);
        return CadastroDtos.BoxResposta.de(boxRepository.save(b));
    }

    private void aplicar(Box b, CadastroDtos.BoxRequisicao req) {
        b.setNome(req.nome().trim());
        if (req.tipo() != null) {
            b.setTipo(req.tipo());
        }
        if (req.ativo() != null) {
            b.setAtivo(req.ativo());
        }
    }

    // ------------------------------------------------------- motivos de parada

    @Transactional(readOnly = true)
    public List<CadastroDtos.MotivoResposta> motivos(boolean apenasAtivos) {
        UUID oficinaId = contexto.oficinaId();
        List<MotivoParada> lista = apenasAtivos
                ? motivoRepository.findByOficinaIdAndAtivoTrueOrderByNome(oficinaId)
                : motivoRepository.findByOficinaIdOrderByNome(oficinaId);
        return lista.stream().map(CadastroDtos.MotivoResposta::de).toList();
    }

    @Transactional
    public CadastroDtos.MotivoResposta criarMotivo(CadastroDtos.MotivoRequisicao req) {
        contexto.exigirGerencia();
        MotivoParada m = new MotivoParada();
        m.setOficinaId(contexto.oficinaId());
        aplicar(m, req);
        return CadastroDtos.MotivoResposta.de(motivoRepository.save(m));
    }

    @Transactional
    public CadastroDtos.MotivoResposta atualizarMotivo(UUID id, CadastroDtos.MotivoRequisicao req) {
        contexto.exigirGerencia();
        MotivoParada m = motivoRepository.findById(id)
                .filter(x -> x.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Motivo de parada", id));
        aplicar(m, req);
        return CadastroDtos.MotivoResposta.de(motivoRepository.save(m));
    }

    private void aplicar(MotivoParada m, CadastroDtos.MotivoRequisicao req) {
        m.setNome(req.nome().trim());
        m.setCategoria(req.categoria());
        if (req.bloqueiaExecucao() != null) {
            m.setBloqueiaExecucao(req.bloqueiaExecucao());
        }
        if (req.visivelClientePadrao() != null) {
            m.setVisivelClientePadrao(req.visivelClientePadrao());
        }
        if (req.ativo() != null) {
            m.setAtivo(req.ativo());
        }
    }

    // ------------------------------------------------------- catalogo

    @Transactional(readOnly = true)
    public List<CadastroDtos.ServicoResposta> servicos(boolean apenasAtivos) {
        UUID oficinaId = contexto.oficinaId();
        List<CatalogoServico> lista = apenasAtivos
                ? catalogoRepository.listarAtivos(oficinaId)
                : catalogoRepository.listar(oficinaId);
        return lista.stream().map(CadastroDtos.ServicoResposta::de).toList();
    }

    @Transactional
    public CadastroDtos.ServicoResposta criarServico(CadastroDtos.ServicoRequisicao req) {
        contexto.exigirGerencia();
        CatalogoServico c = new CatalogoServico();
        c.setOficinaId(contexto.oficinaId());
        aplicar(c, req);
        return CadastroDtos.ServicoResposta.de(catalogoRepository.save(c));
    }

    @Transactional
    public CadastroDtos.ServicoResposta atualizarServico(UUID id, CadastroDtos.ServicoRequisicao req) {
        contexto.exigirGerencia();
        CatalogoServico c = catalogoRepository.findById(id)
                .filter(x -> x.getOficinaId().equals(contexto.oficinaId()))
                .orElseThrow(() -> RecursoNaoEncontradoException.de("Servico", id));
        aplicar(c, req);
        return CadastroDtos.ServicoResposta.de(catalogoRepository.save(c));
    }

    private void aplicar(CatalogoServico c, CadastroDtos.ServicoRequisicao req) {
        c.setDescricao(req.descricao().trim());
        if (req.especialidadeId() != null) {
            c.setEspecialidade(especialidadeRepository.findById(req.especialidadeId())
                    .filter(e -> e.getOficinaId().equals(contexto.oficinaId()))
                    .orElseThrow(() -> RecursoNaoEncontradoException.de("Especialidade", req.especialidadeId())));
        }
        if (req.horasPadrao() != null) {
            c.setHorasPadrao(req.horasPadrao());
        } else if (c.getHorasPadrao() == null) {
            c.setHorasPadrao(BigDecimal.ONE);
        }
        c.setPrecoSugerido(req.precoSugerido());
        if (req.exigeElevador() != null) {
            c.setExigeElevador(req.exigeElevador());
        }
        if (req.ativo() != null) {
            c.setAtivo(req.ativo());
        }
    }

    /** Limpa o cache de configuracao quando um cadastro muda a capacidade. */
    public void invalidarCache() {
        config.limparCache(contexto.oficinaId());
    }
}
