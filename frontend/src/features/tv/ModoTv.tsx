import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, PauseCircle } from 'lucide-react'
import { api } from '../../api/client'
import type { Quadro } from '../../types'
import { Carregando, cx, useTique } from '../../components/ui'
import { corSemaforo, dataCurta, decorrido, horas } from '../../lib/format'
import { LogoDelander } from '../../components/LogoDelander'

/** Quadro do dia em tela cheia, para pendurar um monitor na oficina. */
export default function ModoTv() {
  const agora = useTique()

  const hoje = new Date()
  const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(
    hoje.getDate(),
  ).padStart(2, '0')}`

  const consulta = useQuery({
    queryKey: ['quadro-tv', inicio],
    queryFn: () => api<Quadro>(`/quadro?inicio=${inicio}&dias=3`),
    refetchInterval: 45_000,
  })

  if (consulta.isLoading) return <Carregando texto="Carregando o quadro..." />

  const quadro = consulta.data!
  const relogio = new Date(agora).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      <header className="mb-6 flex items-center gap-4">
        <div>
          <LogoDelander altura={40} variante="escuro" />
          <p className="mt-1 text-sm text-slate-400">
            {quadro.semana.carros} carro(s) na semana · {horas(quadro.semana.horasAlocadas)} de{' '}
            {horas(quadro.semana.horasDisponiveis)} · fila de {horas(quadro.backlogHoras)}
          </p>
        </div>
        <p className="ml-auto font-mono text-3xl font-bold tabular-nums">{relogio}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {quadro.dias.map((dia) => (
          <section key={dia.data} className="rounded-xl bg-slate-800/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold capitalize">
                {dia.hoje ? 'Hoje' : dia.diaSemana}{' '}
                <span className="text-sm font-normal text-slate-400">{dataCurta(dia.data)}</span>
              </h2>
              <span className="flex items-center gap-2 text-sm text-slate-300">
                <span
                  className={cx('size-3 rounded-full', corSemaforo(dia.capacidade.semaforo))}
                  aria-hidden
                />
                {dia.capacidade.percentual}%
              </span>
            </div>

            {dia.ordens.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {dia.funciona ? 'Dia livre' : 'Oficina fechada'}
              </p>
            ) : (
              <ul className="space-y-2">
                {dia.ordens.map((os) => {
                  const critico = os.alertas.some((a) => a.severidade === 'ALTA')
                  return (
                    <li
                      key={os.id}
                      className={cx(
                        'rounded-lg p-3',
                        critico ? 'bg-red-950/60 ring-1 ring-red-700' : 'bg-slate-900/70',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-bold">{os.placa}</span>
                        {os.emAndamento && (
                          <span className="size-2.5 rounded-full bg-blue-400 pulsando" aria-hidden />
                        )}
                        {os.paradaMotivo && (
                          <PauseCircle className="size-4 text-orange-400" aria-hidden />
                        )}
                        <span className="ml-auto text-sm text-slate-300">
                          {os.mecanicos[0]?.split(' ')[0] ?? '—'}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-300">{os.veiculo}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                        <span>{os.statusDescricao}</span>
                        {os.boxNome && <span>· {os.boxNome}</span>}
                        <span className="ml-auto">
                          {horas(os.horasTrabalhadas)}/{horas(os.horasEstimadas)}
                        </span>
                      </div>
                      {os.horasEstimadas > 0 && (
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                          <div
                            className={cx(
                              'h-full rounded-full',
                              os.percentualExecutado > 110 ? 'bg-red-500' : 'bg-marca-500',
                            )}
                            style={{ width: `${Math.min(os.percentualExecutado, 100)}%` }}
                          />
                        </div>
                      )}
                      {critico && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-300">
                          <AlertTriangle className="size-3" aria-hidden />
                          {os.alertas.find((a) => a.severidade === 'ALTA')?.texto}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {quadro.fila.length > 0 && (
        <section className="mt-4 rounded-xl bg-slate-800/60 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            Fila de espera ({quadro.fila.length}) · {horas(quadro.backlogHoras)} de trabalho
          </h2>
          <div className="flex flex-wrap gap-2">
            {quadro.fila.map((item) => (
              <span
                key={item.os.id}
                className="flex items-center gap-2 rounded-lg bg-slate-900/70 px-3 py-1.5"
              >
                <span className="text-xs font-bold text-slate-400">{item.posicao}º</span>
                <span className="font-mono text-sm">{item.os.placa}</span>
                <span
                  className={cx(
                    'text-xs capitalize',
                    item.entradaPrevista ? 'text-slate-400' : 'text-red-400',
                  )}
                >
                  {item.entradaPrevistaRotulo}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
