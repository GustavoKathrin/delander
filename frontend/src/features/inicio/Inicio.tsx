/*
 * A tela que abre o sistema.
 *
 * Antes o sistema abria na planta do pátio — uma tela bonita que responde
 * "onde está cada carro" e nenhuma outra pergunta. Quem chega de manhã não
 * precisa saber onde o carro está: precisa saber o que travou.
 *
 * A regra que organiza esta tela, de Few (Perceptual Edge, 2007) e da NN/g:
 * painel não é vitrine de número, é LISTA DE EXCEÇÃO COM AÇÃO ATRELADA. Se
 * não dá para nomear a decisão que o número destrava, aquilo é relatório, e
 * relatório tem outro lugar — a aba de revisão, que é para onde foi o painel
 * analítico de antes.
 *
 * Daí as três faixas, nesta ordem e não em outra:
 *
 *   1. o que está travado  — cada bloco leva à lista já filtrada
 *   2. como está a oficina — gente, bancada e vaga, agora
 *   3. o dia em números    — o que fechou hoje
 *
 * Tudo sai de endpoint que já existe. Nenhuma métrica nova foi inventada
 * para encher a tela: o que não tem dado de verdade não aparece.
 */
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Clock,
  Hammer,
  PackageSearch,
  ParkingSquare,
  Send,
  UserX,
} from 'lucide-react'

import { api } from '../../api/client'
import { Carregando, Vazio, cx } from '../../components/ui'
import { horas } from '../../lib/format'
import { CHAVES, useConfig } from '../../lib/config'
import type { PainelExecucao, Patio, PecaPendente, ResumoOs } from '../../types'

/* ------------------------------------------------------------------ peças */

/**
 * Um bloco de exceção.
 *
 * O número grande é o que se lê de longe; o rótulo diz o que ele é; e o
 * `para` existe sempre — bloco que não leva a lugar nenhum é enfeite, e
 * enfeite não entra aqui.
 */
function Travado({
  quantos,
  rotulo,
  explica,
  para,
  Icone,
  tom,
}: {
  /*
   * `null` e ZERO sao coisas diferentes, e essa diferenca e a tela inteira.
   *
   * Zero quer dizer "conferi e nao tem nada travado" -- alivio. `null` quer
   * dizer "nao consegui perguntar", e ai mostrar 0 seria uma mentira
   * tranquilizadora justo no bloco que existe para dar susto. Aconteceu de
   * verdade: o token expirou, duas consultas voltaram 401, e o painel
   * exibiu cinco zeros como se a oficina estivesse em dia.
   */
  quantos: number | null
  rotulo: string
  explica: string
  para: string
  Icone: typeof AlertTriangle
  tom: 'alerta' | 'atencao' | 'calmo'
}) {
  const falhou = quantos === null
  const vazio = quantos === 0
  return (
    <Link
      to={para}
      className={cx(
        'group relative flex min-h-[104px] flex-col justify-between rounded-lg p-3 ring-1 transition',
        vazio || falhou
          ? 'bg-white ring-slate-200 hover:ring-slate-300'
          : tom === 'alerta'
            ? 'bg-red-50 ring-red-200 hover:ring-red-300'
            : tom === 'atencao'
              ? 'bg-amber-50 ring-amber-200 hover:ring-amber-300'
              : 'bg-white ring-slate-200 hover:ring-slate-300',
      )}
    >
      <div className="flex items-start gap-2">
        <Icone
          className={cx(
            'size-4 flex-none',
            vazio || falhou ? 'text-slate-300' : tom === 'alerta' ? 'text-red-600' : tom === 'atencao' ? 'text-amber-600' : 'text-slate-400',
          )}
          aria-hidden
        />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {rotulo}
        </span>
      </div>
      <p
        className={cx(
          'fonte-display text-3xl font-bold leading-none',
          vazio || falhou ? 'text-slate-300' : tom === 'alerta' ? 'text-red-700' : tom === 'atencao' ? 'text-amber-700' : 'text-slate-900',
        )}
      >
        {falhou ? '—' : quantos}
      </p>
      <p className="flex items-center gap-1 text-[11px] leading-tight text-slate-500">
        <span className="min-w-0 flex-1 truncate">
          {falhou ? 'não consegui conferir' : vazio ? 'nada aqui' : explica}
        </span>
        <ArrowRight
          className="size-3 flex-none opacity-0 transition group-hover:opacity-100"
          aria-hidden
        />
      </p>
    </Link>
  )
}

