import { AlertTriangle, Camera, Check, Plus, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'

import { cx } from '../../components/ui'
import { CHAVES, useConfig } from '../../lib/config'
import type { DetalheOs, StatusOs } from '../../types'
import { plural } from '../../lib/format'

/**
 * O que falta para sair desta etapa.
 *
 * A regua dizia ONDE o carro esta e qual o botao do proximo passo, mas nao
 * dizia o que precisa estar pronto antes de apertar. O resultado e que
 * servico e peca viviam em cartoes soltos la embaixo, sem ligacao nenhuma com
 * a etapa -- dava para "Enviar orcamento" com ZERO servico lancado, e o
 * orcamento saia vazio. O dono resumiu assim: "o servico tinha que estar
 * dentro da etapa, nao fora, fica confuso".
 *
 * Entao a etapa passa a carregar a propria lista: o que ja esta feito, o que
 * falta, e o botao que resolve cada pendencia ali mesmo -- sem rolar a tela
 * atras do cartao certo.
 *
 * O que ele NAO faz: travar. O servidor e quem decide qual transicao vale, e
 * uma trava na tela seria uma segunda fonte de verdade -- a oficina que nao
 * conseguiu fotografar porque o celular morreu ficaria com o carro preso na
 * entrada para sempre. Aqui a pendencia fica impossivel de nao ver; seguir
 * assim mesmo continua sendo escolha de quem esta no balcao.
 */

interface Pendencia {
  chave: string
  /** Frase curta, do jeito que a oficina fala. */
  rotulo: string
  pronto: boolean
  /**
   * O servidor recusa a transicao sem isto.
   *
   * Importa a distincao: o que e so bom habito aparece como sugestao e nao
   * assusta; o que trava de verdade precisa dizer que trava, senao a pessoa
   * so descobre no erro vermelho depois de apertar o botao.
   */
  exigida?: boolean
  /**
   * O que ja foi lancado, por nome.
   *
   * Contagem nao e lista: "3 servicos lancados" obriga o mecanico a rolar a
   * tela ate o cartao de baixo so para lembrar se ja pos a correia. Com os
   * nomes aqui dentro, a etapa responde sozinha "o que eu ja disse que este
   * carro precisa?" -- que e a pergunta da etapa 2.
   */
  lista?: string[]
  /** Por que isso importa. So aparece quando esta pendente. */
  porque?: string
  acao?: { rotulo: string; icone: ReactNode; onClick: () => void }
}

/** A etapa de onde o carro esta tentando sair, em linguagem de oficina. */
function pendenciasDaEtapa(
  os: DetalheOs,
  acoes: { onAdicionarServico: () => void; onAdicionarPeca: () => void; onIrParaFotos: () => void },
  exige: { foto: boolean; checklist: boolean },
): { titulo: string; itens: Pendencia[] } | null {
  const status: StatusOs = os.resumo.status
  const temFotoEntrada = os.arquivos.some((a) => a.momento === 'ENTRADA')
  const checklistRespondido =
    os.checklist.length === 0 || os.checklist.every((c) => c.ok !== undefined && c.ok !== null)
  const servicos = os.itens.filter((i) => i.status !== 'CANCELADO')
  const servicosAbertos = servicos.filter((i) => i.status !== 'CONCLUIDO')

  const foto: Pendencia = {
    chave: 'foto',
    rotulo: 'Foto do carro na entrada',
    pronto: temFotoEntrada,
    exigida: exige.foto,
    porque: exige.foto
      ? 'É a prova de como o carro chegou, e o sistema não deixa avançar sem ela. Sem foto, risco e amassado viram palavra contra palavra.'
      : 'É a prova de como o carro chegou. Sem ela, risco e amassado viram palavra contra palavra.',
    acao: { rotulo: 'Tirar foto', icone: <Camera className="size-4" aria-hidden />, onClick: acoes.onIrParaFotos },
  }

  switch (status) {
    case 'RECEBIDO':
    case 'AGENDADO':
      return {
        titulo: 'Antes de começar a mexer no carro',
        itens: [
          foto,
          {
            chave: 'checklist',
            rotulo: 'Vistoria de entrada respondida',
            pronto: checklistRespondido,
            exigida: exige.checklist,
            porque: exige.checklist
              ? 'O que já estava quebrado antes de entrar precisa estar registrado, e o sistema não deixa avançar sem isso.'
              : 'O que já estava quebrado antes de entrar precisa estar registrado.',
            acao: {
              rotulo: 'Responder',
              icone: <Check className="size-4" aria-hidden />,
              onClick: acoes.onIrParaFotos,
            },
          },
        ],
      }

    case 'EM_DIAGNOSTICO':
      return {
        titulo: 'Para o orçamento sair completo',
        itens: [
          foto,
          {
            chave: 'servicos',
            rotulo:
              servicos.length === 0
                ? 'Nenhum serviço lançado'
                : `${servicos.length === 1 ? '1 serviço lançado' : `${servicos.length} serviços lançados`}`,
            pronto: servicos.length > 0,
            lista: servicos.map((i) => i.descricao),
            exigida: true,
            porque: 'O orçamento é a soma dos serviços. Sem nenhum, o cliente recebe um papel vazio.',
            acao: {
              rotulo: 'Adicionar serviço',
              icone: <Plus className="size-4" aria-hidden />,
              onClick: acoes.onAdicionarServico,
            },
          },
          {
            chave: 'pecas',
            rotulo:
              os.pecas.length === 0
                ? 'Nenhuma peça registrada'
                : `${os.pecas.length === 1 ? '1 peça registrada' : `${os.pecas.length} peças registradas`}`,
            // Peca e opcional de verdade: tem servico que e so mao de obra.
            pronto: true,
            lista: os.pecas.map((p) => p.descricao),
            acao: {
              rotulo: 'Registrar peça',
              icone: <Plus className="size-4" aria-hidden />,
              onClick: acoes.onAdicionarPeca,
            },
          },
        ],
      }

    case 'ORCAMENTO_APROVADO':
      return {
        titulo: 'Para começar a execução',
        itens: [
          {
            chave: 'servicos',
            rotulo:
              servicos.length === 0 ? 'Nenhum serviço para executar' : `${plural(servicos.length, 'serviço')} ${servicos.length === 1 ? 'aprovado' : 'aprovados'}`,
            pronto: servicos.length > 0,
            lista: servicos.map((i) => i.descricao),
            porque: 'Não há o que executar sem serviço lançado.',
            acao: {
              rotulo: 'Adicionar serviço',
              icone: <Plus className="size-4" aria-hidden />,
              onClick: acoes.onAdicionarServico,
            },
          },
          {
            chave: 'pecas',
            rotulo: 'Peças que faltam já pedidas',
            pronto: true,
            acao: {
              rotulo: 'Registrar peça',
              icone: <Plus className="size-4" aria-hidden />,
              onClick: acoes.onAdicionarPeca,
            },
          },
        ],
      }

    case 'EM_EXECUCAO':
    case 'PAUSADO':
      return {
        titulo: 'Para marcar o carro como pronto',
        itens: [
          {
            chave: 'servicos',
            rotulo:
              servicosAbertos.length === 0
                ? 'Todos os serviços concluídos'
                : `${servicosAbertos.length === 1 ? '1 serviço ainda aberto' : `${servicosAbertos.length} serviços ainda abertos`}`,
            pronto: servicos.length > 0 && servicosAbertos.length === 0,
            porque:
              'Serviço que fica aberto não entra na conta de horas, e o relatório do dono sai errado.',
            acao: {
              rotulo: 'Adicionar serviço',
              icone: <Wrench className="size-4" aria-hidden />,
              onClick: acoes.onAdicionarServico,
            },
          },
        ],
      }

    // Orcamento esperando o cliente e carro pronto/entregue nao tem pendencia
    // DA OFICINA: inventar uma lista vazia ali so faria ruido.
    default:
      return null
  }
}

export function RequisitosDaEtapa({
  os,
  onAdicionarServico,
  onAdicionarPeca,
  onIrParaFotos,
}: {
  os: DetalheOs
  onAdicionarServico: () => void
  onAdicionarPeca: () => void
  onIrParaFotos: () => void
}) {
  const { flag } = useConfig()
  const bloco = pendenciasDaEtapa(
    os,
    { onAdicionarServico, onAdicionarPeca, onIrParaFotos },
    { foto: flag(CHAVES.exigirFotos), checklist: flag(CHAVES.exigirChecklist) },
  )
  if (!bloco) return null

  const faltando = bloco.itens.filter((i) => !i.pronto)
  // O que TRAVA e o que decide a cor do bloco e o tom da frase. Pendencia que
  // e so recomendacao nao pode pintar a tela de ambar como se barrasse.
  const trava = faltando.filter((i) => i.exigida)

  return (
    <div
      className={cx(
        'mt-4 rounded-xl p-3 ring-1',
        trava.length > 0
          ? 'bg-amber-50/70 ring-amber-200'
          : 'bg-slate-50 ring-slate-200',
      )}
    >
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-slate-700">
        {trava.length > 0 && (
          <AlertTriangle className="size-3.5 flex-none text-amber-600" aria-hidden />
        )}
        {bloco.titulo}
        {trava.length > 0 ? (
          <span className="font-normal text-amber-900">
            — o sistema não deixa avançar sem {trava.length === 1 ? 'isto' : 'estes itens'}
          </span>
        ) : (
          faltando.length > 0 && (
            <span className="font-normal text-slate-500">
              — falta {faltando.length === 1 ? '1 coisa' : `${faltando.length} coisas`}, mas dá para
              seguir
            </span>
          )
        )}
      </p>

      <ul className="mt-2 space-y-1.5">
        {bloco.itens.map((item) => {
          const vazio = item.lista !== undefined && item.lista.length === 0
          return (
          <li key={item.chave} className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cx(
                'grid size-5 flex-none place-items-center rounded-full text-[11px] font-bold',
                !item.pronto
                  ? item.exigida
                    ? 'bg-white text-amber-700 ring-1 ring-amber-300'
                    : 'bg-white text-slate-400 ring-1 ring-slate-300'
                  : vazio
                    ? 'bg-white text-slate-400 ring-1 ring-slate-300'
                    : 'bg-emerald-600 text-white',
              )}
              aria-hidden
            >
              {/* Check verde e "feito". Item opcional sem nada dentro --
                  "Nenhuma peca registrada" -- nao e conquista nenhuma, e
                  pintar de verde ensina a ignorar o verde. */}
              {!item.pronto ? (item.exigida ? '!' : '–') : vazio ? '–' : <Check className="size-3" />}
            </span>

            <span className={cx('min-w-0', item.pronto ? 'text-slate-600' : 'font-medium text-slate-900')}>
              {item.rotulo}
              <span className="sr-only">{item.pronto ? ' — feito' : ' — pendente'}</span>
            </span>

            {item.acao && (
              <button
                type="button"
                onClick={item.acao.onClick}
                // 44px: entra na mesma regra do resto da tela -- quem aperta
                // isto esta de luva, com o tablet numa mao.
                className={cx(
                  'ml-auto flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition',
                  item.pronto
                    ? 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
                    : 'bg-white text-marca-700 ring-1 ring-marca-200 hover:bg-marca-50',
                )}
              >
                {item.acao.icone}
                {item.acao.rotulo}
              </button>
            )}

            {item.lista && item.lista.length > 0 && (
              <ul className="w-full pl-7 flex flex-wrap gap-1">
                {item.lista.map((nome, i) => (
                  <li
                    key={`${item.chave}-${i}`}
                    className="rounded-md bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
                  >
                    {nome}
                  </li>
                ))}
              </ul>
            )}

            {!item.pronto && item.porque && (
              <p
                className={cx(
                  'w-full pl-7 text-xs leading-snug',
                  item.exigida ? 'text-amber-900' : 'text-slate-500',
                )}
              >
                {item.porque}
              </p>
            )}
          </li>
          )
        })}
      </ul>
    </div>
  )
}
