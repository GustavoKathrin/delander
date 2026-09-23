package br.com.oficina.configuracao;

/** Todas as chaves parametrizaveis do sistema, em um lugar so. */
public final class Chaves {

    private Chaves() {
    }

    // ---- CAPACIDADE: quanto a oficina aguenta ----
    public static final String HORAS_UTEIS_POR_DIA = "capacidade.horas_uteis_por_dia";
    public static final String DIAS_FUNCIONAMENTO = "capacidade.dias_funcionamento";
    public static final String HORA_ABERTURA = "capacidade.hora_abertura";
    public static final String HORA_FECHAMENTO = "capacidade.hora_fechamento";
    public static final String MAX_CARROS_DIA = "capacidade.max_carros_por_dia";
    public static final String MAX_CARROS_SEMANA = "capacidade.max_carros_por_semana";
    public static final String MAX_CARROS_MES = "capacidade.max_carros_por_mes";
    public static final String LIMITAR_POR_HORAS = "capacidade.limitar_por_horas";
    public static final String LIMITAR_POR_BOXES = "capacidade.limitar_por_boxes";
    public static final String LIMITAR_POR_QUANTIDADE = "capacidade.limitar_por_quantidade";
    public static final String PERMITIR_OVERBOOKING = "capacidade.permitir_overbooking";
    public static final String PERCENTUAL_OVERBOOKING = "capacidade.percentual_overbooking";

    /**
     * Quantos elevadores a oficina tem. Salvar esta chave reconcilia as linhas
     * de box do tipo ELEVADOR — ver ElevadorService.sincronizarQuantidade.
     */
    public static final String QTD_ELEVADORES = "capacidade.qtd_elevadores";

    // ---- FLUXO: o que o sistema exige e quem pode o que ----
    public static final String EXIGIR_DIAGNOSTICO = "fluxo.exigir_diagnostico";
    public static final String EXIGIR_APROVACAO = "fluxo.exigir_aprovacao_orcamento";
    public static final String EXIGIR_CHECKLIST_ENTRADA = "fluxo.exigir_checklist_entrada";
    public static final String EXIGIR_FOTOS_ENTRADA = "fluxo.exigir_fotos_entrada";
    public static final String MULTIPLOS_MECANICOS = "fluxo.permitir_multiplos_mecanicos_por_os";
    public static final String APONTAMENTO_SIMULTANEO = "fluxo.permitir_apontamento_simultaneo";
    public static final String EXIGIR_ESTIMATIVA = "fluxo.exigir_estimativa_ao_iniciar";
    public static final String EXIGIR_MOTIVO_PAUSA = "fluxo.exigir_motivo_ao_pausar";
    public static final String MECANICO_CRIA_OS = "fluxo.mecanico_pode_criar_os";
    public static final String MECANICO_REALOCA = "fluxo.mecanico_pode_realocar";
    public static final String MECANICO_VE_VALORES = "fluxo.mecanico_ve_valores";
    public static final String FECHAR_APONTAMENTO_ESQUECIDO = "fluxo.fechar_apontamento_esquecido";
    public static final String HORA_FECHAMENTO_AUTOMATICO = "fluxo.hora_fechamento_automatico";

    // ---- COMPARTILHAMENTO: o que o dono do carro ve ----
    public static final String COMP_ATIVO_GLOBAL = "compartilhamento.ativo_global";
    public static final String COMP_AUTOMATICO = "compartilhamento.gerar_automatico_ao_iniciar";
    public static final String COMP_DIAS_VALIDADE = "compartilhamento.dias_validade";
    public static final String COMP_EXIGIR_PIN = "compartilhamento.exigir_pin";
    public static final String COMP_MOSTRAR_ITENS = "compartilhamento.mostrar_itens";
    public static final String COMP_MOSTRAR_VALORES = "compartilhamento.mostrar_valores";
    public static final String COMP_MOSTRAR_MECANICO = "compartilhamento.mostrar_nome_mecanico";
    public static final String COMP_MOSTRAR_PARADAS = "compartilhamento.mostrar_paradas";
    public static final String COMP_MOSTRAR_MOTIVO_PARADA = "compartilhamento.mostrar_motivo_parada";
    public static final String COMP_MOSTRAR_PREVISAO = "compartilhamento.mostrar_previsao_entrega";
    public static final String COMP_MOSTRAR_FOTOS = "compartilhamento.mostrar_fotos";
    public static final String COMP_MOSTRAR_TEMPO = "compartilhamento.mostrar_tempo_trabalhado";

    /** Chaves de escopo que podem ser sobrescritas por cliente ou por OS. */
    public static final String[] ESCOPO_COMPARTILHAMENTO = {
            COMP_MOSTRAR_ITENS, COMP_MOSTRAR_VALORES, COMP_MOSTRAR_MECANICO,
            COMP_MOSTRAR_PARADAS, COMP_MOSTRAR_MOTIVO_PARADA, COMP_MOSTRAR_PREVISAO,
            COMP_MOSTRAR_FOTOS, COMP_MOSTRAR_TEMPO
    };

    // ---- ALERTAS: o que acende a luz vermelha ----
    public static final String DIAS_SEM_MOVIMENTACAO = "alertas.dias_sem_movimentacao";
    public static final String DIAS_PRONTO_SEM_RETIRADA = "alertas.dias_pronto_sem_retirada";
    public static final String PERCENTUAL_ESTOURO = "alertas.percentual_estouro_estimativa";
    public static final String DIAS_ANTES_PREVISAO = "alertas.dias_antes_previsao";

    // ---- CADASTROS: listas que a oficina escolhe ----
    /** Marcas do combo de veiculo, separadas por virgula. */
    public static final String MARCAS_VEICULO = "cadastro.marcas_veiculo";

    // ---- INTEGRACAO: o que entra no sistema sem ninguem digitar ----
    public static final String EMAIL_LEITURAS_ATIVO = "integracao.email_leituras_ativo";
    public static final String EMAIL_ASSUNTO = "integracao.email_assunto";
    public static final String EMAIL_REMETENTES = "integracao.email_remetentes";
    public static final String EMAIL_INTERVALO_MINUTOS = "integracao.email_intervalo_minutos";
    public static final String EMAIL_PASTA = "integracao.email_pasta";

    // ---- APARENCIA ----
    public static final String NOME_OFICINA = "app.nome_oficina";
    public static final String MODO_TV = "app.modo_tv";
}
