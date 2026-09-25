// Tipos espelhando os DTOs da API.

export type Papel = 'DONO' | 'GERENTE' | 'RECEPCAO' | 'MECANICO'

export type StatusOs =
  | 'RECEBIDO'
  | 'EM_DIAGNOSTICO'
  | 'AGUARDANDO_APROVACAO'
  | 'ORCAMENTO_APROVADO'
  | 'AGENDADO'
  | 'EM_EXECUCAO'
  | 'PAUSADO'
  | 'PRONTO_AGUARDANDO_RETIRADA'
  | 'ENTREGUE'
  | 'CANCELADO'

export type StatusItem = 'PENDENTE' | 'EM_EXECUCAO' | 'PAUSADO' | 'CONCLUIDO' | 'CANCELADO'

export type Prioridade = 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE'

export type CategoriaParada =
  | 'PECA'
  | 'APROVACAO'
  | 'TERCEIRO'
  | 'CLIENTE'
  | 'INTERNO'
  | 'PAGAMENTO'

export type StatusPeca = 'SOLICITADA' | 'COMPRADA' | 'RECEBIDA' | 'APLICADA' | 'CANCELADA'

export type TipoBox = 'ELEVADOR' | 'BOX' | 'PATIO'

export interface Usuario {
  id: string
  nome: string
  email: string
  papel: Papel
  papelDescricao: string
  funcionarioId: string | null
  gerencia: boolean
}

export interface TokenResposta {
  accessToken: string
  refreshToken: string
  expiraEmSegundos: number
  usuario: Usuario
}

export interface Alerta {
  tipo: string
  texto: string
  severidade: 'ALTA' | 'MEDIA'
}

export interface ResumoOs {
  id: string
  numero: number
  placa: string
  veiculo: string
  cor?: string
  veiculoId: string
  clienteId: string
  clienteNome: string
  clienteTelefone?: string
  status: StatusOs
  statusDescricao: string
  prioridade: Prioridade
  boxId?: string
  boxNome?: string
  dataAgendada?: string
  previsaoEntrega?: string
  queixa?: string
  horasEstimadas: number
  horasTrabalhadas: number
  percentualExecutado: number
  diasNaOficina: number
  diasSemMovimentacao: number
  diasAguardandoRetirada: number
  atrasada: boolean
  emAndamento: boolean
  paradaMotivo?: string
  paradaCategoria?: CategoriaParada
  horasParado: number
  mecanicos: string[]
  especialidades: string[]
  alertas: Alerta[]
  compartilhado: boolean
  precisaElevador: boolean
  /** Peça: ESPERANDO pede telefone ao fornecedor, CHEGOU pede mecânico. */
  pecas: 'NENHUMA' | 'ESPERANDO' | 'CHEGOU'
}

export interface ItemOs {
  id: string
  descricao: string
  especialidadeId?: string
  especialidadeNome?: string
  especialidadeCor?: string
  horasEstimadas: number
  horasTrabalhadas: number
  funcionarioId?: string
  funcionarioNome?: string
  status: StatusItem
  statusDescricao: string
  valor?: number
  apontamentoAberto: boolean
  apontamentoInicio?: string
}

export interface ApontamentoOs {
  id: string
  osItemId: string
  itemDescricao: string
  funcionarioId: string
  funcionarioNome: string
  inicio: string
  fim?: string
  horas: number
  horasEstimadasInformadas?: number
  observacao?: string
  encerradoAutomaticamente: boolean
}

export interface ParadaOs {
  id: string
  motivoId: string
  motivo: string
  categoria: CategoriaParada
  inicio: string
  fim?: string
  horas: number
  descricao?: string
  visivelCliente: boolean
}

export interface PecaOs {
  id: string
  descricao: string
  quantidade: number
  fornecedor?: string
  status: StatusPeca
  statusDescricao: string
  previsaoChegada?: string
  valorUnitario?: number
  total: number
}

export interface EventoOs {
  id: string
  tipo: string
  descricao?: string
  autor?: string
  quando: string
  visivelCliente: boolean
}

