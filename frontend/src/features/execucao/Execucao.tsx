import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronsUp,
  Circle,
  Clock,
  Flame,
  Hourglass,
  PauseCircle,
  Play,
  Timer,
  TriangleAlert,
  Wrench,
} from 'lucide-react'

import { api } from '../../api/client'
import type { ArquivoOs, CarroEmExecucao, PainelExecucao, ServicoEmExecucao } from '../../types'
import { GradeDeFotos, VisorDeFoto } from '../../components/fotos'
import { Barra, Botao, Carregando, Etiqueta, Vazio, cx, useTique } from '../../components/ui'
import { CORES_PRIORIDADE, dataCurta, decorrido, horas, plural } from '../../lib/format'

/**
 * Oficina agora — o painel da Etapa 6.
 *
 * A etapa 6 é o serviço acontecendo, e até aqui ela só tinha duas telas: a
 * OS de um carro, que mostra um carro, e o Painel do Mecânico, que mostra um
 * serviço por cartão na ordem da agenda — a tela de quem está com a chave na
 * mão e precisa de UM cartão.
 *
 * Quem olha a oficina inteira faz outra pergunta: "onde está cada carro, e o
 * que falta nele?". A resposta dela é por CARRO. É por isso que este painel
 * não é o do mecânico com mais colunas: ele inverte a unidade da tela.
 *
 * Três decisões que valem explicação:
 *
 *  - **Azul é a cor da etapa 6.** É a mesma da régua da OS (`EtapasDaOs`), e
 *    não a cor da marca: `marca-*` é trocada em tempo de execução pelo tema,
 *    e no Delander ela computa quase preto.
 *  - **O carro parado vem primeiro.** A ordem é a da urgência e vem pronta do
 *    servidor: parado, depois em serviço, depois o resto. Carro parado é vaga
 *    ocupada sem nada acontecendo — é o que custa dinheiro.
 *  - **Nenhum preço entra aqui.** A tela é do chão de fábrica e serve aos
 *    quatro perfis sem máscara: hora de trabalho o mecânico já vê.
 */
