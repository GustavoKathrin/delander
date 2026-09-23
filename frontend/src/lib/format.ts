import type { Prioridade, StatusItem, StatusOs } from '../types'

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/** "2026-09-18" -> Date local (sem susto de fuso). */
export function dataLocal(iso?: string | null): Date | null {
  if (!iso) return null
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return new Date(iso)
  return new Date(ano, mes - 1, dia)
}

export function dataCurta(iso?: string | null): string {
  const d = dataLocal(iso)
  if (!d) return '-'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function dataCompleta(iso?: string | null): string {
  const d = dataLocal(iso)
  if (!d) return '-'
  return d.toLocaleDateString('pt-BR')
}

export function diaSemanaCurto(iso?: string | null): string {
  const d = dataLocal(iso)
  return d ? DIAS_CURTOS[d.getDay()] : ''
}

export function horaMinuto(iso?: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function dataHora(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function moeda(valor?: number | null): string {
  if (valor === null || valor === undefined) return '-'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** 2.5 -> "2h30". O mecanico le isso mais rapido que "2,5 h". */
export function horas(valor?: number | null): string {
  if (valor === null || valor === undefined) return '0h'
  const total = Math.max(Math.round(valor * 60), 0)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/** Cronometro ao vivo a partir do inicio do apontamento. */
export function decorrido(inicioIso: string, agora: number = Date.now()): string {
  const inicio = new Date(inicioIso).getTime()
  const segundos = Math.max(Math.floor((agora - inicio) / 1000), 0)
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function diasTexto(dias: number): string {
  if (dias <= 0) return 'hoje'
  return dias === 1 ? '1 dia' : `${dias} dias`
}

// ------------------------------------------------------------------ cores

export const CORES_STATUS: Record<StatusOs, { chip: string; barra: string; rotulo: string }> = {
  RECEBIDO: { chip: 'bg-slate-100 text-slate-700 ring-slate-200', barra: 'bg-slate-400', rotulo: 'Recebido' },
  EM_DIAGNOSTICO: {
    chip: 'bg-violet-100 text-violet-700 ring-violet-200',
    barra: 'bg-violet-500',
    rotulo: 'Em diagnóstico',
  },
  AGUARDANDO_APROVACAO: {
    chip: 'bg-amber-100 text-amber-800 ring-amber-200',
    barra: 'bg-amber-500',
    rotulo: 'Aguardando aprovação',
  },
  AGENDADO: { chip: 'bg-sky-100 text-sky-700 ring-sky-200', barra: 'bg-sky-500', rotulo: 'Agendado' },
  EM_EXECUCAO: {
    chip: 'bg-blue-100 text-blue-700 ring-blue-200',
    barra: 'bg-blue-600',
    rotulo: 'Em execução',
  },
  PAUSADO: {
    chip: 'bg-orange-100 text-orange-800 ring-orange-200',
    barra: 'bg-orange-500',
    rotulo: 'Pausado',
  },
  PRONTO_AGUARDANDO_RETIRADA: {
    chip: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    barra: 'bg-emerald-500',
    rotulo: 'Pronto',
  },
  ENTREGUE: {
    chip: 'bg-teal-50 text-teal-700 ring-teal-200',
    barra: 'bg-teal-500',
    rotulo: 'Entregue',
  },
  CANCELADO: {
    chip: 'bg-slate-100 text-slate-500 ring-slate-200',
    barra: 'bg-slate-300',
    rotulo: 'Cancelado',
  },
}

export const CORES_PRIORIDADE: Record<Prioridade, string> = {
  BAIXA: 'bg-slate-100 text-slate-600 ring-slate-200',
  NORMAL: 'bg-slate-100 text-slate-700 ring-slate-200',
  ALTA: 'bg-amber-100 text-amber-800 ring-amber-200',
  URGENTE: 'bg-red-100 text-red-700 ring-red-200',
}

export const CORES_ITEM: Record<StatusItem, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600 ring-slate-200',
  EM_EXECUCAO: 'bg-blue-100 text-blue-700 ring-blue-200',
  PAUSADO: 'bg-orange-100 text-orange-800 ring-orange-200',
  CONCLUIDO: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  CANCELADO: 'bg-slate-100 text-slate-400 ring-slate-200 line-through',
}

export function corSemaforo(semaforo: string): string {
  switch (semaforo) {
    case 'verde':
      return 'bg-emerald-500'
    case 'amarelo':
      return 'bg-amber-500'
    case 'vermelho':
      return 'bg-red-500'
    default:
      return 'bg-slate-300'
  }
}

export function textoSemaforo(semaforo: string): string {
  switch (semaforo) {
    case 'verde':
      return 'text-emerald-700'
    case 'amarelo':
      return 'text-amber-700'
    case 'vermelho':
      return 'text-red-700'
    default:
      return 'text-slate-500'
  }
}

/** Percentual limitado a 100 para a largura da barra. */
export function larguraBarra(percentual: number): string {
  return `${Math.max(Math.min(percentual, 100), 0)}%`
}

export function telefoneWhatsapp(telefone?: string | null): string | null {
  if (!telefone) return null
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length < 10) return null
  return digitos.startsWith('55') ? digitos : `55${digitos}`
}
