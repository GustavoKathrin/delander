import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Package,
  PhoneCall,
  Radar as RadarIcone,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '../../api/client'
import type { Alerta, ResumoOs } from '../../types'
import { Botao, Carregando, Cartao, Etiqueta, Vazio, cx } from '../../components/ui'
import { CORES_STATUS, dataCompleta, horas, plural, telefoneWhatsapp } from '../../lib/format'
import { CHAVES, useConfig } from '../../lib/config'

/**
 * Radar de carros parados.
 *
 * A primeira versao separava a lista em "precisa de acao agora" e "vale
 * acompanhar", pela severidade do alerta. Medido com dado real: 13 carros,
 * TODOS na primeira caixa e nenhum na segunda. Uma divisao que nunca divide
 * nada nao informa — o dono abria a tela e via treze linhas iguais, oito
 * delas repetindo a mesma frase ("Sem nenhum apontamento ha 35 dias").
 *
 * O que ele faz com essa tela nao e medir gravidade, e distribuir trabalho:
 * quem eu cobro? O fornecedor, o cliente, ou a minha propria bancada? Entao
 * o agrupamento passa a ser esse, e cada frente carrega a acao que resolve
 * aquele tipo de problema — nao o mesmo par de botoes em toda linha.
 */

// ------------------------------------------------------------------ frentes

type Frente = 'PECA' | 'CLIENTE' | 'OFICINA' | 'OLHO'

const FRENTES: {
  chave: Frente
  titulo: string
  explicacao: string
  Icone: typeof Package
  anel: string
  cabecalho: string
  selo: string
}[] = [
  {
    chave: 'PECA',
    titulo: 'Esperando peça',
    explicacao: 'O carro não anda enquanto isto não chegar. Cobre o fornecedor.',
    Icone: Package,
    anel: 'ring-red-200',
    cabecalho: 'text-red-800',
    selo: 'bg-red-100 text-red-800',
  },
  {
    chave: 'CLIENTE',
    titulo: 'Depende do cliente',
    explicacao: 'A oficina já fez a parte dela. Falta alguém ligar.',
    Icone: PhoneCall,
    anel: 'ring-amber-200',
    cabecalho: 'text-amber-900',
    selo: 'bg-amber-100 text-amber-900',
  },
  {
    chave: 'OFICINA',
    titulo: 'Parado aqui dentro',
    explicacao: 'Ninguém encostou no carro. Este é o grupo que esvazia o pátio.',
    Icone: Wrench,
    anel: 'ring-slate-300',
    cabecalho: 'text-slate-800',
    selo: 'bg-slate-200 text-slate-800',
  },
  {
    chave: 'OLHO',
    titulo: 'De olho',
    explicacao: 'Ainda dá tempo, mas está apertando.',
    Icone: Clock3,
    anel: 'ring-slate-200',
    cabecalho: 'text-slate-600',
    selo: 'bg-slate-100 text-slate-700',
  },
]

/**
 * A ordem em que um motivo ganha dos outros.
 *
 * Nao e por severidade. "Sem nenhum apontamento" nasce ALTA e aparece em
 * quase todo carro do patio, inclusive nos que estao legitimamente parados
 * esperando o cliente aprovar — se a severidade mandasse, o carro esperando
 * aprovacao cairia em "parado aqui dentro" e a recepcao nunca ligaria.
 * Entao vale o motivo mais ESPECIFICO, e a severidade so desempata peca
 * (vermelha trava o inicio; ambar e so um aviso de compra).
 */
function pesoDoAlerta(a: Alerta): number {
  switch (a.tipo) {
    case 'PECA':
      return a.severidade === 'ALTA' ? 1 : 8
    case 'RETIRADA':
      return 2
    case 'PARADA':
      return 3
    case 'SEM_MECANICO':
      return 4
    case 'SEM_DIA':
      return 5
    case 'SEM_MOVIMENTO':
      return 6
    case 'ATRASO':
      return 7
    case 'ESTOURO':
      return 9
    default:
      return 10
  }
}

function frenteDo(os: ResumoOs, principal: Alerta): Frente {
  switch (principal.tipo) {
    case 'PECA':
      return 'PECA'
    case 'RETIRADA':
    case 'ATRASO':
      return 'CLIENTE'
    case 'PARADA':
      // Uma parada declarada ja diz de quem e a bola: o motivo tem categoria.
      if (os.paradaCategoria === 'PECA') return 'PECA'
      if (
        os.paradaCategoria === 'APROVACAO' ||
        os.paradaCategoria === 'CLIENTE' ||
        os.paradaCategoria === 'PAGAMENTO'
      ) {
        return 'CLIENTE'
      }
      return 'OFICINA'
    case 'ESTOURO':
    case 'PRAZO':
      return 'OLHO'
    default:
      return 'OFICINA'
  }
}

