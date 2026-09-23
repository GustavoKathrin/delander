import { Link } from 'react-router-dom'
import { AlertTriangle, Clock, Link2, PauseCircle, Play, User } from 'lucide-react'
import type { ResumoOs } from '../../types'
import { CORES_PRIORIDADE, CORES_STATUS, horas } from '../../lib/format'
import { Barra, Etiqueta, cx } from '../../components/ui'
import { CarroTopo, Placa, SeloElevador } from '../../components/oficina'

interface Props {
  os: ResumoOs
  arrastavel?: boolean
  compacto?: boolean
  onArrastar?: (osId: string) => void
}

export default function CardOs({ os, arrastavel = false, compacto = false, onArrastar }: Props) {
  const cores = CORES_STATUS[os.status]
  const alertaAlto = os.alertas.some((a) => a.severidade === 'ALTA')
  const estourou = os.horasEstimadas > 0 && os.percentualExecutado > 110

  return (
    <Link
      to={`/os/${os.id}`}
      draggable={arrastavel}
      onDragStart={(e) => {
        if (!arrastavel) return
        e.dataTransfer.setData('text/plain', os.id)
        e.dataTransfer.effectAllowed = 'move'
        onArrastar?.(os.id)
      }}
      className={cx(
        'block rounded-lg bg-white p-2.5 text-left shadow-sm ring-1 transition hover:shadow-md',
        alertaAlto ? 'ring-red-300' : 'ring-slate-200',
        arrastavel && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {/* identificação */}
      <div className="mb-2 flex items-center gap-2">
        <CarroTopo cor={os.cor} largura={18} titulo={os.veiculo} />
        <Placa placa={os.placa} tamanho="sm" />
        {os.precisaElevador && <SeloElevador estado="PRECISA" />}
        {os.emAndamento && (
          <Play className="size-3 flex-none fill-blue-600 text-blue-600 pulsando" aria-label="Em execução" />
        )}
        {os.paradaMotivo && (
          <PauseCircle className="size-3.5 flex-none text-orange-500" aria-label="Pausado" />
        )}
        <span className="ml-auto text-[11px] text-slate-400">#{os.numero}</span>
        {os.compartilhado && (
          <Link2 className="size-3 flex-none text-slate-400" aria-label="Link com o cliente ativo" />
        )}
      </div>

      <p className="truncate text-xs font-medium text-slate-700">{os.veiculo}</p>
      <p className="truncate text-[11px] text-slate-500">{os.clienteNome}</p>

      {!compacto && os.queixa && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{os.queixa}</p>
      )}

      {/* tempo: estimado x realizado */}
      {os.horasEstimadas > 0 && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {horas(os.horasTrabalhadas)} / {horas(os.horasEstimadas)}
            </span>
            <span className={cx(estourou && 'font-semibold text-red-600')}>
              {os.percentualExecutado}%
            </span>
          </div>
          <Barra
            percentual={os.percentualExecutado}
            cor={estourou ? 'bg-red-500' : os.percentualExecutado >= 90 ? 'bg-amber-500' : 'bg-marca-600'}
            altura="h-1"
          />
        </div>
      )}

      {/* etiquetas */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Etiqueta className={cores.chip}>{os.statusDescricao}</Etiqueta>
        {os.prioridade !== 'NORMAL' && (
          <Etiqueta className={CORES_PRIORIDADE[os.prioridade]}>{os.prioridade}</Etiqueta>
        )}
        {os.boxNome && <Etiqueta>{os.boxNome}</Etiqueta>}
      </div>

      {/* quem está com o carro, em destaque */}
      {os.mecanicos.length > 0 ? (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-slate-100 px-1.5 py-1">
          <User className="size-3 flex-none text-slate-500" aria-hidden />
          <span className="fonte-display min-w-0 flex-1 truncate text-[12px] font-bold uppercase tracking-wide text-slate-900">
            {os.mecanicos[0]}
          </span>
          {os.mecanicos.length > 1 && (
            <span className="flex-none text-[10px] font-semibold text-slate-500">
              +{os.mecanicos.length - 1}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-1.5 rounded-md bg-amber-50 px-1.5 py-1 text-[11px] font-semibold text-amber-700">
          sem mecânico
        </p>
      )}

      {/* alertas: o que faz o carro esquecido gritar na tela */}
      {os.alertas.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {os.alertas.slice(0, compacto ? 1 : 3).map((alerta) => (
            <p
              key={alerta.tipo}
              className={cx(
                'flex items-start gap-1 text-[11px] leading-snug',
                alerta.severidade === 'ALTA' ? 'text-red-600' : 'text-amber-700',
              )}
            >
              <AlertTriangle className="mt-px size-3 flex-none" aria-hidden />
              {alerta.texto}
            </p>
          ))}
        </div>
      )}
    </Link>
  )
}
