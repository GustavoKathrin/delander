import { AlertTriangle, Check, ChevronDown, ChevronUp, PauseCircle, Wrench } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Botao, cx } from '../../components/ui'
import type { DetalheOs, StatusOs } from '../../types'

/**
 * Onde o carro está, o que se faz aqui, e qual é o próximo passo.
 *
 * Antes isto eram botões soltos no canto superior direito do cartão do
 * carro. Funcionava para quem já sabia o fluxo de cor — e para todo o
 * resto parecia um menu de opções, não uma sequência.
 *
 * A régua resolve isso sem trancar nada: mostra as etapas na ordem, marca
 * onde o carro está, e põe o próximo passo como o botão grande do meio da
 * tela. Continua sendo possível voltar ou pular — o servidor é quem decide
 * o que vale — mas o caminho normal fica óbvio.
 *
 * **A régua mudou de vocabulário.** Ela mostrava seis caixinhas com os
 * ESTADOS do servidor — "Entrada, Diagnóstico, Orçamento, Execução, Pronto,
 * Entregue". O dono descreveu o trabalho dele em sete etapas, e a palavra
 * "Execução" não existe nelas: o que ele chama de etapa 6 é o serviço
 * acontecendo. Uma régua que nomeia o fluxo com outro vocabulário obriga
 * cada pessoa a traduzir, toda vez.
 */

/** As sete etapas, do jeito que a oficina fala. */
export const ETAPAS = [
  {
    n: 1,
    rotulo: 'Recebimento',
    /**
     * A cor é o que liga a etapa ao conteúdo dela.
     *
     * Serviço e peça viviam em cartões soltos, visualmente iguais à linha
     * do tempo e à wiki — nada dizia que aquilo era a etapa 2. A barra
     * colorida à esquerda de cada seção repete a cor da etapa na régua, e
     * é só isso que ela faz: dizer "isto aqui é daquela caixinha ali".
     */
    bar: 'bg-slate-400',
    ponto: 'bg-slate-600 text-white ring-slate-600',
    aqui: 'ring-slate-500 text-slate-800',
    chip: 'bg-slate-100 text-slate-800 ring-slate-300',
    trilho: 'bg-slate-400',
  },
  {
    n: 2,
    rotulo: 'Peças e serviços',
    bar: 'bg-sky-500',
    ponto: 'bg-sky-600 text-white ring-sky-600',
    aqui: 'ring-sky-600 text-sky-800',
    chip: 'bg-sky-50 text-sky-900 ring-sky-300',
    trilho: 'bg-sky-500',
  },
  {
    n: 3,
    rotulo: 'Cotação',
    bar: 'bg-amber-500',
    ponto: 'bg-amber-600 text-white ring-amber-600',
    aqui: 'ring-amber-600 text-amber-800',
    chip: 'bg-amber-50 text-amber-900 ring-amber-300',
    trilho: 'bg-amber-500',
  },
  {
    n: 4,
    rotulo: 'Mão de obra',
    bar: 'bg-teal-500',
    ponto: 'bg-teal-600 text-white ring-teal-600',
    aqui: 'ring-teal-600 text-teal-800',
    chip: 'bg-teal-50 text-teal-900 ring-teal-300',
    trilho: 'bg-teal-500',
  },
  {
    n: 5,
    rotulo: 'Aprovação',
    bar: 'bg-violet-500',
    ponto: 'bg-violet-600 text-white ring-violet-600',
    aqui: 'ring-violet-600 text-violet-800',
    chip: 'bg-violet-50 text-violet-900 ring-violet-300',
    trilho: 'bg-violet-500',
  },
  {
    n: 6,
    rotulo: 'Serviço',
    // `marca` nao serve aqui: ela e a cor da MARCA DA OFICINA, trocada em
    // tempo de execucao pelo tema (Configuracoes > Layout). No Delander ela
    // e cinza-quase-preto, e a etapa 6 saia com a faixa preta e o ponto
    // igualzinho ao de uma etapa ja vencida. A cor da etapa precisa ser
    // dela, nao da marca.
    bar: 'bg-blue-600',
    ponto: 'bg-blue-600 text-white ring-blue-600',
    aqui: 'ring-blue-600 text-blue-800',
    chip: 'bg-blue-50 text-blue-900 ring-blue-300',
    trilho: 'bg-blue-600',
  },
  {
    n: 7,
    rotulo: 'Entrega',
    bar: 'bg-emerald-500',
    ponto: 'bg-emerald-600 text-white ring-emerald-600',
    aqui: 'ring-emerald-600 text-emerald-800',
    chip: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
    trilho: 'bg-emerald-500',
  },
] as const

