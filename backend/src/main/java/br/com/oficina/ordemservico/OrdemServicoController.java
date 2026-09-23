package br.com.oficina.ordemservico;

import br.com.oficina.elevador.ElevadorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/os")
@Tag(name = "Ordens de servico")
public class OrdemServicoController {

    private final OrdemServicoService service;
    private final ElevadorService elevadorService;

    public OrdemServicoController(OrdemServicoService service, ElevadorService elevadorService) {
        this.service = service;
        this.elevadorService = elevadorService;
    }

    @PostMapping("/check-in")
    @Operation(summary = "Check-in rapido: cliente + veiculo + OS + itens + agenda em uma chamada")
    public OsDtos.Detalhe checkIn(@Valid @RequestBody OsDtos.CheckinRequisicao req) {
        return service.checkIn(req);
    }

    @GetMapping
    @Operation(summary = "Lista OS com filtro de status e busca por placa, cliente ou numero")
    public Page<OsDtos.Resumo> listar(@RequestParam(required = false) List<StatusOs> status,
                                      @RequestParam(required = false) String busca,
                                      @RequestParam(defaultValue = "0") int pagina,
                                      @RequestParam(defaultValue = "20") int tamanho) {
        return service.listar(status, busca, PageRequest.of(pagina, Math.min(tamanho, 100)));
    }

    @GetMapping("/patio")
    @Operation(summary = "Carros que ainda ocupam espaco fisico na oficina")
    public List<OsDtos.Resumo> patio() {
        return service.noPatio();
    }

    @GetMapping("/radar")
    @Operation(summary = "Radar de carros parados: o que precisa de acao hoje, em ordem de urgencia")
    public List<OsDtos.Resumo> radar() {
        return service.radarParados();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detalhe completo da OS com timeline, apontamentos, paradas e pecas")
    public OsDtos.Detalhe detalhe(@PathVariable UUID id) {
        return service.detalhe(id);
    }

    @PatchMapping("/{id}")
    public OsDtos.Detalhe atualizar(@PathVariable UUID id,
                                    @Valid @RequestBody OsDtos.AtualizacaoRequisicao req) {
        return service.atualizar(id, req);
    }

    @PostMapping("/{id}/transicao")
    @Operation(summary = "Muda o status da OS (validado pela maquina de estados)")
    public OsDtos.Detalhe transicionar(@PathVariable UUID id,
                                       @Valid @RequestBody OsDtos.TransicaoRequisicao req) {
        return service.transicionar(id, req);
    }

    @PostMapping("/{id}/alocar")
    @Operation(summary = "Define o dia e o box da OS (usado pelo arrastar e soltar do quadro)")
    public OsDtos.Detalhe alocar(@PathVariable UUID id,
                                 @RequestBody OsDtos.AlocacaoRequisicao req) {
        return service.alocar(id, req);
    }

    // ------------------------------------------------------------- elevador

    @PatchMapping("/{id}/elevador")
    @Operation(summary = "Marca ou desmarca que o servico precisa do elevador")
    public OsDtos.Detalhe marcarElevador(@PathVariable UUID id,
                                         @Valid @RequestBody OsDtos.MarcacaoElevadorRequisicao req) {
        elevadorService.marcar(id, req.precisaElevador());
        return service.detalhe(id);
    }

    @PostMapping("/{id}/elevador/reservar")
    @Operation(summary = "Reserva um horario no elevador (sem inicio, pega o primeiro livre)")
    public OsDtos.Detalhe reservarElevador(@PathVariable UUID id,
                                           @Valid @RequestBody OsDtos.ReservaElevadorRequisicao req) {
        elevadorService.reservar(id, req.boxId(), req.inicio(), req.horas());
        return service.detalhe(id);
    }

    @PostMapping("/{id}/elevador/subir")
    @Operation(summary = "Poe o carro no elevador agora e aloca a OS naquela vaga")
    public OsDtos.Detalhe subirNoElevador(@PathVariable UUID id,
                                          @Valid @RequestBody OsDtos.SubidaElevadorRequisicao req) {
        elevadorService.subir(id, req.boxId());
        return service.detalhe(id);
    }

    @PostMapping("/{id}/elevador/descer")
    @Operation(summary = "Tira o carro do elevador")
    public OsDtos.Detalhe descerDoElevador(@PathVariable UUID id) {
        elevadorService.descer(id);
        return service.detalhe(id);
    }

    @DeleteMapping("/{id}/elevador/reserva")
    @Operation(summary = "Cancela a reserva de elevador")
    public OsDtos.Detalhe cancelarReservaElevador(@PathVariable UUID id) {
        elevadorService.cancelar(id);
        return service.detalhe(id);
    }

    @PostMapping("/{id}/itens")
    @Operation(summary = "Adiciona um servico a OS (do catalogo ou avulso)")
    public OsDtos.Detalhe adicionarItem(@PathVariable UUID id,
                                        @Valid @RequestBody OsDtos.ItemRequisicao req) {
        return service.adicionarItem(id, req);
    }

    @DeleteMapping("/{id}/itens/{itemId}")
    @Operation(summary = "Remove o servico (se ja teve horas apontadas, apenas cancela)")
    public OsDtos.Detalhe removerItem(@PathVariable UUID id, @PathVariable UUID itemId) {
        return service.removerItem(id, itemId);
    }

    @PostMapping("/{id}/itens/{itemId}/atribuir")
    @Operation(summary = "Atribui o servico a um mecanico com a especialidade exigida")
    public OsDtos.Detalhe atribuir(@PathVariable UUID id,
                                   @PathVariable UUID itemId,
                                   @Valid @RequestBody OsDtos.AtribuicaoRequisicao req) {
        return service.atribuir(id, itemId, req);
    }
}
