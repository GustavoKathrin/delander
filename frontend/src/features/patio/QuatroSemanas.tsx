import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { CapacidadeDia } from '../../types'
import { cx } from '../../components/ui'

/**
 * Como está cada semana, em uma olhada.
 *
 * Existe para o dono responder "quando dá?" com o cliente no telefone, sem
 * sair da conversa nem abrir outra tela. Consome `GET /api/capacidade`, que
 * já existia e ninguém usava: uma chamada, 28 dias.
 *
 * A cor nunca decide sozinha — cada dia mostra o número de vagas livres, e o
 * dia escolhido ganha anel. Dia fechado não é clicável.
 */

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function segundaDesta(d: Date): Date {
  const copia = new Date(d)
  const diaDaSemana = (copia.getDay() + 6) % 7 // domingo=6
  copia.setDate(copia.getDate() - diaDaSemana)
  copia.setHours(0, 0, 0, 0)
  return copia
}

/** Cor de fundo do dia. Mesma escala do semáforo do quadro da semana. */
function fundo(dia: CapacidadeDia | undefined): string {
  if (!dia || dia.semaforo === 'fechado') return 'bg-slate-100 text-slate-400'
  if (dia.semaforo === 'vermelho') return 'bg-red-500 text-white'
  if (dia.semaforo === 'amarelo') return 'bg-amber-400 text-amber-950'
  return 'bg-emerald-100 text-emerald-900'
}

export function QuatroSemanas({
  escolhido,
  onEscolher,
}: {
  escolhido?: string
  onEscolher: (data: string) => void
}) {
  const inicio = segundaDesta(new Date())
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 27)

  const consulta = useQuery({
    queryKey: ['capacidade-4-semanas', iso(inicio)],
    queryFn: () => api<CapacidadeDia[]>(`/capacidade?de=${iso(inicio)}&ate=${iso(fim)}`),
  })

  const porData = new Map((consulta.data ?? []).map((d) => [d.data, d]))
  const hoje = iso(new Date())

  const semanas = Array.from({ length: 4 }, (_, s) =>
    Array.from({ length: 7 }, (_, d) => {
      const dia = new Date(inicio)
      dia.setDate(dia.getDate() + s * 7 + d)
      return dia
    }),
  )

  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="fonte-display text-xs font-bold uppercase tracking-widest text-slate-500">
          Como estão as próximas 4 semanas
        </p>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" aria-hidden />
            livre
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-amber-400" aria-hidden />
            apertado
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-red-500" aria-hidden />
            cheio
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {d}
          </div>
        ))}

        {semanas.flat().map((dia) => {
          const chave = iso(dia)
          const info = porData.get(chave)
          const fechado = !info || info.semaforo === 'fechado'
          const livres = info ? Math.max(info.boxesTotal - info.boxesOcupados, 0) : 0

          return (
            <button
              key={chave}
              type="button"
              disabled={fechado}
              onClick={() => onEscolher(chave)}
              title={
                fechado
                  ? 'Oficina fechada'
                  : `${livres} vaga(s) livre(s) · ${info!.percentual}% da capacidade · o que aperta: ${info!.limitante}`
              }
              className={cx(
                // Alvo grande de proposito: isto e clicado de pe, no balcao
                // ou no celular, com o cliente esperando no telefone.
                'flex flex-col items-center justify-center rounded-md py-2 min-h-[3rem] transition',
                fundo(info),
                fechado ? 'cursor-not-allowed' : 'hover:brightness-95',
                chave === escolhido && 'ring-2 ring-marca-600 ring-offset-1',
                chave === hoje && chave !== escolhido && 'ring-1 ring-slate-400',
              )}
            >
              <span className="text-base font-extrabold leading-none tabular-nums sm:text-lg">
                {dia.getDate()}
              </span>
              {/* O texto decide junto com a cor, e nunca a contradiz: um dia
                  pode estar cheio de HORAS com vaga sobrando, e escrever
                  "4 vg" num quadrado vermelho só confundiria. */}
              <span className="mt-0.5 text-[11px] font-medium leading-tight opacity-90">
                {fechado ? '—' : info!.cheio ? 'cheio' : `${livres} vg`}
              </span>
            </button>
          )
        })}
      </div>

      {consulta.isLoading && (
        <p className="mt-2 text-center text-[11px] text-slate-400">Calculando a capacidade...</p>
      )}
    </div>
  )
}