/** A mensagem ja escrita, porque o motivo e conhecido. */
function mensagemWhatsapp(os: ResumoOs, principal: Alerta): string {
  const carro = os.veiculo && os.veiculo !== os.placa ? `${os.veiculo} (${os.placa})` : os.placa
  if (principal.tipo === 'RETIRADA') {
    return `Olá! O seu ${carro} já está pronto aqui na oficina. Pode vir buscar quando quiser — qual o melhor dia para você?`
  }
  if (principal.tipo === 'ATRASO') {
    return `Olá! Sobre o seu ${carro}: o serviço está levando mais tempo do que a gente tinha previsto. Posso te passar o novo prazo?`
  }
  if (os.paradaCategoria === 'APROVACAO') {
    return `Olá! Sobre o seu ${carro}: o orçamento está pronto e esperando o seu ok para a gente seguir. Posso te mandar?`
  }
  if (os.paradaCategoria === 'PAGAMENTO') {
    return `Olá! Sobre o seu ${carro}: o serviço está concluído, falta só acertarmos o pagamento. Pode me retornar?`
  }
  return `Olá! Sobre o seu ${carro} aqui na oficina: `
}

/**
 * O numero que vai no cracha da esquerda.
 *
 * O servidor ordena a lista por dias sem movimentacao, e a tela antiga nao
 * mostrava esse numero em lugar nenhum — mostrava "dias na oficina", num
 * cinza de 11px. A ordem parecia aleatoria. Aqui o criterio da fila vira o
 * maior elemento da linha; para o carro pronto, o que conta e ha quantos
 * dias ele ocupa vaga sem ninguem buscar.
 */
function craveiraDe(os: ResumoOs, principal: Alerta): { dias: number; rotulo: string } {
  if (principal.tipo === 'RETIRADA') {
    return { dias: os.diasAguardandoRetirada, rotulo: 'dias pronto' }
  }
  return { dias: os.diasSemMovimentacao, rotulo: 'dias sem mexer' }
}

// ------------------------------------------------------------------ tela

