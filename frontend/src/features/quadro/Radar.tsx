import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, MessageCircle, Radar as RadarIcone } from 'lucide-react'
import { api } from '../../api/client'
import type { ResumoOs } from '../../types'
import { Botao, Carregando, Cartao, Etiqueta, Vazio, cx } from '../../components/ui'
import { CORES_STATUS, dataCompleta, diasTexto, horas, telefoneWhatsapp } from '../../lib/format'
import { CHAVES, useConfig } from '../../lib/config'

export default function Radar() {
  const { numero } = useConfig()
  const consulta = useQuery({
    queryKey: ['radar'],
    queryFn: () => api<ResumoOs[]>('/os/radar'),
    refetchInterval: 60_000,
  })

  if (consulta.isLoading) return <Carregando texto="Procurando carros parados..." />

  const lista = consulta.data ?? []
  const criticos = lista.filter((os) => os.alertas.some((a) => a.severidade === 'ALTA'))
  const atencao = lista.filter((os) => !os.alertas.some((a) => a.severidade === 'ALTA'))

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <RadarIcone className="size-5 text-slate-400" aria-hidden />
          Radar de carros parados
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tudo que precisa de uma decisão sua hoje. Um carro é marcado como parado depois de{' '}
          {numero(CHAVES.diasSemMovimentacao, 3)} dia(s) sem nenhum apontamento, e como esquecido
          depois de {numero(CHAVES.diasProntoSemRetirada, 2)} dia(s) pronto sem ninguém buscar.
        </p>
      </header>

      {lista.length === 0 && (
        <Cartao>
          <Vazio
            icone={<CheckCircle2 className="size-10" />}
            titulo="Nenhum carro parado"
            descricao="Todos os veículos do pátio estão em movimento e dentro do prazo. É assim que o pátio esvazia."
          />
        </Cartao>
      )}

      {criticos.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <AlertTriangle className="size-4" aria-hidden />
            Precisa de ação agora ({criticos.length})
          </h2>
          <div className="space-y-2">
            {criticos.map((os) => (
              <LinhaRadar key={os.id} os={os} critico />
            ))}
          </div>
        </section>
      )}

      {atencao.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-amber-700">
            Vale acompanhar ({atencao.length})
          </h2>
          <div className="space-y-2">
            {atencao.map((os) => (
              <LinhaRadar key={os.id} os={os} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function LinhaRadar({ os, critico = false }: { os: ResumoOs; critico?: boolean }) {
  const cores = CORES_STATUS[os.status]
  const whatsapp = telefoneWhatsapp(os.clienteTelefone)
  const mensagem = encodeURIComponent(
    `Ola! Sobre o seu ${os.veiculo} (${os.placa}) na oficina: `,
  )

  return (
    <Cartao className={cx('p-3', critico && 'ring-red-300')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/os/${os.id}`}
              className="font-mono text-sm font-semibold text-slate-900 hover:text-marca-700"
            >
              {os.placa}
            </Link>
            <span className="text-xs text-slate-500">
              {os.veiculo} · {os.clienteNome}
            </span>
            <Etiqueta className={cores.chip}>{os.statusDescricao}</Etiqueta>
            {os.paradaMotivo && (
              <Etiqueta className="bg-orange-100 text-orange-800 ring-orange-200">
                {os.paradaMotivo}
              </Etiqueta>
            )}
          </div>

          <ul className="mt-1.5 space-y-0.5">
            {os.alertas.map((alerta) => (
              <li
                key={alerta.tipo}
                className={cx(
                  'flex items-start gap-1 text-xs',
                  alerta.severidade === 'ALTA' ? 'text-red-600' : 'text-amber-700',
                )}
              >
                <AlertTriangle className="mt-0.5 size-3 flex-none" aria-hidden />
                {alerta.texto}
              </li>
            ))}
          </ul>

          <p className="mt-1.5 text-[11px] text-slate-400">
            {diasTexto(os.diasNaOficina)} na oficina · {horas(os.horasTrabalhadas)} de mão de obra
            {os.horasParado > 0 && ` · ${horas(os.horasParado)} parado`}
            {os.previsaoEntrega && ` · entrega prometida ${dataCompleta(os.previsaoEntrega)}`}
          </p>
        </div>

        <div className="flex flex-none items-center gap-2">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${mensagem}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              <MessageCircle className="size-3.5" aria-hidden />
              Avisar cliente
            </a>
          )}
          <Link to={`/os/${os.id}`}>
            <Botao tamanho="sm">Abrir OS</Botao>
          </Link>
        </div>
      </div>
    </Cartao>
  )
}
