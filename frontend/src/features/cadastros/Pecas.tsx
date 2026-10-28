import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, Car, ListOrdered, Package, ShoppingCart, Tag } from 'lucide-react'
import { api } from '../../api/client'
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  CartaoTitulo,
  Entrada,
  Etiqueta,
  Modal,
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import { AjudaDaTela } from '../../components/AjudaDaTela'
import { Placa } from '../../components/oficina'
import { ReporPrateleira } from './ReporPrateleira'
import { dataCompleta, diasTexto, moeda, plural } from '../../lib/format'
import type { PecaCatalogo, PecaPendente } from '../../types'

/**
 * A fila de compras da oficina.
 *
 * Não é uma lista de peças: é uma lista de **carros esperando**. Por isso
 * cada linha começa pelo que está travado e só depois diz o que comprar.
 *
 * A ordem vem pronta do servidor e é por urgência, não por previsão do
 * fornecedor — uma peça que chega dia 30 é tranquila para um carro do dia 5
 * e é problema para um carro do dia 28. Essa conta depende da agenda do
 * carro, então mora lá, com uma versão só.
 */
export default function Pecas() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [recebendo, setRecebendo] = useState<PecaPendente | null>(null)
  /**
   * Por peca e a lista de compras; por carro e a conversa com o cliente.
   *
   * Sao as duas perguntas reais do balcao, e uma lista plana so responde a
   * primeira: "o que eu compro hoje?" responde-se varrendo pecas, mas "o que
   * falta para o Gol do seu Jose?" obriga a garimpar a placa linha a linha.
   */
  const [visao, setVisao] = useState<'PECA' | 'CARRO'>('PECA')

  const consulta = useQuery({
    queryKey: ['pecas-pendentes'],
    queryFn: () => api<PecaPendente[]>('/pecas/pendentes'),
  })

  const mudarStatus = useMutation({
    mutationFn: ({ peca, status }: { peca: PecaPendente; status: string }) =>
      api(`/os/${peca.osId}/pecas/${peca.id}`, {
        metodo: 'PUT',
        corpo: {
          descricao: peca.descricao,
          quantidade: peca.quantidade,
          fornecedor: peca.fornecedor,
          status,
          momentoNecessario: peca.momentoNecessario,
          previsaoChegada: peca.previsaoChegada,
          // Reenviar o valor é obrigatório: sem ele o servidor entendia
          // "apagar", e cada clique de rotina encolhia o valor da OS.
          valorUnitario: peca.valorUnitario,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pecas-pendentes'] })
      void queryClient.invalidateQueries({ queryKey: ['quadro'] })
      void queryClient.invalidateQueries({ queryKey: ['radar'] })
      void queryClient.invalidateQueries({ queryKey: ['patio'] })
      avisar('Peça atualizada.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const receber = useMutation({
    mutationFn: ({ peca, corpo }: { peca: PecaPendente; corpo: Record<string, unknown> }) =>
      api(`/os/${peca.osId}/pecas/${peca.id}/recebimento`, { metodo: 'POST', corpo }),
    onSuccess: () => {
      setRecebendo(null)
      void queryClient.invalidateQueries({ queryKey: ['pecas-pendentes'] })
      void queryClient.invalidateQueries({ queryKey: ['quadro'] })
      void queryClient.invalidateQueries({ queryKey: ['radar'] })
      void queryClient.invalidateQueries({ queryKey: ['patio'] })
      avisar('Peça recebida e guardada no estoque.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  if (consulta.isLoading) return <Carregando texto="Carregando a fila de compras..." />

  // Sem este ramo a tela mentia: erro deixa `data` indefinido, virava lista
  // vazia e o mecanico sem permissao lia "Nada para comprar" — ou seja, o
  // sistema afirmando que a oficina nao tem o que comprar quando ela tem.
  if (consulta.isError) {
    return (
      <div className="p-4">
        <Vazio
          icone={<Package className="size-8" />}
          titulo="Não foi possível carregar a fila"
          descricao={(consulta.error as Error).message}
          acao={<Botao onClick={() => void consulta.refetch()}>Tentar de novo</Botao>}
        />
      </div>
    )
  }

  const pecas = consulta.data ?? []
  const travando = pecas.filter((p) => p.momentoNecessario === 'INICIO')
  const emRisco = pecas.filter((p) => p.emRisco)

  /*
   * Duas filas, e elas nao sao a mesma tarefa.
   *
   * A COTAR: o cliente ainda nao disse sim. Aqui o trabalho e descobrir o
   * preco -- e dele que o orcamento e feito. Comprar fica travado: se o
   * cliente recusar, a oficina fica com a peca na mao.
   *
   * A COMPRAR: orcamento aprovado. Aqui o trabalho e ligar e pedir.
   *
   * Antes a fila escondia a primeira lista inteira, e por isso a etapa de
   * cotacao nao tinha onde acontecer: as pecas que alguem precisava cotar
   * eram exatamente as que nao apareciam.
   */
  const aCotar = pecas.filter((p) => !p.aprovada)
  const aComprar = pecas.filter((p) => p.aprovada)
  const semPreco = pecas.filter((p) => p.semCotacao)

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <ShoppingCart className="size-5 text-slate-400" aria-hidden />
          Peças para comprar
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Cada linha aqui é um carro esperando. Primeiro você põe preço no que o mecânico
          pediu; depois que o cliente aprova, o botão de comprar libera.
        </p>
      </header>

      <AjudaDaTela chave="pecas" titulo="Duas listas, e elas não são a mesma coisa">
        Em cima, <strong>carros esperando</strong>: peça que já tem dono, ordenada pela urgência
        do carro. Embaixo, <strong>repor prateleira</strong>: peça que vem para ficar no estoque.
        Ao clicar em <strong>Chegou</strong>, o sistema pergunta onde guardar — é assim que o
        saldo continua valendo.
      </AjudaDaTela>

      {emRisco.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          <AlertTriangle className="mt-0.5 size-4 flex-none" aria-hidden />
          <span>
            <strong>
              {emRisco.length === 1 ? '1 peça em risco' : `${emRisco.length} peças em risco`}
            </strong>
            {travando.length > 0 &&
              (travando.length === 1
                ? ' · 1 trava o começo de um serviço'
                : ` · ${travando.length} travam o começo de um serviço`)}
            .
            Vale cobrar o fornecedor hoje.
          </span>
        </p>
      )}

      {semPreco.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <Tag className="mt-0.5 size-4 flex-none" aria-hidden />
          <span>
            <strong>{plural(semPreco.length, 'peça sem preço')}</strong> — o orçamento não fecha
            enquanto elas estiverem assim. Toque no valor para cotar.
          </span>
        </p>
      )}

      {pecas.length === 0 ? (
        <Cartao>
          <Vazio
            icone={<Package className="size-8" />}
            titulo="Nenhuma peça pedida"
            descricao="Quando o mecânico lançar uma peça na avaliação, ela aparece aqui para você cotar."
          />
        </Cartao>
      ) : (
        <>
          {/* O alternador fica em cima das DUAS listas, porque a pergunta
              "por peça ou por carro" vale para as duas. */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              {plural(pecas.length, 'peça')} · da mais urgente para a menos
            </p>
            <div className="flex gap-1">
              {(['PECA', 'CARRO'] as const).map((v) => (
                <Botao
                  key={v}
                  tamanho="toque"
                  variante={visao === v ? 'primario' : 'secundario'}
                  aria-pressed={visao === v}
                  onClick={() => setVisao(v)}
                >
                  {v === 'PECA' ? <ListOrdered className="size-4" aria-hidden /> : <Car className="size-4" aria-hidden />}
                  {v === 'PECA' ? 'Por peça' : 'Por carro'}
                </Botao>
              ))}
            </div>
          </div>

          <BlocoDaFila
            titulo="A cotar"
            explicacao="O cliente ainda não aprovou. Ponha o preço — é dele que o orçamento é feito. Comprar só depois do sim."
            pecas={aCotar}
            visao={visao}
            tom="amber"
            salvando={mudarStatus.isPending}
            onComprei={(p) => mudarStatus.mutate({ peca: p, status: 'COMPRADA' })}
            onChegou={setRecebendo}
          />

          <BlocoDaFila
            titulo="A comprar"
            explicacao="Orçamento aprovado. Agora é ligar e pedir."
            pecas={aComprar}
            visao={visao}
            tom="slate"
            salvando={mudarStatus.isPending}
            onComprei={(p) => mudarStatus.mutate({ peca: p, status: 'COMPRADA' })}
            onChegou={setRecebendo}
          />
        </>
      )}

      <ReporPrateleira />

      <ModalRecebimento
        peca={recebendo}
        salvando={receber.isPending}
        onFechar={() => setRecebendo(null)}
        onConfirmar={(corpo) => receber.mutate({ peca: recebendo!, corpo })}
      />
    </div>
  )
}

/**
 * A peça chegou: onde ela vai ficar guardada.
 *
 * O dono foi explícito — ao dar a compra por concluída, a peça **tem** que
 * ficar no estoque. Por isso "Chegou" abre esta pergunta em vez de só mudar
 * o status: sem ela, a peça entrava no carro e o catálogo continuava sem
 * saber que essa peça existe, com que código e por quanto.
 *
 * Duas saídas, e só duas: é uma peça que o catálogo já conhece, ou ela nasce
 * agora. Não existe "recebo e não guardo" — é assim que o saldo vira ficção.
 */
function ModalRecebimento({
  peca,
  salvando,
  onFechar,
  onConfirmar,
}: {
  peca: PecaPendente | null
  salvando: boolean
  onFechar: () => void
  onConfirmar: (corpo: Record<string, unknown>) => void
}) {
  const [termo, setTermo] = useState('')
  const [escolhida, setEscolhida] = useState<PecaCatalogo | null>(null)
  const [codigo, setCodigo] = useState('')

  useEffect(() => {
    if (!peca) return
    setTermo(peca.descricao)
    setEscolhida(null)
    setCodigo('')
  }, [peca])

  const [busca, setBusca] = useState('')
  useEffect(() => {
    const id = window.setTimeout(() => setBusca(termo.trim()), 350)
    return () => window.clearTimeout(id)
  }, [termo])

  const catalogo = useQuery({
    queryKey: ['catalogo-peca', busca],
    queryFn: () =>
      api<PecaCatalogo[]>(`/pecas/catalogo/autocompletar?termo=${encodeURIComponent(busca)}`),
    enabled: Boolean(peca) && busca.length >= 2,
  })

  if (!peca) return null
  const achadas = catalogo.data ?? []

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`${peca.descricao} chegou`}
      descricao="Onde esta peça fica guardada. O estoque só vale se tudo que chega passa por aqui."
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="sucesso"
            carregando={salvando}
            disabled={!escolhida && termo.trim().length < 2}
            onClick={() =>
              onConfirmar(
                escolhida
                  ? { catalogoId: escolhida.id, valorUnitario: peca.valorUnitario }
                  : {
                      novaDescricao: termo.trim(),
                      codigo: codigo.trim() || undefined,
                      valorUnitario: peca.valorUnitario,
                    },
              )
            }
          >
            Guardar e concluir
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <Campo rotulo="Peça no catálogo" obrigatorio>
          <Entrada
            autoFocus
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value)
              setEscolhida(null)
            }}
            placeholder="Nome da peça"
          />
        </Campo>

        {!escolhida && busca.length >= 2 && (
          <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
            {achadas.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {achadas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEscolhida(c)
                        setTermo(c.descricao)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <Package className="size-4 flex-none text-slate-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm">{c.descricao}</span>
                      <span className="flex-none text-xs text-slate-500">
                        {c.quantidadeEstoque} na prateleira
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2 text-xs text-slate-500">
                Não está no catálogo. Vai ser cadastrada agora como{' '}
                <strong>{termo.trim()}</strong>.
              </p>
            )}
          </div>
        )}

        {escolhida ? (
          <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900 ring-1 ring-emerald-200">
            <BadgeCheck className="size-4 flex-none" aria-hidden />
            Entra em <strong>{escolhida.descricao}</strong>, que tem{' '}
            {escolhida.quantidadeEstoque} na prateleira.
          </p>
        ) : (
          <Campo rotulo="Código do fabricante" dica="Opcional, mas é o que evita cadastrar a mesma peça duas vezes.">
            <Entrada value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </Campo>
        )}

        <p className="text-xs text-slate-500">
          Esta peça vai direto para o {peca.placa}: ela entra no estoque e sai na mesma hora.
          O que fica é o cadastro — na próxima vez é só escolher da lista.
        </p>
      </div>
    </Modal>
  )
}