/** Um número do estado da oficina. Sem ação: é contexto, não exceção. */
function Estado({
  valor,
  rotulo,
  detalhe,
}: {
  valor: string
  rotulo: string
  detalhe?: string
}) {
  return (
    <div className="min-w-0">
      <p className="fonte-display text-2xl font-bold leading-none text-slate-900">{valor}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {rotulo}
      </p>
      {detalhe && <p className="mt-0.5 truncate text-[11px] text-slate-400">{detalhe}</p>}
    </div>
  )
}

/**
 * A tira das vagas.
 *
 * É o pátio reduzido ao que o dono disse que usa dele: "bater o olho e ver
 * se está cheio". Uma linha de quadradinhos responde isso sem gastar uma
 * tela — e quem precisar mover carro de vaga continua indo para o pátio,
 * que é o que a tira NÃO faz.
 */
function TiraDeVagas({ patio }: { patio: Patio }) {
  return (
    <Link to="/patio" className="group block min-w-0">
      <div className="flex items-end gap-1" aria-hidden>
        {patio.vagas.map((v) => {
          const ocupada = Boolean(v.ocupante) && v.situacao !== 'RESERVADO'
          return (
            <span
              key={v.id}
              title={`${v.nome}: ${v.situacaoRotulo}`}
              className={cx(
                'h-7 flex-1 rounded-sm ring-1 transition',
                ocupada
                  ? v.situacao === 'PARADO'
                    ? 'bg-amber-400 ring-amber-500'
                    : v.situacao === 'PRONTO'
                      ? 'bg-emerald-500 ring-emerald-600'
                      : 'bg-marca-600 ring-marca-700'
                  : 'bg-slate-100 ring-slate-200',
              )}
            />
          )
        })}
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
        <span>
          {patio.vagasTotal - patio.vagasLivres} de {patio.vagasTotal} vagas ocupadas
        </span>
        <ArrowRight className="size-3 opacity-0 transition group-hover:opacity-100" aria-hidden />
      </p>
    </Link>
  )
}

/* ------------------------------------------------------------------ tela */

