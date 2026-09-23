/** Rotulos e explicacoes de cada configuracao, em linguagem de oficina. */
export interface RotuloConfig {
  rotulo: string
  descricao?: string
  unidade?: string
  /**
   * Esta chave guarda uma cor (hex). O tipo no banco continua TEXTO — o
   * check constraint so aceita seis tipos e nao vale altera-lo por isto.
   * Quem sabe que e cor e a tela.
   */
  cor?: boolean
  /**
   * Ordem de leitura dentro do grupo. Sem isto vale a ordem alfabetica da
   * chave, que na maioria dos grupos serve; onde nao serve — uma chave geral
   * que precisa vir antes do que ela controla — declare aqui.
   */
  ordem?: number
}

export const ROTULOS: Record<string, RotuloConfig> = {
  // ---------------- capacidade ----------------
  'capacidade.horas_uteis_por_dia': {
    rotulo: 'Horas úteis por dia',
    descricao: 'Usado quando ainda não há funcionários cadastrados. Com equipe cadastrada, a capacidade passa a ser a soma das jornadas.',
    unidade: 'h',
  },
  'capacidade.dias_funcionamento': {
    rotulo: 'Dias de funcionamento',
    descricao: 'Números do dia da semana: 1 = segunda ... 7 = domingo.',
  },
  'capacidade.hora_abertura': { rotulo: 'Horário de abertura' },
  'capacidade.hora_fechamento': { rotulo: 'Horário de fechamento' },
  'capacidade.qtd_elevadores': {
    rotulo: 'Quantos elevadores a oficina tem',
    descricao:
      'Aumentar cria as vagas "Elevador N" na planta. Diminuir só desativa elevador vazio — se tiver carro em cima, o sistema avisa qual é e não muda nada.',
  },
  'capacidade.max_carros_por_dia': {
    rotulo: 'Máximo de carros por dia',
    descricao: 'Teto de entradas por dia, independente das horas disponíveis.',
  },
  'capacidade.max_carros_por_semana': { rotulo: 'Máximo de carros por semana' },
  'capacidade.max_carros_por_mes': { rotulo: 'Máximo de carros por mês' },
  'capacidade.limitar_por_horas': {
    rotulo: 'Limitar pelas horas de mão de obra',
    descricao: 'O dia fica cheio quando as horas alocadas passam das horas disponíveis.',
  },
  'capacidade.limitar_por_boxes': {
    rotulo: 'Limitar pelas vagas físicas',
    descricao: 'O dia fica cheio quando todos os boxes ativos estão ocupados.',
  },
  'capacidade.limitar_por_quantidade': {
    rotulo: 'Limitar pela quantidade de carros',
    descricao: 'Respeita os tetos por dia, semana e mês definidos acima.',
  },
  'capacidade.permitir_overbooking': {
    rotulo: 'Permitir passar do limite',
    descricao: 'Deixa aceitar carro em dia cheio, dentro da folga configurada abaixo.',
  },
  'capacidade.percentual_overbooking': {
    rotulo: 'Folga permitida acima do limite',
    unidade: '%',
  },

  // ---------------- fluxo ----------------
  'fluxo.exigir_diagnostico': {
    rotulo: 'Toda OS começa em diagnóstico',
    descricao: 'Para oficinas que sempre avaliam o carro antes de orçar.',
  },
  'fluxo.exigir_aprovacao_orcamento': {
    rotulo: 'Exigir aprovação do orçamento',
    descricao: 'Sem aprovação, o sistema não deixa iniciar a execução. Desligue se a sua oficina não trabalha com orçamento formal.',
  },
  'fluxo.exigir_checklist_entrada': { rotulo: 'Exigir checklist na entrada' },
  'fluxo.exigir_fotos_entrada': {
    rotulo: 'Exigir fotos na entrada',
    descricao: 'Protege a oficina de reclamação de avaria pré-existente.',
  },
  'fluxo.permitir_multiplos_mecanicos_por_os': {
    rotulo: 'Vários mecânicos na mesma OS',
    descricao: 'Permite que dois mecânicos trabalhem no mesmo carro ao mesmo tempo.',
  },
  'fluxo.permitir_apontamento_simultaneo': {
    rotulo: 'Mecânico pode ter dois cronômetros ao mesmo tempo',
    descricao: 'Desligado é o recomendado: garante que a hora apontada é hora real de trabalho.',
  },
  'fluxo.exigir_estimativa_ao_iniciar': {
    rotulo: 'Pedir a previsão de horas ao iniciar',
    descricao: 'É essa previsão que alimenta o prazo prometido ao cliente.',
  },
  'fluxo.exigir_motivo_ao_pausar': {
    rotulo: 'Exigir motivo ao pausar',
    descricao: 'Sem isso, o painel não consegue mostrar onde o tempo se perde.',
  },
  'fluxo.mecanico_pode_criar_os': { rotulo: 'Mecânico pode abrir OS' },
  'fluxo.mecanico_pode_realocar': {
    rotulo: 'Mecânico pode mexer na agenda',
    descricao: 'Permite arrastar cards entre os dias do quadro.',
  },
  'fluxo.mecanico_ve_valores': { rotulo: 'Mecânico vê valores da OS' },
  'fluxo.fechar_apontamento_esquecido': {
    rotulo: 'Fechar cronômetro esquecido no fim do turno',
    descricao: 'Sem isso, um cronômetro esquecido na sexta vira 72 horas de mão de obra na segunda.',
  },
  'fluxo.hora_fechamento_automatico': { rotulo: 'Horário do fechamento automático' },

  // ---------------- compartilhamento ----------------
  'compartilhamento.ativo_global': {
    rotulo: 'Ativar acompanhamento pelo cliente',
    descricao: 'Chave geral. Desligado aqui, nenhum link funciona.',
  },
  'compartilhamento.gerar_automatico_ao_iniciar': {
    rotulo: 'Gerar o link automaticamente',
    descricao: 'O link nasce junto com o início da execução, sem ninguém precisar clicar.',
  },
  'compartilhamento.dias_validade': {
    rotulo: 'Validade do link',
    descricao: 'Use 0 para link sem expiração.',
    unidade: 'dias',
  },
  'compartilhamento.exigir_pin': {
    rotulo: 'Exigir código de acesso',
    descricao: 'Por padrão, os 4 últimos caracteres da placa — fácil de ditar por telefone.',
  },
  'compartilhamento.mostrar_itens': { rotulo: 'Mostrar a lista de serviços' },
  'compartilhamento.mostrar_valores': { rotulo: 'Mostrar valores' },
  'compartilhamento.mostrar_nome_mecanico': { rotulo: 'Mostrar o nome do mecânico' },
  'compartilhamento.mostrar_paradas': { rotulo: 'Avisar quando o serviço estiver parado' },
  'compartilhamento.mostrar_motivo_parada': {
    rotulo: 'Mostrar o motivo da parada',
    descricao: 'Desligado, o cliente vê apenas "aguardando etapa externa".',
  },
  'compartilhamento.mostrar_previsao_entrega': { rotulo: 'Mostrar a previsão de entrega' },
  'compartilhamento.mostrar_fotos': {
    rotulo: 'Mostrar fotos',
    descricao: 'Somente as fotos marcadas como visíveis ao cliente.',
  },
  'compartilhamento.mostrar_tempo_trabalhado': { rotulo: 'Mostrar horas trabalhadas' },

  // ---------------- alertas ----------------
  'alertas.dias_sem_movimentacao': {
    rotulo: 'Marcar como parado depois de',
    descricao: 'Dias sem nenhum apontamento. O carro sobe para o topo do quadro em vermelho.',
    unidade: 'dias',
  },
  'alertas.dias_pronto_sem_retirada': {
    rotulo: 'Alertar carro pronto não retirado depois de',
    descricao: 'Carro pronto ocupando vaga é dinheiro parado.',
    unidade: 'dias',
  },
  'alertas.percentual_estouro_estimativa': {
    rotulo: 'Alertar estouro de tempo acima de',
    unidade: '%',
  },
  'alertas.dias_antes_previsao': {
    rotulo: 'Avisar antes da entrega prometida',
    unidade: 'dias',
  },

  // ---------------- integracao ----------------
  'integracao.email_leituras_ativo': {
    rotulo: 'Ler os relatórios do scanner por e-mail',
    ordem: 1,
    descricao:
      'O tablet manda o PDF para a caixa da oficina e o sistema busca sozinho. A leitura entra como "Falta completar" — o PDF não diz de que carro é nem se o motor estava ligado.',
  },
  'integracao.email_assunto': {
    rotulo: 'Palavra que precisa estar no assunto',
    ordem: 3,
    descricao: 'E-mail sem essa palavra no assunto é ignorado. Acento e maiúscula não importam.',
  },
  'integracao.email_remetentes': {
    rotulo: 'De quem aceitar',
    ordem: 2,
    descricao:
      'E-mails separados por vírgula. Vazio significa ninguém: nada entra. É a trava principal — qualquer um pode escrever para a caixa.',
  },
  'integracao.email_intervalo_minutos': {
    rotulo: 'De quanto em quanto tempo olhar a caixa',
    ordem: 4,
    unidade: 'min',
  },
  'integracao.email_pasta': {
    rotulo: 'Pasta da caixa',
    ordem: 5,
    descricao: 'Normalmente INBOX. Use outra se houver um filtro separando os relatórios.',
  },

  // ---------------- aparencia ----------------
  'app.nome_oficina': { rotulo: 'Nome da oficina' },
  'app.cor_marca': {
    rotulo: 'Cor principal',
    descricao: 'Menu ativo, botões e links. As cores de situação do pátio — azul andando, âmbar parado, vermelho impedimento, verde pronto — não mudam: elas têm significado.',
    cor: true,
  },
  'app.cor_destaque': {
    rotulo: 'Cor de destaque',
    descricao: 'O botão AGENDAR CARRO, a faixa de segurança e o contorno do elevador. O texto por cima fica preto ou branco sozinho, pelo contraste.',
    cor: true,
  },
  'app.patio_colunas': {
    rotulo: 'Colunas da planta do pátio',
    descricao: 'Quantas vagas cabem lado a lado quando você arruma a planta pelo cadeado.',
  },
  'app.modo_tv': {
    rotulo: 'Habilitar o modo TV',
    descricao: 'Quadro do dia em tela cheia, para pendurar um monitor na oficina.',
  },
}