export interface ArquivoOs {
  id: string
  nome: string
  url: string
  momento: string
  visivelCliente: boolean
  quando: string
}

export interface ChecklistOs {
  id: string
  descricao: string
  ok?: boolean
  observacao?: string
}

export interface CompartilhamentoOs {
  id: string
  url: string
  token: string
  pin?: string
  expiraEm?: string
  ativo: boolean
  totalAcessos: number
  ultimoAcessoEm?: string
  escopo: Record<string, boolean>
}

export interface DetalheOs {
  resumo: ResumoOs
  diagnostico?: string
  kmEntrada?: number
  entradaEm: string
  aprovadoEm?: string
  inicioExecucaoEm?: string
  prontoEm?: string
  entregueEm?: string
  valorPecas: number
  valorMaoObra: number
  desconto: number
  valorTotal: number
  proximosStatus: StatusOs[]
  itens: ItemOs[]
  apontamentos: ApontamentoOs[]
  paradas: ParadaOs[]
  pecas: PecaOs[]
  checklist: ChecklistOs[]
  arquivos: ArquivoOs[]
  eventos: EventoOs[]
  compartilhamento?: CompartilhamentoOs
}

export interface CapacidadeDia {
  data: string
  horasDisponiveis: number
  horasAlocadas: number
  horasLivres: number
  carros: number
  maxCarros: number
  boxesTotal: number
  boxesOcupados: number
  percentual: number
  semaforo: 'verde' | 'amarelo' | 'vermelho' | 'fechado'
  cheio: boolean
  limitante: string
}

export interface DiaQuadro {
  data: string
  diaSemana: string
  funciona: boolean
  hoje: boolean
  capacidade: CapacidadeDia
  ordens: ResumoOs[]
}

export interface ItemFila {
  posicao: number
  os: ResumoOs
  horasNecessarias: number
  diasEsperando: number
  entradaPrevista?: string
  entradaPrevistaRotulo: string
}

export interface Fila {
  itens: ItemFila[]
  backlogHoras: number
  proximaVagaLivre?: string
  vagasLivresHoje: number
  vagasTotal: number
}

export interface Quadro {
  inicio: string
  fim: string
  titulo: string
  dias: DiaQuadro[]
  fila: ItemFila[]
  backlogHoras: number
  semana: {
    horasDisponiveis: number
    horasAlocadas: number
    carros: number
    maxCarrosSemana: number
    percentual: number
    semaforo: string
  }
}

export type SituacaoVaga =
  | 'LIVRE'
  | 'RESERVADO'
  | 'AGENDADO'
  | 'AGUARDANDO'
  | 'EM_EXECUCAO'
  | 'PARADO'
  | 'PRONTO'

export interface Vaga {
  id: string
  nome: string
  tipo: TipoBox
  ocupante?: ResumoOs
  situacao: SituacaoVaga
  situacaoRotulo: string
  impedimento?: string
  liberaEm?: string
  liberaEmRotulo?: string
  /** So em vaga de elevador, e so quando ha reserva viva. */
  reserva?: ReservaElevador
  /** Onde a vaga fica na planta. Nulo = planta automatica. */
  layoutColuna?: number
  layoutLinha?: number
  layoutLargura: number
  layoutAltura: number
}

/** Uma subida no elevador. A vaga corre em dia; o elevador, em hora. */
export interface ReservaElevador {
  id: string
  boxId: string
  boxNome: string
  osId: string
  placa: string
  status: "RESERVADO" | "EM_USO" | "CONCLUIDO" | "CANCELADO"
  statusDescricao: string
  inicioPrevisto: string
  horasPrevistas: number
  terminoPrevisto: string
  inicioReal?: string
  /** "sobe hoje 15:20" ou "desce em 1h20". */
  rotulo: string
  /** Negativo quando passou da hora; so vem quando EM_USO. */
  minutosRestantes?: number
}

export interface ItemFilaElevador {
  posicao: number
  os: ResumoOs
  horasPrevistas: number
  boxSugeridoId?: string
  boxSugeridoNome?: string
  inicioPrevisto?: string
  rotulo: string
}