export default function Inicio() {
  const navegar = useNavigate()
  const { texto } = useConfig()

  const execucao = useQuery({
    queryKey: ['execucao'],
    queryFn: () => api<PainelExecucao>('/execucao'),
    refetchInterval: 60_000,
  })
  const patio = useQuery({
    queryKey: ['patio'],
    queryFn: () => api<Patio>('/patio'),
    refetchInterval: 60_000,
  })
  const parados = useQuery({
    queryKey: ['radar'],
    queryFn: () => api<ResumoOs[]>('/os/radar'),
    refetchInterval: 120_000,
  })
  const pecas = useQuery({
    queryKey: ['pecas-pendentes'],
    queryFn: () => api<PecaPendente[]>('/pecas/pendentes'),
    refetchInterval: 120_000,
  })

  if (execucao.isLoading || patio.isLoading) {
    return <Carregando texto="Abrindo a oficina..." />
  }
  if (execucao.isError || !execucao.data || !patio.data) {
    return (
      <div className="p-4">
        <Vazio
          titulo="Não foi possível abrir o painel"
          descricao={(execucao.error as Error | undefined)?.message}
        />
      </div>
    )
  }

  const r = execucao.data.resumo
  const p = patio.data
  /*
   * Peça que ainda trava: pedida ou comprada e ainda não recebida.
   * RECEBIDA e APLICADA já chegaram; CANCELADA saiu do caminho.
   */
  const esperandoPeca = pecas.isError
    ? null
    : (pecas.data ?? []).filter((x) => x.status === 'SOLICITADA' || x.status === 'COMPRADA').length
  const semRetirar = p.vagas.filter((v) => v.situacao === 'PRONTO').length

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      {/* ====================================== 1. o que está travado */}
      <section>
        <div className="mb-2 flex items-baseline gap-2">
          <h1 className="fonte-display text-base font-bold text-slate-900">
            {texto(CHAVES.nomeOficina, 'A oficina')} agora
          </h1>
          <p className="text-xs text-slate-500">o que precisa de alguém hoje</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Travado
            quantos={r.carrosParados}
            rotulo="Parados"
            explica="carro na vaga sem ninguém trabalhando"
            para="/execucao"
            Icone={Hammer}
            tom="alerta"
          />
          <Travado
            quantos={esperandoPeca}
            rotulo="Esperando peça"
            explica="peça pedida que ainda não chegou"
            para="/pecas"
            Icone={PackageSearch}
            tom="atencao"
          />
          <Travado
            quantos={r.aEsperar}
            rotulo="Sem mecânico"
            explica="aprovado e ninguém pegou"
            para="/execucao"
            Icone={UserX}
            tom="atencao"
          />
          <Travado
            quantos={r.estourados}
            rotulo="Passou do prazo"
            explica="mais horas do que o previsto"
            para="/execucao"
            Icone={AlertTriangle}
            tom="alerta"
          />
          <Travado
            quantos={semRetirar}
            rotulo="Pronto, não saiu"
            explica="ocupando vaga sem precisar"
            para="/patio"
            Icone={Send}
            tom="atencao"
          />
        </div>
      </section>

      {/* ====================================== 2. como está a oficina */}
      <section className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
        <div className="grid gap-5 lg:grid-cols-[repeat(3,auto)_1fr] lg:items-end">
          <Estado
            valor={`${r.rodando}/${r.mecanicos}`}
            rotulo="Na bancada"
            detalhe="cronômetro rodando / mecânicos"
          />
          <Estado valor={String(r.carros)} rotulo="Carros na oficina" />
          <Estado
            valor={p.proximaVagaLivreRotulo ?? '—'}
            rotulo="Próxima vaga"
            detalhe={p.fila.length > 0 ? `${p.fila.length} esperando no portão` : 'ninguém na fila'}
          />
          <div className="min-w-0 lg:pl-4">
            <TiraDeVagas patio={p} />
          </div>
        </div>
      </section>

      {/* ====================================== 3. o dia em números */}
      <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Clock className="size-4" aria-hidden />
          Hoje
        </p>
        <Estado valor={horas(r.horasHoje)} rotulo="Horas apontadas" />
        <Estado valor={String(r.concluidosHoje)} rotulo="Serviços concluídos" />
        <Estado valor={String(r.entreguesHoje)} rotulo="Carros entregues" />
        <Estado
          valor={horas(p.backlogHoras)}
          rotulo="Trabalho na fila"
          detalhe="o que já entrou e ainda não foi feito"
        />
        {/*
          Dinheiro ainda não aparece aqui de propósito: nenhum endpoint
          devolve faturamento. Inventar um número de receita a partir do
          catálogo daria um valor que não bate com o caixa, e painel que
          mente uma vez não é mais consultado.
        */}
        <button
          type="button"
          onClick={() => navegar('/painel')}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-marca-700 ring-1 ring-marca-200 transition hover:bg-marca-50"
        >
          <CircleDollarSign className="size-4" aria-hidden />
          Revisão do mês
        </button>
      </section>

      {/* ====================================== carros parados, a lista */}
      {(parados.data?.length ?? 0) > 0 && (
        <section className="rounded-lg bg-white ring-1 ring-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
            <ParkingSquare className="size-4 text-slate-400" aria-hidden />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Sem movimento há mais tempo
            </h2>
            <Link to="/radar" className="ml-auto text-xs font-semibold text-marca-700 hover:underline">
              ver todos
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {(parados.data ?? []).slice(0, 5).map((os) => (
              <li key={os.id}>
                <Link
                  to={`/os/${os.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50"
                >
                  <span className="fonte-display w-20 flex-none text-sm font-bold tracking-wide text-slate-900">
                    {os.placa}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                    {os.veiculo}
                  </span>
                  <span className="flex-none text-xs text-slate-500">{os.statusDescricao}</span>
                  <span
                    className={cx(
                      'w-28 flex-none text-right text-xs font-semibold',
                      os.diasSemMovimentacao >= 7 ? 'text-red-600' : 'text-amber-700',
                    )}
                  >
                    {os.diasSemMovimentacao} dias parado
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
