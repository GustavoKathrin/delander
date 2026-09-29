import { AlertTriangle, Check, ChevronDown, PauseCircle, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Botao, cx } from '../../components/ui'
import type { StatusOs } from '../../types'

/**
 * Onde o carro está, e qual é o próximo passo.
 *
 * Antes isto eram botões soltos no canto superior direito do cartão do
 * carro. Funcionava para quem já sabia o fluxo de cor — e para todo o
 * resto parecia um menu de opções, não uma sequência. Mecânico novo
 * abria a OS e não sabia se devia apertar "Iniciar diagnóstico" ou se
 * aquilo era opcional.
 *
 * A régua resolve isso sem trancar nada: mostra as etapas na ordem, marca
 * onde o carro está, e põe o próximo passo como o botão grande do meio da
 * tela. Continua sendo possível voltar ou pular — o servidor é quem decide
 * o que vale — mas o caminho normal fica óbvio.
 */

/**
 * As etapas do jeito que a oficina fala, que não é o mesmo que os estados
 * do servidor.
 *
 * PAUSADO não é etapa: é o carro parado *dentro* da execução, e vira um
 * aviso em cima da régua. CANCELADO também não — é a régua inteira virar
 * passado. Tratar os dois como coluna faria uma régua de nove caixinhas
 * que ninguém lê.
 */
const ETAPAS = [
  { chave: 'ENTRADA', rotulo: 'Entrada' },
  { chave: 'DIAGNOSTICO', rotulo: 'Diagnóstico' },
  { chave: 'ORCAMENTO', rotulo: 'Orçamento' },
  { chave: 'EXECUCAO', rotulo: 'Execução' },
  { chave: 'PRONTO', rotulo: 'Pronto' },
  { chave: 'ENTREGUE', rotulo: 'Entregue' },
] as const

type ChaveEtapa = (typeof ETAPAS)[number]['chave']

const ETAPA_DO_STATUS: Record<StatusOs, ChaveEtapa> = {
  RECEBIDO: 'ENTRADA',
  AGENDADO: 'ENTRADA',
  EM_DIAGNOSTICO: 'DIAGNOSTICO',
  AGUARDANDO_APROVACAO: 'ORCAMENTO',
  ORCAMENTO_APROVADO: 'ORCAMENTO',
  EM_EXECUCAO: 'EXECUCAO',
  PAUSADO: 'EXECUCAO',
  PRONTO_AGUARDANDO_RETIRADA: 'PRONTO',
  ENTREGUE: 'ENTREGUE',
  CANCELADO: 'ENTRADA',
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
  const indiceDe = ETAPAS.findIndex((e) => e.chave === ETAPA_DO_STATUS[de])
  const indicePara = ETAPAS.findIndex((e) => e.chave === ETAPA_DO_STATUS[para])
  if (indicePara <= indiceDe) return 'secundario'
  return 'primario'
}

export function EtapasDaOs({
  status,
  proximos,
  rotulo,
  salvando,
  onAcionar,
}: {
  status: StatusOs
  /** Já filtrado por perfil por quem chama: aqui só entra o que a pessoa pode. */
  proximos: StatusOs[]
  rotulo: (de: StatusOs, para: StatusOs) => string
  salvando: boolean
  onAcionar: (destino: StatusOs) => void
}) {
  const [abertas, setAbertas] = useState(false)
  // Fecha de novo quando o carro anda: as opcoes de outra etapa nao sao as
  // mesmas, e deixar aberto mostraria a lista errada.
  useEffect(() => setAbertas(false), [status])

  const cancelada = status === 'CANCELADO'
  const pausada = status === 'PAUSADO'
  const atual = ETAPA_DO_STATUS[status]
  const indiceAtual = ETAPAS.findIndex((e) => e.chave === atual)

  const avancos = proximos.filter((p) => p !== 'CANCELADO')
  const podeCancelar = proximos.includes('CANCELADO')

  // O passo principal é o primeiro que o servidor oferece e que leva adiante;
  // os outros ficam como alternativa, em botão menor.
  const principal = avancos.find((p) => ETAPAS.findIndex((e) => e.chave === ETAPA_DO_STATUS[p]) > indiceAtual)
    ?? avancos[0]
  const alternativos = avancos.filter((p) => p !== principal)

  return (
    <div
      className={cx(
        'rounded-xl p-4 ring-1',
        cancelada
          ? 'bg-slate-50 ring-slate-200'
          : pausada
            ? 'bg-amber-50 ring-amber-200'
            : 'bg-white ring-slate-200',
      )}
    >
      {/* ---------------- a régua ---------------- */}
      <ol className="flex items-center gap-1">
        {ETAPAS.map((etapa, indice) => {
          const feita = !cancelada && indice < indiceAtual
          const aqui = !cancelada && indice === indiceAtual
          return (
            <li key={etapa.chave} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center gap-1">
                <span
                  className={cx(
                    'h-0.5 flex-1 rounded',
                    indice === 0 ? 'opacity-0' : feita || aqui ? 'bg-marca-600' : 'bg-slate-200',
                  )}
                />
                <span
                  className={cx(
                    'grid size-6 flex-none place-items-center rounded-full text-[11px] font-semibold ring-2',
                    feita
                      ? 'bg-marca-600 text-white ring-marca-600'
                      : aqui
                        ? cx(
                            'ring-marca-600 bg-white text-marca-700',
                            pausada && 'ring-amber-500 text-amber-700',
                          )
                        : 'bg-white text-slate-300 ring-slate-200',
                  )}
                >
                  {feita ? <Check className="size-3.5" aria-hidden /> : indice + 1}
                </span>
                <span
                  className={cx(
                    'h-0.5 flex-1 rounded',
                    indice === ETAPAS.length - 1
                      ? 'opacity-0'
                      : feita
                        ? 'bg-marca-600'
                        : 'bg-slate-200',
                  )}
                />
              </div>
              <span
                className={cx(
                  'truncate text-center text-[11px] leading-tight',
                  aqui ? 'font-semibold text-slate-900' : feita ? 'text-slate-600' : 'text-slate-400',
                )}
              >
                {etapa.rotulo}
              </span>
            </li>
          )
        })}
      </ol>

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
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                  Outras opções ({alternativos.length})
                </button>
              )}
            </div>
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
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
          >
            <AlertTriangle className="size-3.5" aria-hidden />
            Cancelar OS
          </button>
        </div>
      )}
    </div>
  )
}