export interface FilaElevador {
  itens: ItemFilaElevador[]
  emUso: ReservaElevador[]
  total: number
  livresAgora: number
  proximoLivre?: string
  proximoLivreRotulo: string
}

export interface Patio {
  vagas: Vaga[]
  semVaga: ResumoOs[]
  fila: ItemFila[]
  vagasLivres: number
  vagasTotal: number
  proximaVagaLivre?: string
  proximaVagaLivreRotulo: string
  backlogHoras: number
  elevadores: FilaElevador
}

export interface Sugestao {
  data: string
  rotulo: string
  horasLivres: number
  vagasLivres: number
  percentualOcupacao: number
}

export interface MeuServico {
  itemId: string
  osId: string
  numeroOs: number
  placa: string
  veiculo: string
  cor?: string
  cliente: string
  queixa?: string
  descricao: string
  especialidade?: string
  especialidadeCor?: string
  horasEstimadas: number
  horasTrabalhadas: number
  status: StatusItem
  statusDescricao: string
  statusOs: StatusOs
  prioridade: Prioridade
  dataAgendada?: string
  previsaoEntrega?: string
  box?: string
  apontamentoAbertoId?: string
  apontamentoInicio?: string
  horasEstimadasInformadas?: number
  mecanicoNome?: string
  meu: boolean
  precisaElevador: boolean
}

export interface Especialidade {
  id: string
  nome: string
  cor: string
  ativo: boolean
}

export interface Box {
  id: string
  nome: string
  tipo: TipoBox
  ativo: boolean
  layoutColuna?: number
  layoutLinha?: number
  layoutLargura: number
  layoutAltura: number
}

export interface MotivoParada {
  id: string
  nome: string
  categoria: CategoriaParada
  categoriaDescricao: string
  bloqueiaExecucao: boolean
  visivelClientePadrao: boolean
  ativo: boolean
}

export interface ServicoCatalogo {
  id: string
  descricao: string
  especialidadeId?: string
  especialidadeNome?: string
  especialidadeCor?: string
  horasPadrao: number
  precoSugerido?: number
  exigeElevador: boolean
  ativo: boolean
}

export interface VeiculoResumo {
  id: string
  placa: string
  descricao: string
  marca?: string
  modelo?: string
  ano?: number
  cor?: string
  km?: number
}

export interface Cliente {
  id: string
  nome: string
  documento?: string
  telefone?: string
  email?: string
  observacoes?: string
  consentimentoContato: boolean
  compartilhamentoHabilitado?: boolean | null
  escopoCompartilhamento?: Record<string, boolean>
  ativo: boolean
  anonimizado: boolean
  veiculos: VeiculoResumo[]
}

export interface Funcionario {
  id: string
  nome: string
  telefone?: string
  horasPorDia: number
  custoHora?: number
  ativo: boolean
  usuarioId?: string
  email?: string
  papel?: Papel
  papelDescricao?: string
  especialidades: Especialidade[]
}

export interface ConfiguracaoItem {
  chave: string
  valor: string
  tipo: 'BOOLEAN' | 'INTEIRO' | 'DECIMAL' | 'TEXTO' | 'JSON' | 'HORA'
  grupo: string
}

export interface PecaPendente {
  id: string
  osId: string
  numeroOs: number
  placa: string
  cliente: string
  descricao: string
  quantidade: number
  fornecedor?: string
  status: StatusPeca
  statusDescricao: string
  previsaoChegada?: string
}