export default function Radar() {
  const { numero } = useConfig()
  const consulta = useQuery({
    queryKey: ['radar'],
    queryFn: () => api<ResumoOs[]>('/os/radar'),
    refetchInterval: 60_000,
  })

  if (consulta.isLoading) return <Carregando texto="Procurando carros parados..." />

  const lista = consulta.data ?? []

  const classificados = lista.map((os) => {
    const principal = [...os.alertas].sort((a, b) => pesoDoAlerta(a) - pesoDoAlerta(b))[0]
    return { os, principal, frente: frenteDo(os, principal) }
  })

  const grupos = FRENTES.map((f) => ({
    ...f,
    linhas: classificados.filter((c) => c.frente === f.chave),
  })).filter((g) => g.linhas.length > 0)

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <RadarIcone className="size-5 text-slate-400" aria-hidden />
            Radar de carros parados
          </h1>
          {lista.length > 0 && (
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
              {lista.length} {lista.length === 1 ? 'carro' : 'carros'}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Separado por quem resolve, não por cor de alerta. Um carro entra aqui depois de{' '}
          {plural(numero(CHAVES.diasSemMovimentacao, 3), 'dia')} sem nenhum apontamento, ou{' '}
          {plural(numero(CHAVES.diasProntoSemRetirada, 2), 'dia')} pronto sem ninguém buscar.
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

      {grupos.map((grupo) => (
        <section key={grupo.chave}>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className={cx('flex items-center gap-1.5 text-sm font-semibold', grupo.cabecalho)}>
              <grupo.Icone className="size-4" aria-hidden />
              {grupo.titulo}
              <span
                className={cx(
                  'rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums',
                  grupo.selo,
                )}
              >
                {grupo.linhas.length}
              </span>
            </h2>
            <p className="text-xs text-slate-600">{grupo.explicacao}</p>
          </div>
          <div className="space-y-2">
            {grupo.linhas.map(({ os, principal }) => (
              <LinhaRadar key={os.id} os={os} principal={principal} anel={grupo.anel} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ linha

function LinhaRadar({
  os,
  principal,
  anel,
}: {
  os: ResumoOs
  principal: Alerta
  anel: string
}) {
  const cores = CORES_STATUS[os.status]
  const whatsapp = telefoneWhatsapp(os.clienteTelefone)
  const craveira = craveiraDe(os, principal)
  // O veiculo sem modelo cadastrado vinha como a propria placa, e a linha
  // saia "KLM4C88 · KLM4C88 · Mariana Prado".
  const modelo = os.veiculo && os.veiculo !== os.placa ? os.veiculo : null
  const secundarios = os.alertas.filter((a) => a !== principal)

  // So quem depende do cliente ganha o botao de WhatsApp. Oferecer "avisar
  // cliente" num carro travado por peca que a oficina esqueceu de comprar e
  // empurrar para o cliente um problema que nao e dele.
  const chamaCliente =
    principal.tipo === 'RETIRADA' ||
    principal.tipo === 'ATRASO' ||
    (principal.tipo === 'PARADA' &&
      (os.paradaCategoria === 'APROVACAO' ||
        os.paradaCategoria === 'CLIENTE' ||
        os.paradaCategoria === 'PAGAMENTO'))

  const ehPeca = principal.tipo === 'PECA' || os.paradaCategoria === 'PECA'

  return (
    <Cartao className={cx('p-3 ring-1', anel)}>
      <div className="flex flex-wrap items-start gap-3">
        {/* ---- o numero que ordena a fila, finalmente visivel ---- */}
        <div className="flex w-16 flex-none flex-col items-center rounded-lg bg-slate-50 px-1 py-2 text-center">
          <span className="text-2xl font-bold leading-none tabular-nums text-slate-900">
            {craveira.dias}
          </span>
          <span className="mt-1 text-[10px] leading-tight text-slate-500">{craveira.rotulo}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/os/${os.id}`}
              className="-my-3 inline-flex items-center py-3 font-mono text-sm font-semibold text-slate-900 hover:text-marca-700"
            >
              {os.placa}
            </Link>
            {modelo && <span className="text-xs text-slate-600">{modelo}</span>}
            <span className="text-xs text-slate-500">· {os.clienteNome}</span>
            <Etiqueta className={cores.chip}>{os.statusDescricao}</Etiqueta>
          </div>

          {/* O motivo principal em tamanho de leitura, nao em nota de rodape. */}
          <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-slate-900">
            <AlertTriangle
              className={cx(
                'mt-0.5 size-4 flex-none',
                principal.severidade === 'ALTA' ? 'text-red-600' : 'text-amber-600',
              )}
              aria-hidden
            />
            {principal.texto}
          </p>

          {/* Os outros avisos juntos numa linha, para a mesma frase nao
              aparecer oito vezes empilhada na tela. */}
          {secundarios.length > 0 && (
            <p className="mt-1 pl-5.5 text-xs leading-snug text-slate-500">
              {secundarios.map((a) => a.texto).join(' · ')}
            </p>
          )}

          <p className="mt-1 pl-5.5 text-[11px] text-slate-500">
            {os.diasNaOficina} dias na oficina · {horas(os.horasTrabalhadas)} de mão de obra
            {os.horasParado > 0 && ` · ${horas(os.horasParado)} parado`}
            {os.previsaoEntrega && ` · entrega prometida ${dataCompleta(os.previsaoEntrega)}`}
          </p>
        </div>

        {/* ---- a acao que combina com o motivo ---- */}
        <div className="flex flex-none flex-wrap items-center gap-2">
          {chamaCliente && whatsapp && (
            <AcaoLink
              para={`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagemWhatsapp(os, principal))}`}
              externa
              destaque
            >
              <MessageCircle className="size-4" aria-hidden />
              Chamar no WhatsApp
            </AcaoLink>
          )}
          {chamaCliente && !whatsapp && (
            <span className="text-xs text-slate-500">sem telefone cadastrado</span>
          )}
          {ehPeca && (
            <AcaoLink para="/pecas" destaque>
              <Package className="size-4" aria-hidden />
              Lista de compras
            </AcaoLink>
          )}
          {principal.tipo === 'SEM_DIA' && (
            <AcaoLink para="/quadro" destaque>
              <CalendarPlus className="size-4" aria-hidden />
              Marcar o dia
            </AcaoLink>
          )}
          <Link to={`/os/${os.id}`}>
            <Botao tamanho="toque" variante="secundario">
              Abrir OS
            </Botao>
          </Link>
        </div>
      </div>
    </Cartao>
  )
}

/** Link com cara de botao de 44px — o alvo da luva e o mesmo em todo lugar. */
function AcaoLink({
  para,
  externa = false,
  destaque = false,
  children,
}: {
  para: string
  externa?: boolean
  destaque?: boolean
  children: ReactNode
}) {
  const classe = cx(
    'inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition',
    destaque
      ? 'bg-marca-50 text-marca-700 ring-1 ring-marca-200 hover:bg-marca-100'
      : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
  )
  if (externa) {
    return (
      <a href={para} target="_blank" rel="noreferrer" className={classe}>
        {children}
      </a>
    )
  }
  return (
    <Link to={para} className={classe}>
      {children}
    </Link>
  )
}