/**
 * O preco da peca, editavel no lugar.
 *
 * Cotar e a tarefa da etapa, e abrir um modal para digitar um numero seria
 * tres cliques para cada peca de uma lista de quinze. Aqui o valor E o
 * botao: toca, digita, sai do campo e salvou.
 *
 * Peca sem preco aparece como "sem preco" em ambar, porque e o que impede o
 * orcamento de fechar -- e nao como "R$ 0,00", que parece peca de graca.
 */
function Cotacao({ peca }: { peca: PecaPendente }) {
  const queryClient = useQueryClient()
  const avisar = useAviso()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')

  const salvar = useMutation({
    mutationFn: () =>
      api(`/os/${peca.osId}/pecas/${peca.id}`, {
        metodo: 'PUT',
        corpo: {
          descricao: peca.descricao,
          quantidade: peca.quantidade,
          fornecedor: peca.fornecedor,
          status: peca.status,
          momentoNecessario: peca.momentoNecessario,
          previsaoChegada: peca.previsaoChegada,
          valorUnitario: valor === '' ? null : Number(valor),
        },
      }),
    onSuccess: () => {
      setEditando(false)
      void queryClient.invalidateQueries({ queryKey: ['pecas-pendentes'] })
      void queryClient.invalidateQueries({ queryKey: ['os'] })
      avisar('Preço salvo.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  if (editando) {
    return (
      <span className="flex items-center gap-1">
        <Entrada
          autoFocus
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          className="w-28"
          aria-label={`Preço de ${peca.descricao}`}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar.mutate()
            if (e.key === 'Escape') setEditando(false)
          }}
        />
        <Botao tamanho="toque" carregando={salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar
        </Botao>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValor(peca.valorUnitario != null ? String(peca.valorUnitario) : '')
        setEditando(true)
      }}
      className={cx(
        'flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition',
        peca.semCotacao
          ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100'
          : 'text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
      )}
    >
      <Tag className="size-4" aria-hidden />
      {peca.semCotacao ? 'sem preço' : moeda(peca.valorUnitario)}
    </button>
  )
}

/**
 * Um bloco da fila, nas duas visoes.
 *
 * Por peca e a lista de compras do dia. Por carro e a conversa com o
 * cliente: as duas perguntas reais do balcao, e uma lista plana so responde
 * a primeira.
 */
function BlocoDaFila({
  titulo,
  explicacao,
  pecas,
  visao,
  tom,
  salvando,
  onComprei,
  onChegou,
}: {
  titulo: string
  explicacao: string
  pecas: PecaPendente[]
  visao: 'PECA' | 'CARRO'
  tom: 'amber' | 'slate'
  salvando: boolean
  onComprei: (p: PecaPendente) => void
  onChegou: (p: PecaPendente) => void
}) {
  if (pecas.length === 0) return null

  // Agrupar mantendo a ordem de urgencia que o servidor ja calculou: o
  // primeiro carro da lista e o do primeiro pedido mais urgente.
  const porCarro: { placa: string; cliente: string; osId: string; itens: PecaPendente[] }[] = []
  for (const p of pecas) {
    const achado = porCarro.find((c) => c.osId === p.osId)
    if (achado) achado.itens.push(p)
    else porCarro.push({ placa: p.placa, cliente: p.cliente, osId: p.osId, itens: [p] })
  }

  return (
    <Cartao className={cx('ring-1', tom === 'amber' ? 'ring-amber-200' : 'ring-slate-200')}>
      <CartaoTitulo
        titulo={`${titulo} (${pecas.length})`}
        descricao={explicacao}
      />
      {visao === 'PECA' ? (
        <ul className="divide-y divide-slate-100">
          {pecas.map((p) => (
            <LinhaDaFila
              key={p.id}
              peca={p}
              salvando={salvando}
              onComprei={() => onComprei(p)}
              onChegou={() => onChegou(p)}
            />
          ))}
        </ul>
      ) : (
        <div className="divide-y divide-slate-200">
          {porCarro.map((carro) => (
            <section key={carro.osId}>
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-4 py-2">
                <Link
                  to={`/os/${carro.osId}`}
                  className="-my-2 inline-flex items-center py-2 hover:underline"
                >
                  <Placa placa={carro.placa} tamanho="md" />
                </Link>
                <span className="text-sm text-slate-700">{carro.cliente}</span>
                <span className="ml-auto text-xs text-slate-600">
                  {plural(carro.itens.length, 'peça')}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {carro.itens.map((p) => (
                  <LinhaDaFila
                    key={p.id}
                    peca={p}
                    semPlaca
                    salvando={salvando}
                    onComprei={() => onComprei(p)}
                    onChegou={() => onChegou(p)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Cartao>
  )
}

function LinhaDaFila({
  peca,
  salvando,
  semPlaca = false,
  onComprei,
  onChegou,
}: {
  peca: PecaPendente
  salvando: boolean
  /** Na visão por carro a placa já está no cabeçalho do grupo. */
  semPlaca?: boolean
  onComprei: () => void
  onChegou: () => void
}) {
  const trava = peca.momentoNecessario === 'INICIO'
  const vencido = peca.diasDeFolga != null && peca.diasDeFolga < 0

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <Package
          className={cx(
            'mt-0.5 size-5 flex-none',
            peca.emRisco ? 'text-red-600' : 'text-slate-400',
          )}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">
            {peca.quantidade > 1 && `${peca.quantidade}x `}
            {peca.descricao}
          </p>

          {!semPlaca && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Link to={`/os/${peca.osId}`} className="-my-2 inline-flex items-center py-2 hover:underline">
                <Placa placa={peca.placa} tamanho="md" />
              </Link>
              <span>{peca.cliente}</span>
              {peca.fornecedor && <span>· {peca.fornecedor}</span>}
            </div>
          )}
          {semPlaca && peca.fornecedor && (
            <p className="mt-1 text-xs text-slate-500">{peca.fornecedor}</p>
          )}

          {/* O prazo e o risco, em palavras. "Precisa até" é do carro;
              "fornecedor disse" é do fornecedor — e a diferença é o risco. */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Etiqueta
              className={
                trava
                  ? 'bg-red-100 text-red-800 ring-red-200'
                  : 'bg-slate-100 text-slate-600 ring-slate-200'
              }
            >
              {peca.momentoDescricao}
            </Etiqueta>

            {peca.carroParado ? (
              <span className="font-medium text-red-700">
                carro parado — sem dia marcado
              </span>
            ) : peca.comprarAte ? (
              <span className={cx(vencido ? 'font-medium text-red-700' : 'text-slate-600')}>
                precisa até {dataCompleta(peca.comprarAte)}
                {peca.diasDeFolga != null &&
                  (peca.diasDeFolga < 0
                    ? ` · ${diasTexto(Math.abs(peca.diasDeFolga))} de atraso`
                    : peca.diasDeFolga === 0
                      ? ' · é hoje'
                      : ` · faltam ${diasTexto(peca.diasDeFolga)}`)}
              </span>
            ) : null}

            {peca.previsaoChegada && (
              <span className={cx(peca.emRisco ? 'text-red-700' : 'text-slate-500')}>
                · fornecedor disse {dataCompleta(peca.previsaoChegada)}
              </span>
            )}
          </p>
        </div>

        {/* No celular as acoes descem para baixo em vez de espremer o texto
            da peca contra a borda. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-none">
          <Cotacao peca={peca} />

          <Etiqueta
            className={
              peca.status === 'COMPRADA'
                ? 'bg-sky-100 text-sky-800 ring-sky-200'
                : 'bg-amber-100 text-amber-800 ring-amber-200'
            }
          >
            {peca.statusDescricao}
          </Etiqueta>

          {/* "Comprei" so com o sim do cliente. A regra e do dono: comprar
              peca de servico que ainda pode ser recusado e ficar com a peca
              na mao. Antes isso era garantido escondendo a peca da fila --
              o que tambem escondia a cotacao. */}
          {peca.status === 'SOLICITADA' &&
            (peca.aprovada ? (
              <Botao variante="secundario" tamanho="toque" carregando={salvando} onClick={onComprei}>
                Comprei
              </Botao>
            ) : (
              <span className="text-xs text-slate-500">espera o sim do cliente</span>
            ))}

          {peca.aprovada && (
            <Botao variante="sucesso" tamanho="toque" carregando={salvando} onClick={onChegou}>
              Chegou
            </Botao>
          )}
        </div>
      </div>
    </li>
  )
}
