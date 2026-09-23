package br.com.oficina.metrica;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/metricas")
@Tag(name = "Metricas")
public class MetricaController {

    private final MetricaService service;

    public MetricaController(MetricaService service) {
        this.service = service;
    }

    @GetMapping("/painel")
    @Operation(summary = "Painel do dono: patio, fluxo, permanencia x mao de obra, Pareto e equipe")
    public MetricaDtos.Painel painel(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.painel(de, ate);
    }

    @GetMapping("/paradas")
    @Operation(summary = "Pareto de horas perdidas por motivo de parada")
    public List<MetricaDtos.ItemPareto> paradas(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.pareto(de, ate);
    }

    @GetMapping("/throughput")
    @Operation(summary = "Recebidos x entregues por semana")
    public List<MetricaDtos.Throughput> throughput(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate referencia,
            @RequestParam(defaultValue = "8") int semanas) {
        return service.throughput(referencia, Math.min(Math.max(semanas, 1), 26));
    }

    @GetMapping("/mecanicos")
    @Operation(summary = "Horas trabalhadas e aderencia a estimativa por mecanico")
    public List<MetricaDtos.ItemMecanico> mecanicos(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return service.mecanicos(de, ate);
    }
}
