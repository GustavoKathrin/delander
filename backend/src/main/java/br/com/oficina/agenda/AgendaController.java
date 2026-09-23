package br.com.oficina.agenda;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "Agenda e capacidade")
public class AgendaController {

    private final AgendaService service;

    public AgendaController(AgendaService service) {
        this.service = service;
    }

    @GetMapping("/quadro")
    @Operation(summary = "Quadro da semana com semaforo de capacidade por dia")
    public AgendaDtos.Quadro quadro(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(defaultValue = "7") int dias) {
        return service.quadro(inicio, dias);
    }

    @GetMapping("/patio")
    @Operation(summary = "Planta do patio: cada vaga com o carro dentro, a situacao e quando libera")
    public AgendaDtos.Patio patio() {
        return service.patio();
    }

    @GetMapping("/fila")
    @Operation(summary = "Fila de espera com a data prevista de entrada de cada carro")
    public AgendaDtos.Fila fila() {
        return service.fila();
    }

    @GetMapping("/elevadores")
    @Operation(summary = "Fila do elevador: quem esta em cima e quem sobe em seguida")
    public AgendaDtos.FilaElevador elevadores() {
        return service.filaElevador();
    }

    @GetMapping("/capacidade/sugestao")
    @Operation(summary = "Primeiras datas com folga para o servico que esta entrando")
    public List<AgendaDtos.Sugestao> sugestao(@RequestParam(required = false) BigDecimal horas,
                                              @RequestParam(defaultValue = "3") int quantidade) {
        return service.sugerir(horas, quantidade);
    }

    @GetMapping("/capacidade")
    @Operation(summary = "Capacidade dia a dia no periodo")
    public List<AgendaDtos.CapacidadeDia> capacidade(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.capacidade(de, ate);
    }
}
