import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Car,
  CheckCircle2,
  Clock,
  Hourglass,
  PartyPopper,
  PauseCircle,
  Wrench,
} from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import type { AcompanhamentoPublico } from '../../types'
import { Botao, Campo, Carregando, Entrada, cx } from '../../components/ui'
import { dataCompleta, dataHora, horas, moeda } from '../../lib/format'

export default function Acompanhar() {
  const { token = '' } = useParams()
  const [pin, setPin] = useState('')
  const [pinEnviado, setPinEnviado] = useState('')

  const consulta = useQuery({
    queryKey: ['acompanhar', token, pinEnviado],
    queryFn: () =>
      api<AcompanhamentoPublico>(
        `/publico/os/${encodeURIComponent(token)}${pinEnviado ? `?pin=${encodeURIComponent(pinEnviado)}` : ''}`,
        { publico: true },
      ),
    retry: false,
    refetchInterval: 120_000,
  })

  const erro = consulta.error as ErroApi | null
  const precisaPin = erro?.message?.toLowerCase().includes('codigo de acesso')

  if (consulta.isLoading) return <Carregando texto="Buscando a situação do seu veículo..." />

  if (precisaPin) {
    return (
      <Moldura>
        <div className="space-y-4 p-6">
          <h1 className="text-lg font-semibold text-slate-900">Acompanhar serviço</h1>
          <p className="text-sm text-slate-600">
            Digite o código de acesso que a oficina passou (por padrão, os 4 últimos caracteres da
            placa).
          </p>
          <Campo rotulo="Código de acesso">
            <Entrada
              autoFocus
              className="text-center font-mono text-lg uppercase tracking-widest"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && setPinEnviado(pin)}
            />
          </Campo>
          <Botao bloco tamanho="lg" onClick={() => setPinEnviado(pin)}>
            Ver meu veículo
          </Botao>
        </div>
      </Moldura>
    )
  }

  if (consulta.isError) {
    return (
      <Moldura>
        <div className="space-y-3 p-6 text-center">
          <Car className="mx-auto size-10 text-slate-300" aria-hidden />
          <h1 className="text-base font-semibold text-slate-900">Link indisponível</h1>
          <p className="text-sm text-slate-600">{erro?.message}</p>
          <p className="text-xs text-slate-400">Peça um link novo para a oficina.</p>
        </div>
      </Moldura>
    )
  }

  const os = consulta.data!
  const pronto = os.status === 'PRONTO_AGUARDANDO_RETIRADA'
  const entregue = os.status === 'ENTREGUE'

  return (
    <Moldura oficina={os.oficina}>
      <div className="space-y-5 p-5">
        {/* ---------------- veiculo ---------------- */}
        <div className="text-center">
          <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">{os.placa}</p>
          <p className="text-sm text-slate-600">{os.veiculo}</p>
          <p className="mt-1 text-xs text-slate-400">
            Olá, {os.cliente} · OS #{os.numeroOs}
          </p>
        </div>

        {/* ---------------- situacao ---------------- */}
        <div
          className={cx(
            'rounded-xl p-4 text-center ring-1',
            pronto
              ? 'bg-emerald-50 ring-emerald-200'
              : os.status === 'PAUSADO'
                ? 'bg-orange-50 ring-orange-200'
                : 'bg-marca-50 ring-marca-200',
          )}
        >
          <span
            className={cx(
              'mx-auto grid size-11 place-items-center rounded-full',
              pronto
                ? 'bg-emerald-600 text-white'
                : os.status === 'PAUSADO'
                  ? 'bg-orange-500 text-white'
                  : 'bg-marca-600 text-white',
            )}
          >
            {pronto || entregue ? (
              <PartyPopper className="size-5" aria-hidden />
            ) : os.status === 'PAUSADO' ? (
              <PauseCircle className="size-5" aria-hidden />
            ) : os.status === 'EM_EXECUCAO' ? (
              <Wrench className="size-5" aria-hidden />
            ) : (
              <Hourglass className="size-5" aria-hidden />
            )}
          </span>
          <p className="mt-2 text-base font-semibold text-slate-900">{os.statusDescricao}</p>
          <p className="mt-1 text-sm text-slate-600">{os.mensagem}</p>
        </div>

        {/* ---------------- progresso ---------------- */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Andamento</span>
            <span className="font-medium text-slate-700">{os.progresso}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={cx(
                'h-full rounded-full transition-all',
                pronto || entregue ? 'bg-emerald-500' : 'bg-marca-600',
              )}
              style={{ width: `${os.progresso}%` }}
            />
          </div>
        </div>

        {/* ---------------- parada ---------------- */}
        {os.parada && (
          <div className="flex items-start gap-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900 ring-1 ring-orange-200">
            <PauseCircle className="mt-0.5 size-4 flex-none" aria-hidden />
            <div>
              <p className="font-medium">{os.parada.motivo}</p>
              <p className="text-xs text-orange-700">
                Desde {dataHora(os.parada.desde)} ({horas(os.parada.horas)})
              </p>
            </div>
          </div>
        )}

        {/* ---------------- dados ---------------- */}
        <dl className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          <Linha rotulo="Entrada na oficina" valor={dataHora(os.entradaEm)} />
          {os.previsaoEntrega && (
            <Linha rotulo="Previsão de entrega" valor={dataCompleta(os.previsaoEntrega)} destaque />
          )}
          {os.horasTrabalhadas !== null && os.horasTrabalhadas !== undefined && (
            <Linha rotulo="Tempo de serviço já aplicado" valor={horas(os.horasTrabalhadas)} />
          )}
          {os.prontoEm && <Linha rotulo="Pronto desde" valor={dataHora(os.prontoEm)} destaque />}
          {os.valorTotal !== null && os.valorTotal !== undefined && (
            <Linha rotulo="Total" valor={moeda(os.valorTotal)} destaque />
          )}
        </dl>

        {/* ---------------- servicos ---------------- */}
        {os.itens.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Serviços</h2>
            <ul className="space-y-1.5">
              {os.itens.map((item, indice) => (
                <li
                  key={`${item.descricao}-${indice}`}
                  className="flex items-start gap-2 rounded-lg p-2.5 ring-1 ring-slate-200"
                >
                  {item.concluido ? (
                    <CheckCircle2 className="mt-0.5 size-4 flex-none text-emerald-600" aria-hidden />
                  ) : (
                    <Clock className="mt-0.5 size-4 flex-none text-slate-300" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p
                      className={cx(
                        'text-sm',
                        item.concluido ? 'text-slate-500 line-through' : 'text-slate-800',
                      )}
                    >
                      {item.descricao}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.status}
                      {item.mecanico && ` · ${item.mecanico}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------------- fotos ---------------- */}
        {os.fotos.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Fotos</h2>
            <div className="grid grid-cols-3 gap-2">
              {os.fotos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt="Foto do serviço no veículo"
                    loading="lazy"
                    className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ---------------- historico ---------------- */}
        {os.timeline.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Histórico</h2>
            <ol className="space-y-0">
              {[...os.timeline].reverse().map((evento, indice) => (
                <li key={`${evento.quando}-${indice}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cx(
                        'mt-1.5 size-2 flex-none rounded-full',
                        indice === 0 ? 'bg-marca-600' : 'bg-slate-300',
                      )}
                      aria-hidden
                    />
                    {indice < os.timeline.length - 1 && (
                      <span className="w-px flex-1 bg-slate-200" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <p className="text-sm text-slate-700">{evento.descricao ?? evento.tipo}</p>
                    <p className="text-[11px] text-slate-400">{dataHora(evento.quando)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </Moldura>
  )
}

function Moldura({ children, oficina }: { children: React.ReactNode; oficina?: string }) {
  return (
    <div className="min-h-screen bg-slate-100 py-6">
      <div className="mx-auto max-w-md px-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {oficina && (
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-5 py-3">
              <span className="grid size-7 place-items-center rounded-lg bg-marca-600 text-white">
                <Wrench className="size-3.5" aria-hidden />
              </span>
              <p className="truncate text-sm font-semibold text-white">{oficina}</p>
            </div>
          )}
          {children}
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Página de acompanhamento somente leitura. Dúvidas sobre o serviço? Fale com a oficina.
        </p>
      </div>
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd
        className={cx(
          'text-right text-sm',
          destaque ? 'font-semibold text-slate-900' : 'text-slate-700',
        )}
      >
        {valor}
      </dd>
    </div>
  )
}
