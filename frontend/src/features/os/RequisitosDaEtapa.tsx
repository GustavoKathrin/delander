import { AlertTriangle, Camera, Check, Plus, Tag, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'

import { cx } from '../../components/ui'
import { CHAVES, useConfig } from '../../lib/config'
import type { DetalheOs } from '../../types'
import { plural } from '../../lib/format'
import { etapaDaOs } from './EtapasDaOs'

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
   * O item nao bloqueia nada, e estar vazio e um estado legitimo.
   *
   * Separa "nao ha peca registrada" (opcional, vazio, traco cinza) de "nao
   * ha peca esperando preco" (sucesso, vazio, check verde). Antes os dois
   * eram `lista` vazia com `pronto` verdadeiro, e o sucesso era desenhado
   * igual ao pendente -- em cima de uma frase que dizia o contrario.
   */
  opcional?: boolean
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

/**
 * O que falta para sair DESTA etapa, nas sete etapas do dono.
 *
 * Antes isto era um `switch` no status do servidor, e por isso as etapas 2,
 * 3 e 4 -- que vivem todas em EM_DIAGNOSTICO -- dividiam o mesmo texto:
 * "Para o orçamento sair completo". Na prática a régua dizia "Etapa 3 ·
 * Cotação" e logo abaixo o bloco pedia para lançar serviço, que é trabalho
 * da etapa 2 e já estava feito.
 */
function pendenciasDaEtapa(
  os: DetalheOs,
  acoes: { onAdicionarServico: () => void; onAdicionarPeca: () => void; onIrParaFotos: () => void },
  exige: { foto: boolean; checklist: boolean },
): { titulo: string; itens: Pendencia[] } | null {
  // OS cancelada nao tem pendencia nenhuma: nada mais vai acontecer com este
  // carro. `etapaDaOs` devolve 1 para ela (a regua inteira vira passado), e
  // sem esta guarda a tela cobraria "tire a foto de entrada" de um carro que
  // nao vai ser mexido. O codigo anterior acertava por acidente: ele ligava
  // em StatusOs, e CANCELADO caia no default que devolvia null.
  if (os.resumo.status === 'CANCELADO') return null

  const etapa = etapaDaOs(os)
  const temFotoEntrada = os.arquivos.some((a) => a.momento === 'ENTRADA')
  const checklistRespondido =
    os.checklist.length === 0 || os.checklist.every((c) => c.ok !== undefined && c.ok !== null)
  const servicos = os.itens.filter((i) => i.status !== 'CANCELADO')
  const servicosAbertos = servicos.filter((i) => i.status !== 'CONCLUIDO')
  // Mesma conta da regua (`etapaDaOs`): peca de comprar que ainda nao tem
  // preco. Com `status === 'SOLICITADA'` esta lista continuava cheia depois
  // da cotacao -- a peca so sai de SOLICITADA quando e comprada, e comprar e
  // depois do "sim" do cliente.
  const aCotar = os.pecas.filter((p) => p.origem === 'COMPRAR' && p.semCotacao)

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

  const lancarServico = {
    rotulo: 'Adicionar serviço',
    icone: <Plus className="size-4" aria-hidden />,
    onClick: acoes.onAdicionarServico,
  }
  const lancarPeca = {
    rotulo: 'Registrar peça',
    icone: <Plus className="size-4" aria-hidden />,
    onClick: acoes.onAdicionarPeca,
  }

  switch (etapa) {
    // ---------------------------------------------------- 1. Recebimento
    case 1:
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

    // ------------------------------------------- 2. Peças e serviços
    case 2:
      return {
        titulo: 'Diga tudo que este carro vai precisar',
        itens: [
          // Sem a foto de entrada: ela e da etapa 1, e a OS so chega aqui
          // DEPOIS de o servidor ter cobrado. Repetir aqui punha o trabalho
          // da etapa 1 no lugar onde o trabalho e lancar servico e peca.
          {
            chave: 'servicos',
            rotulo:
              servicos.length === 0
                ? 'Nenhum serviço lançado'
                : `${plural(servicos.length, 'serviço')} ${servicos.length === 1 ? 'lançado' : 'lançados'}`,
            pronto: servicos.length > 0,
            lista: servicos.map((i) => i.descricao),
            exigida: true,
            porque: 'O orçamento é a soma dos serviços. Sem nenhum, o cliente recebe um papel vazio.',
            acao: lancarServico,
          },
          {
            chave: 'pecas',
            rotulo:
              os.pecas.length === 0
                ? 'Nenhuma peça registrada'
                : `${plural(os.pecas.length, 'peça')} ${os.pecas.length === 1 ? 'registrada' : 'registradas'}`,
            // Peca e opcional de verdade: tem servico que e so mao de obra.
            pronto: true,
            opcional: true,
            lista: os.pecas.map((p) => p.descricao),
            acao: lancarPeca,
          },
        ],
      }

    // ------------------------------------------------------ 3. Cotação
    case 3:
      return {
        titulo: 'O que tem no estoque, e o preço do que precisa ser comprado',
        itens: [
          {
            chave: 'cotar',
            rotulo: `${plural(aCotar.length, 'peça')} esperando preço`,
            pronto: false,
            lista: aCotar.map((p) => p.descricao),
            porque:
              'Enquanto a peça não tem preço, o total do orçamento está menor do que vai ser — e é esse número que o cliente aprova.',
            acao: { rotulo: 'Cotar', icone: <Tag className="size-4" aria-hidden />, onClick: acoes.onAdicionarPeca },
          },
          {
            chave: 'servicos',
            rotulo: `${plural(servicos.length, 'serviço')} ${servicos.length === 1 ? 'lançado' : 'lançados'}`,
            pronto: servicos.length > 0,
            lista: servicos.map((i) => i.descricao),
            acao: lancarServico,
          },
        ],
      }

    // -------------------------------------------------- 4. Mão de obra
    case 4:
      return {
        // O titulo precisa valer nos dois estados. "Falta o preco do
        // trabalho" continuava escrito depois de o preco estar la.
        titulo: 'Quanto a oficina vai cobrar pelo trabalho',
        itens: [
          // Quem nao ve dinheiro nao ve esta linha. Antes ela aparecia para
          // o mecanico com check verde em cima de "Mao de obra ainda em
          // zero" -- o `pronto` tentava nao cobrar dele uma pendencia que
          // ele nao resolve, e o rotulo nao sabia disso. Some inteira: o
          // trabalho desta etapa nao e dele.
          ...(os.valorMaoObra === undefined
            ? []
            : [
                {
                  chave: 'maoObra',
                  rotulo:
                    (os.valorMaoObra ?? 0) > 0
                      ? 'Mão de obra definida'
                      : 'Mão de obra ainda em zero',
                  pronto: (os.valorMaoObra ?? 0) > 0,
                  porque:
                    'O orçamento sai com peça e sem trabalho — e trabalho é a maior parte da conta da oficina.',
                },
              ]),
          {
            chave: 'servicos',
            rotulo: `${plural(servicos.length, 'serviço')} no orçamento`,
            pronto: servicos.length > 0,
            lista: servicos.map((i) => i.descricao),
            acao: lancarServico,
          },
          // A peca tambem precisa estar alcancavel daqui.
          //
          // Lancar o primeiro servico ja empurra o carro da etapa 2 para a 4
          // quando nao ha peca a cotar -- e a secao de pecas, que e da etapa
          // 2, sai da tela junto. Sem esta linha, quem descobre no meio do
          // orcamento que falta uma peca tem de achar a gaveta "ver o que e
          // das outras etapas" para registrar.
          {
            chave: 'pecas',
            rotulo:
              os.pecas.length === 0
                ? 'Nenhuma peça no orçamento'
                : `${plural(os.pecas.length, 'peça')} ${os.pecas.length === 1 ? 'no orçamento' : 'no orçamento'}`,
            pronto: true,
            opcional: true,
            lista: os.pecas.map((p) => p.descricao),
            acao: lancarPeca,
          },
        ],
      }

    // -------------------------------------------------- 5. Aprovação
    case 5:
      // Esperando o cliente responder nao e pendencia DA OFICINA: inventar
      // uma lista ali so faria ruido. Depois do "sim", sim -- ha o que
      // conferir antes de por a mao no carro.
      if (os.resumo.status !== 'ORCAMENTO_APROVADO') return null
      return {
        titulo: 'O cliente disse sim — dá para começar?',
        itens: [
          // Aqui a foto volta, porque e aqui que ela trava de verdade: o
          // servidor recusa EM_EXECUCAO sem ela. E o caso do carro que pulou
          // o diagnostico, ou de quem adiou a foto na entrada.
          foto,
          {
            chave: 'servicos',
            rotulo:
              servicos.length === 0
                ? 'Nenhum serviço para executar'
                : `${plural(servicos.length, 'serviço')} ${servicos.length === 1 ? 'aprovado' : 'aprovados'}`,
            pronto: servicos.length > 0,
            lista: servicos.map((i) => i.descricao),
            porque: 'Não há o que executar sem serviço lançado.',
            acao: lancarServico,
          },
          {
            chave: 'pecas',
            rotulo:
              aCotar.length === 0
                ? 'As peças já foram pedidas'
                : `${plural(aCotar.length, 'peça')} ainda sem pedido`,
            pronto: aCotar.length === 0,
            lista: aCotar.map((p) => p.descricao),
            porque: 'Começar sem a peça que trava deixa o carro aberto na bancada esperando.',
            acao: lancarPeca,
          },
        ],
      }

    // ----------------------------------------------------- 6. Serviço
    case 6:
      return {
        titulo: 'Para marcar o carro como pronto',
        itens: [
          {
            chave: 'servicos',
            rotulo:
              servicosAbertos.length === 0
                ? 'Todos os serviços concluídos'
                : `${plural(servicosAbertos.length, 'serviço')} ainda ${servicosAbertos.length === 1 ? 'aberto' : 'abertos'}`,
            pronto: servicos.length > 0 && servicosAbertos.length === 0,
            lista: servicosAbertos.map((i) => i.descricao),
            porque:
              'Serviço que fica aberto não entra na conta de horas, e o relatório do dono sai errado.',
            acao: { rotulo: 'Adicionar serviço', icone: <Wrench className="size-4" aria-hidden />, onClick: acoes.onAdicionarServico },
          },
        ],
      }

    // Carro pronto ou entregue nao tem pendencia da oficina.
    default:
      return null
  }
}

export function RequisitosDaEtapa({
  os,
  secoesNaTela,
  onAdicionarServico,
  onAdicionarPeca,
  onIrParaFotos,
}: {
  os: DetalheOs
  /**
   * Quais seções a etapa já mostra logo abaixo deste bloco.
   *
   * A pendência não repete um botão que está a 100px dela: na etapa 2
   * havia quatro botões para duas ações. O atalho nasceu quando serviço e
   * peça viviam em cartões soltos lá embaixo; com a seção na mesma caixa,
   * ele deixou de ser atalho.
   */
  secoesNaTela: string[]
  onAdicionarServico: () => void
  onAdicionarPeca: () => void
  onIrParaFotos: () => void
}) {
  const { flag } = useConfig()
  const bruto = pendenciasDaEtapa(
    os,
    { onAdicionarServico, onAdicionarPeca, onIrParaFotos },
    { foto: flag(CHAVES.exigirFotos), checklist: flag(CHAVES.exigirChecklist) },
  )
  if (!bruto) return null

  // De que seção cada pendência fala. Quem não está neste mapa (mao de obra,
  // por exemplo) nunca teve botão próprio e segue como estava.
  const SECAO_DA_PENDENCIA: Record<string, string> = {
    foto: 'recebimento',
    checklist: 'recebimento',
    servicos: 'servicos',
    pecas: 'pecas',
    cotar: 'pecas',
    maoObra: 'valores',
  }
  const bloco = {
    ...bruto,
    itens: bruto.itens.map((item) =>
      secoesNaTela.includes(SECAO_DA_PENDENCIA[item.chave] ?? '')
        ? { ...item, acao: undefined }
        : item,
    ),
  }

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
        ) : faltando.length === 0 ? (
          // Dizer que acabou vale tanto quanto dizer o que falta: sem isto, a
          // lista toda verde ficava sob um titulo que nao comentava nada, e
          // quem olhava de longe nao sabia se podia apertar o botao.
          <span className="font-normal text-emerald-700">— tudo pronto para seguir</span>
        ) : (
          faltando.length > 0 && (
            <span className="font-normal text-slate-500">
              {/* "falta 2 coisas" é o tipo de erro que, sozinho, não atrapalha
                  ninguém — e repetido em vinte telas é exatamente o que faz um
                  sistema parecer inacabado. O verbo concorda com o número. */}
              {faltando.length === 1
                ? '— falta 1 coisa, mas dá para seguir'
                : `— faltam ${faltando.length} coisas, mas dá para seguir`}
            </span>
          )
        )}
      </p>

      <ul className="mt-2 space-y-1.5">
        {bloco.itens.map((item) => {
          // So o item OPCIONAL vazio ganha o traco cinza. Para os outros,
          // lista vazia e justamente o sucesso -- "todos os servicos
          // concluidos", "as pecas ja foram pedidas" -- e pintar isso de
          // cinza dizia o contrario da frase ao lado.
          const vazio = item.opcional === true && (item.lista?.length ?? 0) === 0
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
              {/* O leitor de tela precisa ouvir o que o icone mostra. No item
                  opcional vazio o icone e um traco cinza, e dizer "feito" ali
                  anunciava "Nenhuma peca registrada, feito" -- que e o
                  contrario do que o traco quer dizer. */}
              <span className="sr-only">
                {!item.pronto ? ' — pendente' : vazio ? ' — opcional, nada registrado' : ' — feito'}
              </span>
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