export interface Painel {
  resumo: {
    carrosNoPatio: number
    emExecucao: number
    aguardando: number
    prontosNaoRetirados: number
    diasMedioAguardandoRetirada: number
    ocupacaoBoxesPercentual: number
    boxesTotal: number
    boxesOcupados: number
    elevadoresTotal: number
    elevadoresOcupados: number
    naFilaDoElevador: number
    recebidos: number
    entregues: number
    saldoPatio: number
    backlogHoras: number
    permanenciaMediaDias: number
    maoObraMediaHoras: number
    aproveitamentoPercentual: number
    horasParadoMedia: number
    aderenciaEstimativaPercentual: number
    osComEstouro: number
    primeiraFolga?: Sugestao
  }
  paradas: {
    motivo: string
    categoria: CategoriaParada
    ocorrencias: number
    horas: number
    percentual: number
    acumulado: number
  }[]
  throughput: { inicio: string; fim: string; recebidos: number; entregues: number }[]
  mecanicos: {
    nome: string
    servicos: number
    horasTrabalhadas: number
    horasEstimadas: number
    aderenciaPercentual: number
  }[]
}

export interface AcompanhamentoPublico {
  oficina: string
  numeroOs: number
  placa: string
  veiculo: string
  cor?: string
  cliente: string
  status: StatusOs
  statusDescricao: string
  mensagem: string
  progresso: number
  previsaoEntrega?: string
  horasTrabalhadas?: number
  valorTotal?: number
  itens: { descricao: string; status: string; concluido: boolean; mecanico?: string }[]
  parada?: { motivo: string; desde: string; horas: number }
  timeline: { tipo: string; descricao?: string; quando: string }[]
  /** Foto no link do cliente. O momento separa o checklist de entrada do serviço. */
  fotos: { url: string; momento: string }[]
  entradaEm: string
  prontoEm?: string
}

export interface Pagina<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

// ==================================================================== leituras

export type TipoLeitura = 'OFICIAL' | 'ANOMALIA'
export type OrigemLeitura = 'PDF' | 'MANUAL' | 'EMAIL'
export type SituacaoLeitura = 'PENDENTE' | 'COMPLETA'

export interface ItemLeitura {
  id?: string
  numero?: number
  nome: string
  valor?: string
  valorNumerico?: number
  minimo?: number
  maximo?: number
  unidade?: string
  foraDaFaixa: boolean
}

export interface ModuloLeitura {
  id?: string
  nome: string
  caminho?: string
  itens: ItemLeitura[]
}

export interface ResumoLeitura {
  id: string
  veiculoId?: string
  placa?: string
  marca?: string
  modelo?: string
  ano?: number
  motor?: string
  modeloDescricao: string
  tipo: TipoLeitura
  tipoDescricao: string
  condicao?: string
  motorLigado: boolean
  ignicaoLigada: boolean
  origem: OrigemLeitura
  situacao: SituacaoLeitura
  momentoTeste?: string
  km?: number
  modulos: number
  itens: number
  temPdf: boolean
}

export interface DetalheLeitura {
  resumo: ResumoLeitura
  descricao?: string
  ferramenta?: string
  ferramentaVersao?: string
  numeroRelatorio?: string
  ordemServicoId?: string
  arquivoId?: string
  modulos: ModuloLeitura[]
}

/** Rascunho da importacao: nada disso foi gravado ainda, fora o PDF. */
export interface PreviaLeitura {
  arquivoId: string
  marca?: string
  modelo?: string
  ano?: number
  km?: number
  placaSugerida?: string
  veiculoSugeridoId?: string
  veiculoSugeridoDescricao?: string
  ferramenta?: string
  ferramentaVersao?: string
  numeroRelatorio?: string
  momentoTeste?: string
  modulos: ModuloLeitura[]
  avisos: string[]
}

// ==================================================================== wiki

export interface FotoWiki {
  id: string
  url: string
  legenda?: string
  ordem: number
}

export interface ResumoArtigo {
  id: string
  titulo: string
  alcance: string
  marca?: string
  modelo?: string
  motor?: string
  anoDe?: number
  anoAte?: number
  tags: string[]
  publicado: boolean
  autor?: string
  criadoEm?: string
  atualizadoEm?: string
  fotos: number
  previa: string
}

export interface DetalheArtigo {
  resumo: ResumoArtigo
  corpo: string
  veiculoId?: string
  ordemServicoId?: string
  leituraId?: string
  fotos: FotoWiki[]
}
