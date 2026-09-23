import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CalendarCheck,
  Car,
  ChevronsUp,
  Clock,
  Gauge,
  PackageX,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { api } from '../../api/client'
import type { Painel } from '../../types'
import { Barra, Botao, Carregando, Cartao, CartaoTitulo, Etiqueta, Vazio, cx } from '../../components/ui'
import { dataCurta, diasTexto, horas } from '../../lib/format'

/**
 * Paleta categorica validada (scripts/validate_palette.js):
 * par #2563eb / #f59e0b passa a separacao para daltonismo (protan 37.0, tritan 30.8).
 * O ambar fica abaixo de 3:1 de contraste com o fundo claro, por isso as barras
 * levam rotulo de valor direto - a leitura nunca depende so da cor.
 */
const COR_RECEBIDOS = '#f59e0b'
const COR_ENTREGUES = '#2563eb'
const COR_PARETO = '#2563eb'
const COR_PARETO_FRACA = '#93c5fd'
const COR_GRADE = '#e2e8f0'
const COR_TEXTO_EIXO = '#64748b'

export default function Dashboard() {
  const [dias, setDias] = useState(30)

  const hoje = new Date()
  const ate = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(
    hoje.getDate(),
  ).padStart(2, '0')}`
  const inicio = new Date(hoje.getTime() - (dias - 1) * 86_400_000)
  const de = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(
    inicio.getDate(),
  ).padStart(2, '0')}`

  const consulta = useQuery({
    queryKey: ['painel', de, ate],
    queryFn: () => api<Painel>(`/metricas/painel?de=${de}&ate=${ate}`),
  })

  if (consulta.isLoading) return <Carregando texto="Calculando as métricas..." />
  if (consulta.isError) {
    return (
      <div className="p-4">
        <Vazio titulo="Não foi possível carregar o painel" descricao={(consulta.error as Error).message} />
      </div>
    )
  }

  const painel = consulta.data!
  const r = painel.resumo

  const throughput = painel.throughput.map((t) => ({
    semana: dataCurta(t.inicio),
    recebidos: t.recebidos,
    entregues: t.entregues,
  }))

  const totalRecebidos = painel.throughput.reduce((s, t) => s + t.recebidos, 0)
  const totalEntregues = painel.throughput.reduce((s, t) => s + t.entregues, 0)
  const patioEnchendo = totalRecebidos > totalEntregues

  const pareto = painel.paradas.slice(0, 7).map((p) => ({
    motivo: p.motivo.length > 26 ? `${p.motivo.slice(0, 24)}…` : p.motivo,
    motivoCompleto: p.motivo,
    horas: Number(p.horas),
    percentual: p.percentual,
    ocorrencias: p.ocorrencias,
  }))

  return (
    <div className="space-y-4 p-4">
      {/* ---------------- cabecalho ---------------- */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Painel do dono</h1>
          <p className="mt-1 text-sm text-slate-500">
            Por que o pátio não esvazia — em números, não em impressão.
          </p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((opcao) => (
            <Botao
              key={opcao}
              tamanho="sm"
              variante={dias === opcao ? 'primario' : 'secundario'}
              onClick={() => setDias(opcao)}
            >
              {opcao} dias
            </Botao>
          ))}
        </div>
      </header>

      {/* ---------------- KPIs do patio agora ---------------- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          Icone={Car}
          rotulo="Carros no pátio agora"
          valor={String(r.carrosNoPatio)}
          detalhe={`${r.emExecucao} em execução · ${r.aguardando} aguardando`}
        />
        <Kpi
          Icone={PackageX}
          rotulo="Prontos e não retirados"
          valor={String(r.prontosNaoRetirados)}
          detalhe={
            r.prontosNaoRetirados > 0
              ? `média de ${diasTexto(r.diasMedioAguardandoRetirada)} esperando o cliente`
              : 'ninguém esperando retirada'
          }
          alerta={r.prontosNaoRetirados > 0}
        />
        <Kpi
          Icone={Gauge}
          rotulo="Ocupação das vagas"
          valor={`${r.ocupacaoBoxesPercentual}%`}
          detalhe={`${r.boxesOcupados} de ${r.boxesTotal} boxes ocupados`}
          barra={r.ocupacaoBoxesPercentual}
        />
        {r.elevadoresTotal > 0 && (
          <Kpi
            Icone={ChevronsUp}
            rotulo="Elevadores"
            valor={`${r.elevadoresOcupados}/${r.elevadoresTotal}`}
            detalhe={
              r.naFilaDoElevador > 0
                ? `${r.naFilaDoElevador} carro(s) esperando elevador`
                : 'ninguém esperando elevador'
            }
            barra={Math.round((r.elevadoresOcupados * 100) / r.elevadoresTotal)}
            alerta={r.elevadoresOcupados === r.elevadoresTotal && r.naFilaDoElevador > 0}
          />
        )}
        <Kpi
          Icone={Clock}
          rotulo="Trabalho na fila"
          valor={horas(r.backlogHoras)}
          detalhe={
            r.primeiraFolga
              ? `primeira folga: ${r.primeiraFolga.rotulo} (${horas(r.primeiraFolga.horasLivres)} livres)`
              : 'sem folga nos próximos 60 dias'
          }
        />
      </section>

      {/* ---------------- o diagnostico ---------------- */}
      <Cartao>
        <CartaoTitulo
          titulo="Permanência x mão de obra"
          descricao="A diferença entre os dois é o verdadeiro problema do pátio cheio"
        />
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Permanência média
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {r.permanenciaMediaDias}
              <span className="ml-1 text-sm font-normal text-slate-500">dias na oficina</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Mão de obra média</p>
            <p className="text-2xl font-bold text-slate-900">
              {horas(r.maoObraMediaHoras)}
              <span className="ml-1 text-sm font-normal text-slate-500">de trabalho real</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Aproveitamento do tempo
            </p>
            <p
              className={cx(
                'text-2xl font-bold',
                r.aproveitamentoPercentual < 30
                  ? 'text-red-600'
                  : r.aproveitamentoPercentual < 50
                    ? 'text-amber-600'
                    : 'text-emerald-600',
              )}
            >
              {r.aproveitamentoPercentual}%
            </p>
            <Barra
              percentual={r.aproveitamentoPercentual}
              cor={
                r.aproveitamentoPercentual < 30
                  ? 'bg-red-500'
                  : r.aproveitamentoPercentual < 50
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }
            />
          </div>
        </div>
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          Das horas úteis em que o carro ficou aqui, {r.aproveitamentoPercentual}% viraram trabalho
          de verdade. O resto foi espera — em média {horas(r.horasParadoMedia)} de parada registrada
          por OS entregue. Corrigir isso libera vaga sem contratar ninguém.
        </p>
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------- entra x sai ---------------- */}
        <Cartao>
          <CartaoTitulo
            titulo="Entra x sai por semana"
            descricao="Se a barra de recebidos fica acima da de entregues, o pátio enche"
            acao={
              <Etiqueta
                className={
                  patioEnchendo
                    ? 'bg-red-100 text-red-700 ring-red-200'
                    : 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                }
              >
                {patioEnchendo ? (
                  <TrendingUp className="size-3" aria-hidden />
                ) : (
                  <TrendingDown className="size-3" aria-hidden />
                )}
                {totalRecebidos} entraram · {totalEntregues} saíram
              </Etiqueta>
            }
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={throughput} margin={{ top: 16, right: 8, bottom: 0, left: -20 }} barGap={2}>
                <CartesianGrid stroke={COR_GRADE} strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="semana"
                  tick={{ fill: COR_TEXTO_EIXO, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: COR_GRADE }}
                />
                <YAxis
                  tick={{ fill: COR_TEXTO_EIXO, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
                  }}
                  labelFormatter={(v) => `Semana de ${v}`}
                />
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, color: COR_TEXTO_EIXO }}
                />
                <Bar dataKey="recebidos" name="Recebidos" fill={COR_RECEBIDOS} radius={[4, 4, 0, 0]} maxBarSize={22}>
                  <LabelList dataKey="recebidos" position="top" fill="#334155" fontSize={11} />
                </Bar>
                <Bar dataKey="entregues" name="Entregues" fill={COR_ENTREGUES} radius={[4, 4, 0, 0]} maxBarSize={22}>
                  <LabelList dataKey="entregues" position="top" fill="#334155" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>

        {/* ---------------- pareto de paradas ---------------- */}
        <Cartao>
          <CartaoTitulo
            titulo="Onde o tempo se perde"
            descricao="Horas de carro parado por motivo — o gargalo real da oficina"
          />
          {pareto.length === 0 ? (
            <Vazio
              titulo="Nenhuma parada registrada no período"
              descricao="Quando um serviço é pausado com motivo, as horas perdidas aparecem aqui."
            />
          ) : (
            <>
              <div className="p-4 pb-0">
                <ResponsiveContainer width="100%" height={Math.max(pareto.length * 34, 160)}>
                  <BarChart
                    data={pareto}
                    layout="vertical"
                    margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid stroke={COR_GRADE} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: COR_TEXTO_EIXO, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: COR_GRADE }}
                    />
                    <YAxis
                      type="category"
                      dataKey="motivo"
                      width={150}
                      tick={{ fill: '#334155', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                        boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
                      }}
                      formatter={(valor: number) => [`${valor} h`, 'Horas parado']}
                    />
                    <Bar dataKey="horas" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {pareto.map((linha, indice) => (
                        <Cell
                          key={linha.motivoCompleto}
                          fill={indice === 0 ? COR_PARETO : COR_PARETO_FRACA}
                        />
                      ))}
                      <LabelList
                        dataKey="horas"
                        position="right"
                        formatter={(v: number) => `${v}h`}
                        fill="#334155"
                        fontSize={11}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full text-xs">
                <caption className="sr-only">Horas perdidas por motivo de parada</caption>
                <thead>
                  <tr className="text-left text-slate-400">
                    <th scope="col" className="px-4 py-1.5 font-medium">
                      Motivo
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">
                      Ocorr.
                    </th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">
                      Horas
                    </th>
                    <th scope="col" className="px-4 py-1.5 text-right font-medium">
                      % do total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pareto.map((linha) => (
                    <tr key={linha.motivoCompleto}>
                      <td className="px-4 py-1.5 text-slate-700">{linha.motivoCompleto}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600">{linha.ocorrencias}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600">{linha.horas}h</td>
                      <td className="px-4 py-1.5 text-right font-medium text-slate-700">
                        {linha.percentual}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Cartao>
      </div>

      {/* ---------------- equipe ---------------- */}
      <Cartao>
        <CartaoTitulo
          titulo="Equipe no período"
          descricao="Horas apontadas e aderência entre o tempo previsto e o realizado"
        />
        {painel.mecanicos.length === 0 ? (
          <Vazio
            titulo="Nenhuma hora apontada no período"
            descricao="Assim que os mecânicos usarem o cronômetro, a produtividade aparece aqui."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th scope="col" className="px-4 py-2 font-medium">
                  Mecânico
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Serviços
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Trabalhadas
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Estimadas
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Aderência
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {painel.mecanicos.map((m) => (
                <tr key={m.nome}>
                  <td className="px-4 py-2 text-slate-800">{m.nome}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{m.servicos}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{horas(m.horasTrabalhadas)}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{horas(m.horasEstimadas)}</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={cx(
                        'font-medium',
                        m.aderenciaPercentual >= 90 && m.aderenciaPercentual <= 115
                          ? 'text-emerald-700'
                          : 'text-amber-700',
                      )}
                    >
                      {m.aderenciaPercentual}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          Aderência de 100% significa que o tempo previsto bateu com o realizado. Abaixo de 90%, a
          equipe está gastando mais que o previsto — e a oficina está prometendo prazo curto demais.
          {r.osComEstouro > 0 && ` ${r.osComEstouro} OS estouraram a estimativa no período.`}
        </p>
      </Cartao>

      {r.primeiraFolga && (
        <Cartao className="flex flex-wrap items-center gap-3 p-4">
          <CalendarCheck className="size-5 flex-none text-emerald-600" aria-hidden />
          <p className="text-sm text-slate-700">
            <span className="font-medium">Quando dá para pegar outro carro:</span>{' '}
            <span className="capitalize">{r.primeiraFolga.rotulo}</span> — {horas(r.primeiraFolga.horasLivres)}{' '}
            livres e {r.primeiraFolga.vagasLivres} vaga(s), com o dia em{' '}
            {r.primeiraFolga.percentualOcupacao}% da capacidade.
          </p>
        </Cartao>
      )}
    </div>
  )
}

function Kpi({
  Icone,
  rotulo,
  valor,
  detalhe,
  alerta,
  barra,
}: {
  Icone: typeof Car
  rotulo: string
  valor: string
  detalhe?: string
  alerta?: boolean
  barra?: number
}) {
  return (
    <Cartao className={cx('p-4', alerta && 'ring-red-300')}>
      <div className="flex items-start gap-3">
        <span
          className={cx(
            'grid size-9 flex-none place-items-center rounded-lg',
            alerta ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500',
          )}
        >
          <Icone className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
          <p className={cx('text-xl font-bold', alerta ? 'text-red-600' : 'text-slate-900')}>
            {valor}
          </p>
          {detalhe && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{detalhe}</p>}
          {barra !== undefined && (
            <div className="mt-1.5">
              <Barra percentual={barra} cor={barra >= 100 ? 'bg-red-500' : 'bg-marca-600'} />
            </div>
          )}
        </div>
      </div>
    </Cartao>
  )
}