export const GRUPOS: { chave: string; titulo: string; descricao: string }[] = [
  {
    chave: 'CAPACIDADE',
    titulo: 'Capacidade',
    descricao: 'Quanto a oficina aguenta. O dia fica cheio pelo limite mais restritivo entre os que você ligar.',
  },
  {
    chave: 'FLUXO',
    titulo: 'Fluxo e permissões',
    descricao: 'O que o sistema exige em cada etapa e o que cada perfil pode fazer.',
  },
  {
    chave: 'COMPARTILHAMENTO',
    titulo: 'Acompanhamento do cliente',
    descricao: 'Padrão para toda a oficina. Cada cliente e cada OS podem ter ajuste próprio.',
  },
  {
    chave: 'ALERTAS',
    titulo: 'Alertas',
    descricao: 'O que acende a luz vermelha no quadro e no radar.',
  },
  {
    chave: 'INTEGRACAO',
    titulo: 'Entrada por e-mail',
    descricao:
      'O endereço e a senha da caixa ficam fora daqui, em variável de ambiente (APP_IMAP_*): esta tela é legível por qualquer usuário do sistema. Sem essas variáveis no servidor, ligar a chave abaixo não conecta em nada.',
  },
  {
    chave: 'APARENCIA',
    titulo: 'Aparência',
    descricao:
      'O nome, as cores e a planta do pátio. As cores de situação — azul andando, âmbar parado, vermelho impedimento, verde pronto — não entram aqui: elas têm significado e passaram por teste de daltonismo.',
  },
]