export type Etapa = (typeof ETAPAS)[number]

export const etapa = (n: number): Etapa => ETAPAS[Math.min(Math.max(n, 1), 7) - 1]

/**
 * Em que etapa este carro está.
 *
 * Três das sete etapas — peças, cotação e mão de obra — acontecem todas com
 * a OS em `EM_DIAGNOSTICO`: é o mesmo carro mudando de mão (mecânico →
 * balcão), não de lugar. Criar um estado de banco para cada uma custaria a
 * máquina de estados, o check do banco, o Pátio, o Quadro, o Radar e os
 * testes — para descrever algo que o dado já sabe dizer.
 *
 * Então o dado diz: lançou serviço? cotou a peça? Note que a conta NÃO usa
 * preço. Preço é mascarado para quem não pode ver dinheiro, e com isso a
 * régua mostraria uma etapa para o dono e outra para o mecânico olhando o
 * mesmo carro. O que serve é o status da peça, que todo mundo vê.
 */
export function etapaDaOs(os: DetalheOs): number {
  const status = os.resumo.status

  if (status === 'RECEBIDO' || status === 'AGENDADO' || status === 'CANCELADO') return 1
  if (status === 'AGUARDANDO_APROVACAO' || status === 'ORCAMENTO_APROVADO') return 5
  if (status === 'EM_EXECUCAO' || status === 'PAUSADO') return 6
  if (status === 'PRONTO_AGUARDANDO_RETIRADA' || status === 'ENTREGUE') return 7

  // EM_DIAGNOSTICO: 2, 3 ou 4.
  const servicos = os.itens.filter((i) => i.status !== 'CANCELADO')
  if (servicos.length === 0) return 2

  const aCotar = os.pecas.some((p) => p.origem === 'COMPRAR' && p.status === 'SOLICITADA')
  if (aCotar) return 3

  return 4
}

/**
 * A cor do botão diz o que a ação faz, antes de alguém ler o rótulo.
 *
 * Verde é "acabou bem" — o carro fica pronto, o carro sai. Vermelho é
 * desfazer. Cinza é desvio: pausar, ou o cliente ter dito não. Azul é
 * seguir em frente, que é a maioria.
 */
function varianteDaAcao(
  de: StatusOs,
  para: StatusOs,
): 'primario' | 'secundario' | 'sucesso' | 'perigo' {
  if (para === 'CANCELADO') return 'perigo'
  if (para === 'PRONTO_AGUARDANDO_RETIRADA' || para === 'ENTREGUE') return 'sucesso'
  if (para === 'PAUSADO') return 'secundario'
  // Voltar etapa nunca é o caminho normal — nem quando o destino, sozinho,
  // pareceria um avanço. "Aprovar orçamento" com o carro já em execução é
  // desfazer, e em azul de ação principal competia com "Marcar como pronto".
  if (ordemDoStatus(para) <= ordemDoStatus(de)) return 'secundario'
  return 'primario'
}

