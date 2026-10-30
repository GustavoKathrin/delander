import { useState } from 'react'
import { ChevronDown, ChevronUp, History } from 'lucide-react'

import { Cartao, Vazio, cx } from '../../components/ui'
import { dataHora, horaMinuto, horas } from '../../lib/format'
import type { DetalheOs } from '../../types'

/**
 * O que já aconteceu com esta OS, fechado.
 *
 * Linha do tempo, horas apontadas e paradas eram três cartões soltos abaixo
 * do cartão da etapa, sempre abertos. Nenhum dos três é campo de etapa
 * nenhuma: são registro do que passou, e registro não compete com o próximo
 * passo pelo meio da tela. O dono, olhando a OS: "não precisa desses card
 * embaixo, os campos estão dentro das etapas, não fora delas".
 *
 * Some — mas não vira ausência. Conferir quando o carro parou e quem apontou
 * hora é coisa que se faz, e continua a um toque. O que muda é quem manda na
 * tela: quem abre a OS vê a etapa, e não três listas de arquivo morto.
 */
export function HistoricoDaOs({ os }: { os: DetalheOs }) {
  const [aberto, setAberto] = useState(false)

  const quantos = os.eventos.length + os.apontamentos.length + os.paradas.length
  if (quantos === 0) return null

  return (
    <div className="sem-impressao overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex min-h-12 w-full items-center gap-2 px-4 text-left transition hover:bg-slate-50"
      >
        <History className="size-4 flex-none text-slate-400" aria-hidden />
        <span className="flex-1 text-sm font-medium text-slate-700">
          O que já aconteceu com este carro
        </span>
        <span className="text-xs text-slate-500">
          {os.eventos.length} na linha do tempo
          {os.apontamentos.length > 0 && ` · ${os.apontamentos.length} apontamento${os.apontamentos.length > 1 ? 's' : ''}`}
          {os.paradas.length > 0 && ` · ${os.paradas.length} parada${os.paradas.length > 1 ? 's' : ''}`}
        </span>
        {aberto ? (
          <ChevronUp className="size-4 flex-none text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="size-4 flex-none text-slate-400" aria-hidden />
        )}
      </button>

      {aberto && (
        <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Linha do tempo
            </h3>
            {os.eventos.length === 0 ? (
              <Vazio icone={<History className="size-8" />} titulo="Sem eventos ainda" />
            ) : (
              <ol className="space-y-0">
                {[...os.eventos].reverse().map((evento, indice) => (
                  <li key={evento.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cx(
                          'mt-1.5 size-2 flex-none rounded-full',
                          indice === 0 ? 'bg-marca-600' : 'bg-slate-300',
                        )}
                        aria-hidden
                      />
                      {indice < os.eventos.length - 1 && (
                        <span className="w-px flex-1 bg-slate-200" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-3">
                      <p className="text-sm text-slate-800">{evento.descricao ?? evento.tipo}</p>
                      <p className="text-[11px] text-slate-500">
                        {dataHora(evento.quando)}
                        {evento.autor && ` · ${evento.autor}`}
                        {evento.visivelCliente && ' · visível ao cliente'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="space-y-4">
            {os.apontamentos.length > 0 && (
              <Cartao>
                <h3 className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Horas apontadas
                </h3>
                <ul className="divide-y divide-slate-100">
                  {[...os.apontamentos].reverse().map((a) => (
                    <li key={a.id} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-slate-700">
                          {a.funcionarioNome}
                        </p>
                        <span
                          className={cx(
                            'text-xs font-semibold',
                            a.fim ? 'text-slate-700' : 'text-blue-600',
                          )}
                        >
                          {horas(a.horas)}
                          {!a.fim && ' (rodando)'}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-slate-500">{a.itemDescricao}</p>
                      <p className="text-[11px] text-slate-500">
                        {horaMinuto(a.inicio)} → {a.fim ? horaMinuto(a.fim) : '...'}
                        {a.horasEstimadasInformadas &&
                          ` · previu ${horas(a.horasEstimadasInformadas)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}

            {os.paradas.length > 0 && (
              <Cartao>
                <h3 className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Paradas
                </h3>
                <ul className="divide-y divide-slate-100">
                  {[...os.paradas].reverse().map((p) => (
                    <li key={p.id} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-slate-700">{p.motivo}</p>
                        <span
                          className={cx(
                            'text-xs font-semibold',
                            p.fim ? 'text-slate-700' : 'text-orange-600',
                          )}
                        >
                          {horas(p.horas)}
                          {!p.fim && ' (em aberto)'}
                        </span>
                      </div>
                      {p.descricao && <p className="text-[11px] text-slate-500">{p.descricao}</p>}
                      <p className="text-[11px] text-slate-500">
                        desde {dataHora(p.inicio)}
                        {p.visivelCliente ? ' · visível ao cliente' : ' · interno'}
                      </p>
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