export default function Execucao() {
  // O cronômetro na tela anda de segundo em segundo; o dado, de 20 em 20.
  // Pedir o dado a cada segundo seria uma consulta por segundo por pessoa
  // aberta na tela, num banco de plano gratuito.
  const agora = useTique()
  const [vendoFoto, setVendoFoto] = useState<{ fotoId: string; osId: string } | null>(null)

  const consulta = useQuery({
    queryKey: ['execucao'],
    queryFn: () => api<PainelExecucao>('/execucao'),
    refetchInterval: 20_000,
  })

  const painel = consulta.data

  /**
   * A foto aberta é re-encontrada por id a cada render.
   *
   * Guardar o objeto deixaria o visor com uma cópia congelada: a tela
   * recarrega sozinha, e um "o cliente vê" acionado dentro do visor
   * voltaria ao estado anterior logo depois do toque.
   */
  const fotoAberta = useMemo<ArquivoOs | null>(() => {
    if (!vendoFoto || !painel) return null
    for (const carro of painel.carros) {
      const achada = carro.fotos.find((f) => f.id === vendoFoto.fotoId)
      if (achada) return achada
    }
    return null
  }, [vendoFoto, painel])

  if (consulta.isLoading) return <Carregando texto="Olhando a oficina..." />
  /*
   * `!painel` entra no mesmo if do erro de propósito.
   *
   * `isLoading` não cobre tudo: no TanStack Query v5 ele é `isPending &&
   * isFetching`, e existe um terceiro estado -- pendente com a busca em
   * pausa (celular sem rede) ou entre tentativas do retry -- em que os dois
   * primeiros ifs dão falso e `data` ainda é `undefined`. Sem esta guarda a
   * desestruturação estoura dentro do render e a tela fica branca, que é o
   * pior jeito de dizer "sem internet".
   */
  if (consulta.isError || !painel) {
    return (
      <div className="p-4">
        <Vazio
          titulo="Não foi possível abrir o painel"
          descricao={
            (consulta.error as Error | null)?.message ??
            'O servidor não respondeu. Verifique a conexão e tente de novo.'
          }
          acao={
            <Botao variante="secundario" onClick={() => void consulta.refetch()}>
              Tentar de novo
            </Botao>
          }
        />
      </div>
    )
  }

  const { resumo, carros, aguardando } = painel
  const relogio = new Date(agora).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const progresso =
    resumo.horasPrevistas > 0
      ? Math.min(Math.round((resumo.horasFeitas / resumo.horasPrevistas) * 100), 100)
      : 0

  return (
    <div className="space-y-4 p-4">
      {/* ---------------------------------------------------- cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            Oficina agora
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 ring-1 ring-inset ring-blue-200">
              {/* O ponto que pisca é o único enfeite da tela, e ele informa:
                  diz que o número não é de um relatório, é de agora. */}
              {/* `pulsando` e nao `animate-ping`: a classe do projeto é
                  zerada em prefers-reduced-motion, e a do Tailwind não. */}
              <span className="pulsando inline-flex size-1.5 rounded-full bg-blue-600" />
              etapa 6
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-600">{fraseDoChao(resumo)}</p>
        </div>
        <p className="font-mono text-2xl font-bold tabular-nums text-slate-500">{relogio}</p>
      </header>

      {/* ---------------------------------------------------- neste instante */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          Icone={Play}
          valor={resumo.rodando}
          rotulo={resumo.rodando === 1 ? 'cronômetro rodando' : 'cronômetros rodando'}
          detalhe={
            resumo.mecanicos > 0
              ? `${plural(resumo.mecanicos, 'mecânico')} com a mão no carro`
              : 'ninguém apontando agora'
          }
          tom={resumo.rodando > 0 ? 'ativo' : 'neutro'}
        />
        {/* Conta CARRO, e não serviço. O caminho mais comum de um carro
            parar não pausa serviço nenhum -- quando o último cronômetro
            fecha, a OS vai para PAUSADO e os serviços seguem pendentes --,
            e contando só serviço a faixa dizia "nada travado" em verde com
            o carro parado desenhado logo abaixo, em âmbar. */}
        {/* Uma caixa, um número — e o número é o que está parado.
            Carro parado vem primeiro porque é a vaga ocupada; se o carro
            anda e só um serviço dele travou, é esse serviço que aparece.
            Mostrar "0 carros parados" dentro de uma caixa com anel âmbar
            porque havia um serviço travado dizia duas coisas ao mesmo
            tempo. */}
        <Numero
          Icone={PauseCircle}
          valor={resumo.carrosParados > 0 ? resumo.carrosParados : resumo.servicosParados}
          rotulo={
            resumo.servicosParados > 0 && resumo.carrosParados === 0
              ? resumo.servicosParados === 1
                ? 'serviço travado'
                : 'serviços travados'
              : resumo.carrosParados === 1
                ? 'carro parado'
                : 'carros parados'
          }
          detalhe={
            resumo.carrosParados > 0
              ? resumo.servicosParados > 0
                ? `${plural(resumo.servicosParados, 'serviço')} com motivo registrado`
                : 'na vaga, sem ninguém com o cronômetro'
              : resumo.servicosParados > 0
                ? 'o carro anda, mas este serviço não'
                : 'nada travado na bancada'
          }
          tom={resumo.carrosParados > 0 || resumo.servicosParados > 0 ? 'alerta' : 'bom'}
        />
        <Numero
          Icone={Hourglass}
          valor={resumo.aEsperar}
          rotulo={resumo.aEsperar === 1 ? 'serviço sem começar' : 'serviços sem começar'}
          detalhe="no carro que já está na bancada"
          tom="neutro"
        />
        <Numero
          Icone={Flame}
          valor={resumo.estourados}
          rotulo={resumo.estourados === 1 ? 'passou do previsto' : 'passaram do previsto'}
          detalhe={
            resumo.estourados > 0
              ? 'a estimativa já foi ultrapassada'
              : 'todos dentro da estimativa'
          }
          tom={resumo.estourados > 0 ? 'quente' : 'bom'}
        />
      </div>

      {/* ---------------------------------------------------- o dia, e a barra */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoje</h2>
        <Placar
          valor={resumo.concluidosHoje}
          zero="nenhum serviço concluído ainda"
          um="serviço concluído"
          muitos="serviços concluídos"
        />
        <Placar
          valor={resumo.entreguesHoje}
          zero="nenhum carro entregue ainda"
          um="carro entregue"
          muitos="carros entregues"
        />
        <span className="flex items-center gap-1.5 text-sm text-slate-700">
          <Clock className="size-3.5 text-slate-400" aria-hidden />
          <strong className="font-semibold tabular-nums">{horas(resumo.horasHoje)}</strong>
          apontadas
        </span>

        {resumo.horasPrevistas > 0 && (
          <div className="ml-auto flex min-w-48 flex-1 items-center gap-2.5 sm:flex-none">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-xs text-slate-500">
              {horas(resumo.horasFeitas)} de {horas(resumo.horasPrevistas)} na bancada
            </span>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- os carros */}
      {carros.length === 0 ? (
        <div className="rounded-xl bg-white ring-1 ring-slate-200">
          <Vazio
            icone={<Wrench className="size-8" />}
            titulo="Nenhum carro na bancada agora"
            descricao={
              aguardando.length > 0
                ? 'Nada em execução neste momento — mas tem carro aprovado esperando mecânico, logo abaixo.'
                : 'Quando alguém der início a um serviço, o carro aparece aqui com o cronômetro rodando.'
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {carros.map((carro) => (
            <CartaoDoCarro
              key={carro.osId}
              carro={carro}
              agora={agora}
              onAbrirFoto={(foto) => setVendoFoto({ fotoId: foto.id, osId: carro.osId })}
            />
          ))}
        </div>
      )}

      {/* ---------------------------------------------------- a fila da bancada */}
      {aguardando.length > 0 && (
        <section className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <header className="flex flex-wrap items-baseline gap-x-2 border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Aprovados, esperando mecânico</h2>
            <p className="text-xs text-slate-500">
              o cliente já disse sim e ninguém começou — é daqui que sai o próximo serviço
            </p>
          </header>
          <ul className="divide-y divide-slate-100">
            {aguardando.map((carro) => (
              <li key={carro.osId}>
                <Link
                  to={`/os/${carro.osId}`}
                  className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition hover:bg-slate-50"
                >
                  <span className="font-mono text-sm font-bold text-slate-900">{carro.placa}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                    {carro.veiculo} · {carro.cliente}
                  </span>
                  {carro.prioridade !== 'NORMAL' && (
                    <Etiqueta className={CORES_PRIORIDADE[carro.prioridade]}>
                      {carro.prioridade.toLowerCase()}
                    </Etiqueta>
                  )}
                  <span className="text-xs text-slate-500">
                    {plural(carro.servicos, 'serviço')} · {horas(carro.horasEstimadas)}
                  </span>
                  {/* Dia parado em cima de orçamento aprovado é o pior número
                      da oficina: o cliente já aceitou pagar e a vaga segue
                      ocupada. Por isso ele é o único em vermelho desta linha. */}
                  <span
                    className={cx(
                      'whitespace-nowrap text-xs font-semibold tabular-nums',
                      carro.diasParado >= 2
                        ? 'text-red-700'
                        : carro.diasParado >= 1
                          ? 'text-amber-700'
                          : 'text-slate-500',
                    )}
                  >
                    {carro.diasParado === 0
                      ? 'aprovado hoje'
                      : `há ${plural(carro.diasParado, 'dia')}`}
                  </span>
                  <ArrowRight className="size-3.5 flex-none text-slate-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <VisorDeFoto
        foto={fotoAberta}
        osId={vendoFoto?.osId ?? ''}
        onFechar={() => setVendoFoto(null)}
        onMudou={() => consulta.refetch()}
      />
    </div>
  )
}

/** O chão de fábrica numa frase, antes de qualquer número. */
function fraseDoChao(r: PainelExecucao['resumo']): string {
  if (r.carros === 0) {
    return 'Nenhum carro em serviço neste momento.'
  }
  const partes = [`${plural(r.carros, 'carro')} na bancada`]
  if (r.rodando > 0) partes.push(`${plural(r.rodando, 'cronômetro')} rodando`)
  if (r.carrosParados > 0) {
    partes.push(`${r.carrosParados} parado${r.carrosParados > 1 ? 's' : ''}`)
  }
  return `${partes.join(' · ')}.`
}

// ------------------------------------------------------------------- números

const TONS = {
  neutro: { caixa: 'bg-white ring-slate-200', icone: 'bg-slate-100 text-slate-500', numero: 'text-slate-900' },
  ativo: { caixa: 'bg-white ring-blue-200', icone: 'bg-blue-50 text-blue-700', numero: 'text-blue-700' },
  alerta: { caixa: 'bg-white ring-amber-300', icone: 'bg-amber-50 text-amber-700', numero: 'text-amber-700' },
  quente: { caixa: 'bg-white ring-red-200', icone: 'bg-red-50 text-red-700', numero: 'text-red-700' },
  bom: { caixa: 'bg-white ring-slate-200', icone: 'bg-emerald-50 text-emerald-700', numero: 'text-slate-400' },
} as const

function Numero({
  Icone,
  valor,
  rotulo,
  detalhe,
  tom,
}: {
  Icone: typeof Play
  valor: number
  rotulo: string
  detalhe: string
  tom: keyof typeof TONS
}) {
  const t = TONS[tom]
  return (
    <div className={cx('flex items-start gap-3 rounded-xl p-3.5 ring-1', t.caixa)}>
      <span className={cx('grid size-9 flex-none place-items-center rounded-lg', t.icone)}>
        <Icone className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="flex items-baseline gap-1.5">
          <span className={cx('text-2xl font-bold leading-none tabular-nums', t.numero)}>
            {valor}
          </span>
          <span className="text-xs font-medium text-slate-600">{rotulo}</span>
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">{detalhe}</p>
      </div>
    </div>
  )
}

/**
 * Zero que significa "ainda não aconteceu", e não "foi tudo perdido".
 *
 * O painel do dono já pagou por essa lição: anunciar "0%" a partir de
 * ausência de dado é uma frase de oficina falida escrita por um `if` que
 * faltou.
 */
function Placar({
  valor,
  zero,
  um,
  muitos,
}: {
  valor: number
  /** O texto de quando nao houve o que contar. Escrito a mao: concordancia
      montada por codigo erra justamente onde a tela e lida. */
  zero: string
  um: string
  muitos: string
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      {valor > 0 ? (
        <Check className="size-3.5 text-emerald-600" aria-hidden />
      ) : (
        <Circle className="size-3 text-slate-300" aria-hidden />
      )}
      {valor === 0 ? (
        <span className="text-slate-500">{zero}</span>
      ) : (
        <span className="text-slate-700">
          <strong className="font-semibold tabular-nums">{valor}</strong>{' '}
          {valor === 1 ? um : muitos}
        </span>
      )}
    </span>
  )
}

// -------------------------------------------------------------- cartão do carro

function CartaoDoCarro({
  carro,
  agora,
  onAbrirFoto,
}: {
  carro: CarroEmExecucao
  agora: number
  onAbrirFoto: (foto: ArquivoOs) => void
}) {
  const pausado = carro.status === 'PAUSADO'
  const pronto = carro.servicosConcluidos === carro.servicosTotal && carro.servicosTotal > 0

  return (
    <article
      className={cx(
        'flex flex-col overflow-hidden rounded-xl bg-white ring-1',
        pausado ? 'ring-amber-300' : 'ring-slate-200',
      )}
    >
      {/* A faixa no topo repete a cor da etapa na régua da OS. É o que diz,
          sem palavra nenhuma, que este cartão é da etapa 6. */}
      <div
        className={cx('h-1.5 w-full', pausado ? 'bg-amber-400' : pronto ? 'bg-emerald-500' : 'bg-blue-600')}
        aria-hidden
      />

      <Link
        to={`/os/${carro.osId}`}
        className="flex items-start gap-3 px-3.5 py-3 transition hover:bg-slate-50"
      >
        <Rosca feitos={carro.servicosConcluidos} total={carro.servicosTotal} />

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-base font-bold leading-none text-slate-900">
              {carro.placa}
            </span>
            <span className="text-xs text-slate-500">OS {carro.numero}</span>
            {carro.prioridade !== 'NORMAL' && (
              <Etiqueta className={CORES_PRIORIDADE[carro.prioridade]}>
                {carro.prioridade.toLowerCase()}
              </Etiqueta>
            )}
            {/* Carro com tudo feito e ainda em execução é trabalho pronto que
                ninguém fechou: a vaga continua ocupada e o cliente continua
                sem o aviso de que pode buscar. É o achado mais acionável
                desta tela, então ele é dito com palavra, não com cor. */}
            {pronto && (
              <Etiqueta className="bg-emerald-50 text-emerald-800 ring-emerald-300">
                <Check className="size-3" aria-hidden />
                pronto para fechar
              </Etiqueta>
            )}
            {pausado && (
              <Etiqueta className="bg-amber-50 text-amber-900 ring-amber-300">
                <PauseCircle className="size-3" aria-hidden />
                parado
              </Etiqueta>
            )}
          </p>
          <p className="mt-1 truncate text-xs text-slate-600">
            {carro.veiculo}
            {carro.cor ? ` · ${carro.cor}` : ''} · {carro.cliente}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
            {carro.box && (
              <span className="font-medium text-slate-700">{carro.box}</span>
            )}
            {carro.precisaElevador && (
              <span className="inline-flex items-center gap-0.5">
                <ChevronsUp className="size-3" aria-hidden />
                elevador
              </span>
            )}
            {carro.previsaoEntrega && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" aria-hidden />
                entrega {dataCurta(carro.previsaoEntrega)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="size-3" aria-hidden />
              {horas(carro.horasTrabalhadas)} de {horas(carro.horasEstimadas)}
            </span>
          </p>
        </div>

        <ArrowRight className="mt-1 size-4 flex-none text-slate-300" aria-hidden />
      </Link>

      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {carro.servicos.map((servico) => (
          <LinhaDoServico key={servico.itemId} servico={servico} agora={agora} />
        ))}
      </ul>

      {carro.fotos.length > 0 && (
        <div className="border-t border-slate-100 px-3.5 py-2.5">
          <GradeDeFotos fotos={carro.fotos} onAbrir={onAbrirFoto} tira />
        </div>
      )}
    </article>
  )
}

/**
 * O progresso do carro em uma volta.
 *
 * Dois números — "2 de 4" — dizem a mesma coisa e exigem uma conta. A volta
 * responde de relance, que é o que esta tela é: alguém passando o olho em
 * doze carros.
 */
function Rosca({ feitos, total }: { feitos: number; total: number }) {
  const fracao = total > 0 ? feitos / total : 0
  const raio = 19
  const volta = 2 * Math.PI * raio
  const completo = total > 0 && feitos === total

  return (
    <span className="relative grid size-12 flex-none place-items-center">
      <svg viewBox="0 0 44 44" className="absolute size-12 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={raio} fill="none" strokeWidth="3.5" className="stroke-slate-200" />
        <circle
          cx="22"
          cy="22"
          r={raio}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          className={cx('transition-all', completo ? 'stroke-emerald-500' : 'stroke-blue-600')}
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - fracao)}
        />
      </svg>
      {completo ? (
        <Check className="size-5 text-emerald-600" aria-hidden />
      ) : (
        <span className="text-[11px] font-bold tabular-nums leading-none text-slate-700">
          {feitos}
          <span className="font-medium text-slate-500">/{total}</span>
        </span>
      )}
      <span className="sr-only">
        {feitos} de {total} serviços concluídos
      </span>
    </span>
  )
}

function LinhaDoServico({ servico, agora }: { servico: ServicoEmExecucao; agora: number }) {
  const rodando = servico.status === 'EM_EXECUCAO' && Boolean(servico.rodandoDesde)
  const parado = servico.status === 'PAUSADO'
  const concluido = servico.status === 'CONCLUIDO'

  const estimadas = servico.horasEstimadas ?? 0
  const percentual = estimadas > 0 ? (servico.horasTrabalhadas / estimadas) * 100 : 0
  const estourou = !concluido && estimadas > 0 && percentual > 100

  // Serviço feito recua por COR de fundo, e não por opacidade: `opacity`
  // compõe na pintura e derrubava o texto da linha inteira para menos de
  // 3:1 — o risco no texto e o check verde já dizem que acabou.
  return (
    <li className={cx('px-3.5 py-2', parado && 'bg-amber-50/70', concluido && 'bg-slate-50')}>
      <div className="flex items-start gap-2">
        {/* A situação também em palavra.
            Os quatro ícones são `aria-hidden`, e o reforço visual de cada
            estado -- risco no texto, fundo âmbar -- é CSS: para quem lê a
            tela com leitor, concluído, pendente e parado saíam idênticos. */}
        <span className="mt-0.5 flex-none">
          <span className="sr-only">
            {concluido
              ? 'Concluído: '
              : rodando
                ? 'Em execução: '
                : parado
                  ? 'Parado: '
                  : 'Ainda não começou: '}
          </span>
          {concluido ? (
            <Check className="size-3.5 text-emerald-600" aria-hidden />
          ) : rodando ? (
            <Play className="pulsando size-3.5 fill-blue-600 text-blue-600" aria-hidden />
          ) : parado ? (
            <PauseCircle className="size-3.5 text-amber-600" aria-hidden />
          ) : (
            <Circle className="size-3 text-slate-300" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={cx(
              'truncate text-xs font-medium',
              concluido ? 'text-slate-500 line-through' : 'text-slate-800',
            )}
            title={servico.descricao}
          >
            {servico.descricao}
          </p>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            {servico.mecanico ? (
              <span className="truncate font-medium text-slate-600">{servico.mecanico}</span>
            ) : (
              /* slate-500 e nao slate-400: "sem mecânico" e o dado negativo
                 da linha, e saia mais claro que todo o resto dela. */
              !concluido && <span className="text-slate-500">sem mecânico</span>
            )}
            {servico.especialidade && <span>{servico.especialidade}</span>}
            {parado && servico.motivoParada && (
              /* O motivo é a informação mais útil da linha e por isso tem peso
                 de texto, não de etiqueta: "parado" sem o porquê não deixa
                 ninguém resolver nada. */
              <span className="font-medium text-amber-800">
                {servico.motivoParada}
                {servico.paradoDesde && ` · ${desdeDeQuando(servico.paradoDesde, agora)}`}
              </span>
            )}
          </p>
        </div>

        <div className="flex-none text-right">
          {rodando ? (
            <span className="flex items-center gap-1 font-mono text-xs font-bold tabular-nums text-blue-700">
              <Timer className="size-3" aria-hidden />
              {decorrido(servico.rodandoDesde!, agora)}
            </span>
          ) : (
            <span
              className={cx(
                'text-[11px] tabular-nums',
                estourou ? 'font-semibold text-red-700' : 'text-slate-500',
              )}
            >
              {horas(servico.horasTrabalhadas)}
              {estimadas > 0 && <span className="text-slate-500"> / {horas(estimadas)}</span>}
            </span>
          )}
          {estourou && (
            /* A hora que passou, e não o percentual: 3h02 de uma estimativa
               de 3h dava "0% a mais" em vermelho, com triângulo de alerta —
               um alarme que quantifica o estouro como nada. E hora é o
               número sobre o qual o dono age. */
            <span className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] font-semibold text-red-700">
              <TriangleAlert className="size-2.5" aria-hidden />
              {horas(servico.horasTrabalhadas - estimadas)} a mais
            </span>
          )}
        </div>
      </div>

      {/* A barra só existe onde há estimativa com que comparar. Desenhar uma
          barra vazia para serviço sem previsão seria inventar uma régua. */}
      {!concluido && estimadas > 0 && (
        <div className="mt-1.5">
          {/* O componente do projeto, e não uma terceira cópia desta barra.
              A versão à mão tinha piso de 2%, que pintava de azul -- a cor
              de "rodando" nesta tela -- um serviço que ninguém começou. */}
          <Barra
            percentual={percentual}
            altura="h-1"
            cor={estourou ? 'bg-red-500' : parado ? 'bg-amber-400' : 'bg-blue-600'}
          />
        </div>
      )}
    </li>
  )
}

/** "parado agora mesmo" x "parado há 2h40": a preposição depende do texto. */
function desdeDeQuando(iso: string, agora: number): string {
  const texto = desdeEmTexto(iso, agora)
  return texto === 'agora mesmo' ? texto : `há ${texto}`
}

/** "2h40" ou "3 dias" — o que couber na linha sem virar cronômetro. */
function desdeEmTexto(iso: string, agora: number): string {
  const minutos = Math.max(Math.floor((agora - new Date(iso).getTime()) / 60_000), 0)
  // "parado há 0min" é uma frase que não quer dizer nada.
  if (minutos < 1) return 'agora mesmo'
  if (minutos < 60) return `${minutos}min`
  const h = Math.floor(minutos / 60)
  if (h < 24) return `${h}h${String(minutos % 60).padStart(2, '0')}`
  return plural(Math.floor(h / 24), 'dia')
}