/** Só para comparar avanço e recuo: a etapa mínima a que o status pertence. */
function ordemDoStatus(status: StatusOs): number {
  switch (status) {
    case 'RECEBIDO':
    case 'AGENDADO':
    case 'CANCELADO':
      return 1
    case 'EM_DIAGNOSTICO':
      return 2
    case 'AGUARDANDO_APROVACAO':
    case 'ORCAMENTO_APROVADO':
      return 5
    case 'EM_EXECUCAO':
    case 'PAUSADO':
      return 6
    default:
      return 7
  }
}

export function EtapasDaOs({
  status,
  etapaAtual,
  proximos,
  rotulo,
  salvando,
  onAcionar,
  requisitos,
  children,
  outrasEtapas,
  outrasAbertas = false,
  onVerOutras,
}: {
  status: StatusOs
  /** 1 a 7. Vem de `etapaDaOs`, que lê o dado além do status. */
  etapaAtual: number
  /** Já filtrado por perfil por quem chama: aqui só entra o que a pessoa pode. */
  proximos: StatusOs[]
  rotulo: (de: StatusOs, para: StatusOs) => string
  salvando: boolean
  onAcionar: (destino: StatusOs) => void
  /**
   * O que falta para sair desta etapa, com a ação de cada pendência.
   *
   * Entra AQUI DENTRO, entre a régua e o botão, e não num cartão solto lá
   * embaixo: é a etapa que define o que precisa estar pronto.
   */
  requisitos?: ReactNode
  /**
   * O conteúdo DESTA etapa, e só dele: serviços, peças, valores, fotos.
   *
   * Eram cartões soltos abaixo da régua, visualmente iguais à linha do
   * tempo e à wiki. O dono: "quero que suma o card de serviços e peça,
   * isso tem que estar dentro do mesmo card ali relacionado à etapa".
   */
  children?: ReactNode
  /**
   * O que é das outras etapas, atrás de um toque.
   *
   * Mostrar tudo de uma vez foi a primeira tentativa, e o dono recusou:
   * "em cada etapa só quero os campos necessários para concluir cada
   * etapa". Mas esconder de vez também não serve — conferir a vistoria de
   * entrada com o carro já na bancada é uma coisa que se faz. Fechado por
   * padrão, e fecha de novo sozinho quando o carro anda de etapa.
   */
  outrasEtapas?: ReactNode
  /**
   * A gaveta esta aberta? Controlada de fora porque quem precisa abri-la
   * nem sempre e o toque do usuario: "Tirar foto", na etapa 5, rola a tela
   * ate a vistoria de entrada, que naquela etapa mora aqui dentro.
   */
  outrasAbertas?: boolean
  onVerOutras?: (aberta: boolean) => void
}) {
  const [abertas, setAbertas] = useState(false)
  // Fecha de novo quando o carro anda: as opcoes de outra etapa nao sao as
  // mesmas, e deixar aberto mostraria a lista errada.
  useEffect(() => setAbertas(false), [status])

  const cancelada = status === 'CANCELADO'
  const pausada = status === 'PAUSADO'
  const indiceAtual = Math.min(Math.max(etapaAtual, 1), ETAPAS.length) - 1
  const atual = ETAPAS[indiceAtual]

  const avancos = proximos.filter((p) => p !== 'CANCELADO')
  const podeCancelar = proximos.includes('CANCELADO')

  // O passo principal é o primeiro que o servidor oferece e que leva adiante;
  // os outros ficam como alternativa, em botão menor.
  const principal =
    avancos.find((p) => ordemDoStatus(p) > ordemDoStatus(status)) ?? avancos[0]
  const alternativos = avancos.filter((p) => p !== principal)

  return (
    <div
      className={cx(
        'overflow-hidden rounded-xl ring-1',
        cancelada
          ? 'bg-slate-50 ring-slate-200'
          : pausada
            ? 'bg-amber-50 ring-amber-200'
            : 'bg-white ring-slate-200',
      )}
    >
      {/* A faixa no topo, na cor da etapa. É o "status bar" que o dono pediu:
          a mesma cor volta na barra de cada seção lá embaixo, e é por ela que
          se sabe que aquele conteúdo pertence a esta etapa. */}
      <div className={cx('h-1.5 w-full', cancelada ? 'bg-slate-300' : atual.bar)} aria-hidden />

      <div className="p-4">
        {/* ---------------- a régua ---------------- */}
        <ol className="flex items-center gap-0.5">
          {ETAPAS.map((e, indice) => {
            const feita = !cancelada && indice < indiceAtual
            const aqui = !cancelada && indice === indiceAtual
            return (
              <li key={e.n} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full items-center gap-0.5">
                  <span
                    className={cx(
                      'h-0.5 flex-1 rounded',
                      indice === 0 ? 'opacity-0' : feita || aqui ? ETAPAS[indice - 1].trilho : 'bg-slate-200',
                    )}
                  />
                  <span
                    className={cx(
                      'grid size-6 flex-none place-items-center rounded-full text-[11px] font-semibold ring-2',
                      feita
                        ? e.ponto
                        : aqui
                          ? cx('bg-white', e.aqui, pausada && 'ring-amber-500 text-amber-700')
                          : 'bg-white text-slate-300 ring-slate-200',
                    )}
                  >
                    {feita ? <Check className="size-3.5" aria-hidden /> : e.n}
                  </span>
                  <span
                    className={cx(
                      'h-0.5 flex-1 rounded',
                      indice === ETAPAS.length - 1 ? 'opacity-0' : feita ? e.trilho : 'bg-slate-200',
                    )}
                  />
                </div>
                {/*
                  Os sete rótulos só cabem a partir de 768px.
                  Mostrar só o da etapa atual no celular parecia a saída, mas
                  "Peças e serviços" tem 100px em 11px e a coluna tem 50: o
                  nome vazava por cima dos números vizinhos. Quem resolve isso
                  é a linha inteira logo abaixo, que tem a largura do cartão.
                */}
                <span
                  className={cx(
                    'hidden w-full truncate text-center text-[11px] leading-tight md:inline',
                    aqui
                      ? 'font-semibold text-slate-900'
                      : feita
                        ? 'text-slate-600'
                        : 'text-slate-400',
                  )}
                >
                  {e.rotulo}
                </span>
              </li>
            )
          })}
        </ol>

        {/* O nome da etapa atual mora aqui, e não sob o ponto: aqui ele tem a
            largura do cartão inteiro para caber. */}
        {!cancelada && (
          <p className="mt-1.5 text-center">
            <span className="text-sm font-semibold text-slate-900">
              Etapa {atual.n} de {ETAPAS.length} · {atual.rotulo}
            </span>
            {atual.n < ETAPAS.length && (
              <span className="mt-0.5 block text-[11px] text-slate-500">
                depois vem {ETAPAS[indiceAtual + 1].rotulo}
              </span>
            )}
          </p>
        )}

        {/* ---------------- o que está acontecendo ---------------- */}
        {cancelada ? (
          <p className="mt-4 text-center text-sm font-medium text-slate-500">
            Esta OS foi cancelada.
          </p>
        ) : pausada ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-amber-800">
            <PauseCircle className="size-4" aria-hidden />
            Serviço parado — retome quando destravar
          </p>
        ) : null}

        {requisitos}

        {/* ---------------- o que se faz nesta etapa ---------------- */}
        {children && <div className="mt-4 space-y-4">{children}</div>}

        {/* ---------------- o próximo passo ---------------- */}
        {avancos.length > 0 && (
          <div className="mt-4 space-y-2">
            {principal && (
              <Botao
                bloco
                tamanho="lg"
                variante={varianteDaAcao(status, principal)}
                carregando={salvando}
                onClick={() => onAcionar(principal)}
              >
                {principal === 'PAUSADO' ? (
                  <PauseCircle className="size-4" aria-hidden />
                ) : principal === 'EM_EXECUCAO' ? (
                  <Wrench className="size-4" aria-hidden />
                ) : null}
                {rotulo(status, principal)}
              </Botao>
            )}

            {/* As alternativas ficam atrás de um toque.
                Soltas ao lado do passo principal, elas competiam com ele: quem
                abria a OS via cinco botões e não sabia qual era o caminho. O
                desvio existe e continua a um clique — só deixou de gritar. */}
            {alternativos.length > 0 && (
              <div className="text-center">
                {abertas ? (
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {alternativos.map((destino) => (
                      <Botao
                        key={destino}
                        tamanho="sm"
                        variante={varianteDaAcao(status, destino)}
                        carregando={salvando}
                        onClick={() => onAcionar(destino)}
                      >
                        {destino === 'PAUSADO' && <PauseCircle className="size-3.5" aria-hidden />}
                        {rotulo(status, destino)}
                      </Botao>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAbertas(true)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    <ChevronDown className="size-3.5" aria-hidden />
                    Outras opções ({alternativos.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- o que é das outras etapas ----------------
            Depois do botão do próximo passo, porque isto é consulta e não
            ação: não pode competir com o passo da etapa pelo polegar. */}
        {outrasEtapas && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            {outrasAbertas ? (
              <>
                <button
                  type="button"
                  onClick={() => onVerOutras?.(false)}
                  className="mx-auto flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <ChevronUp className="size-3.5" aria-hidden />
                  Esconder as outras etapas
                </button>
                <div className="mt-2 space-y-4">{outrasEtapas}</div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onVerOutras?.(true)}
                className="mx-auto flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <ChevronDown className="size-3.5" aria-hidden />
                Ver o que é das outras etapas
              </button>
            )}
          </div>
        )}

        {/* Cancelar é vermelho, como o dono pediu, mas separado por uma linha e
            fora do caminho do polegar: cancelar não tem volta na máquina de
            estados, e o modal de motivo é a última chance de desistir. */}
        {podeCancelar && (
          <div className="mt-3 flex justify-center border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => onAcionar('CANCELADO')}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-red-700 transition hover:bg-red-50"
            >
              <AlertTriangle className="size-3.5" aria-hidden />
              Cancelar OS
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Uma seção de conteúdo dentro da etapa.
 *
 * Não é um `Cartao`: cartão dentro de cartão vira caixa dentro de caixa, e
 * no celular a margem dupla come 32px de largura útil. O que marca a seção
 * é a barra colorida da etapa à esquerda — a mesma cor da faixa lá em cima.
 */
export function SecaoDaEtapa({
  etapa: numero,
  titulo,
  descricao,
  acao,
  children,
}: {
  etapa: number
  titulo: string
  descricao?: string
  acao?: ReactNode
  children: ReactNode
}) {
  const e = etapa(numero)
  return (
    <section className="overflow-hidden rounded-lg bg-slate-50/70 ring-1 ring-slate-200">
      <div className="flex">
        <div className={cx('w-1 flex-none', e.bar)} aria-hidden />
        <div className="min-w-0 flex-1">
          {/* No celular o botao desce.
              Lado a lado em 375px ele tomava 130px dos 310 uteis e espremia
              a descricao em cinco linhas de tres palavras. */}
          <header className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-start">
            <div className="min-w-0 flex-1">
              <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
                {titulo}
                <span
                  className={cx(
                    'rounded-full px-1.5 py-px text-[10px] font-semibold leading-tight ring-1',
                    e.chip,
                  )}
                >
                  etapa {e.n}
                </span>
              </h3>
              {descricao && <p className="mt-0.5 text-xs text-slate-600">{descricao}</p>}
            </div>
            {acao && <div className="self-start">{acao}</div>}
          </header>
          <div className="bg-white">{children}</div>
        </div>
      </div>
    </section>
  )
}
