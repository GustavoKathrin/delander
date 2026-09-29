import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Package, PackagePlus } from 'lucide-react'
import { api } from '../../api/client'
import {
  Botao,
  Campo,
  Cartao,
  CartaoTitulo,
  Entrada,
  Etiqueta,
  Modal,
  Vazio,
  useAviso,
} from '../../components/ui'
import { dataCompleta, moeda } from '../../lib/format'
import type { PecaCatalogo, PedidoEstoque } from '../../types'

/**
 * Repor a prateleira: pedir peça sem carro nenhum.
 *
 * "Acabou o filtro, compra 10" não tinha onde existir — peça exigia OS, e
 * repor estoque obrigaria alguém a inventar uma. Fica em seção própria e não
 * misturada na fila de compras porque as duas ordenam por coisas diferentes:
 * lá a urgência vem da agenda do carro, aqui vem do saldo contra o mínimo.
 */
export function ReporPrateleira() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [pedindo, setPedindo] = useState<{ sugestao?: PecaCatalogo } | null>(null)
  const [recebendo, setRecebendo] = useState<PedidoEstoque | null>(null)

  const pedidos = useQuery({
    queryKey: ['pedidos-estoque'],
    queryFn: () => api<PedidoEstoque[]>('/pecas/pedidos'),
  })

  const acabando = useQuery({
    queryKey: ['catalogo-no-minimo'],
    queryFn: () => api<PecaCatalogo[]>('/pecas/catalogo/no-minimo'),
  })

  function recarregar() {
    void queryClient.invalidateQueries({ queryKey: ['pedidos-estoque'] })
    void queryClient.invalidateQueries({ queryKey: ['catalogo-no-minimo'] })
    void queryClient.invalidateQueries({ queryKey: ['catalogo-pecas'] })
  }

  const marcarComprada = useMutation({
    mutationFn: (pedido: PedidoEstoque) =>
      api(`/pecas/pedidos/${pedido.id}`, {
        metodo: 'PUT',
        corpo: {
          descricao: pedido.descricao,
          quantidade: pedido.quantidade,
          fornecedor: pedido.fornecedor,
          previsaoChegada: pedido.previsaoChegada,
          // Reenviar o valor é obrigatório: sem ele o servidor entenderia
          // "apaga", e cada clique de rotina comeria o preço do pedido.
          valorUnitario: pedido.valorUnitario,
          status: 'COMPRADA',
        },
      }),
    onSuccess: () => {
      recarregar()
      avisar('Marcada como comprada.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const lista = pedidos.data ?? []
  const noMinimo = acabando.data ?? []

  return (
    <>
      <Cartao>
        <CartaoTitulo
          titulo="Repor prateleira"
          descricao="Peça pedida para o estoque, sem carro. Quando chega, ela fica."
          acao={
            <Botao tamanho="sm" onClick={() => setPedindo({})}>
              <PackagePlus className="size-3.5" aria-hidden />
              Pedir peça
            </Botao>
          }
        />

        {lista.length === 0 ? (
          <Vazio
            icone={<Package className="size-8" />}
            titulo="Nada pedido para a prateleira"
            descricao="O que você pedir aqui não some no estoque quando chega — ao contrário da peça de um carro, que entra e sai na mesma hora."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Package className="size-4 flex-none text-slate-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {p.quantidade > 1 && `${p.quantidade}x `}
                    {p.descricao}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.fornecedor && `${p.fornecedor} · `}
                    {p.previsaoChegada
                      ? `chega ${dataCompleta(p.previsaoChegada)}`
                      : 'sem previsão'}
                    {p.valorUnitario != null && ` · ${moeda(p.valorUnitario)}`}
                    {p.saldoAtual != null && ` · ${p.saldoAtual} na prateleira`}
                  </p>
                </div>
                <Etiqueta
                  className={
                    p.status === 'COMPRADA'
                      ? 'bg-sky-100 text-sky-800 ring-sky-200'
                      : 'bg-amber-100 text-amber-800 ring-amber-200'
                  }
                >
                  {p.statusDescricao}
                </Etiqueta>
                {p.status === 'SOLICITADA' && (
                  <Botao
                    variante="secundario"
                    tamanho="sm"
                    carregando={marcarComprada.isPending}
                    onClick={() => marcarComprada.mutate(p)}
                  >
                    Comprei
                  </Botao>
                )}
                <Botao variante="sucesso" tamanho="sm" onClick={() => setRecebendo(p)}>
                  Chegou
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {/* A lista que o endpoint já servia e nenhuma tela mostrava. É o
          "acabou o filtro" literal, e cada linha já vira pedido num toque. */}
      {noMinimo.length > 0 && (
        <Cartao>
          <CartaoTitulo
            titulo="Acabou ou está acabando"
            descricao="Peça do catálogo no mínimo que você definiu. Vale olhar antes de prometer prazo."
          />
          <ul className="divide-y divide-slate-100">
            {noMinimo.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <AlertTriangle
                  className={p.temEstoque ? 'size-4 text-amber-500' : 'size-4 text-red-500'}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{p.descricao}</p>
                  <p className="text-xs text-slate-500">
                    {p.codigo && `${p.codigo} · `}
                    {p.quantidadeEstoque} na prateleira · mínimo {p.estoqueMinimo}
                  </p>
                </div>
                <Botao variante="secundario" tamanho="sm" onClick={() => setPedindo({ sugestao: p })}>
                  Pedir
                </Botao>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <ModalPedirPeca
        aberto={pedindo !== null}
        sugestao={pedindo?.sugestao}
        onFechar={() => setPedindo(null)}
        onSalvo={() => {
          setPedindo(null)
          recarregar()
          avisar('Pedido registrado.')
        }}
      />

      <ModalReceberPrateleira
        pedido={recebendo}
        onFechar={() => setRecebendo(null)}
        onSalvo={() => {
          setRecebendo(null)
          recarregar()
          avisar('Peça guardada na prateleira.')
        }}
      />
    </>
  )
}

function ModalPedirPeca({
  aberto,
  sugestao,
  onFechar,
  onSalvo,
}: {
  aberto: boolean
  sugestao?: PecaCatalogo
  onFechar: () => void
  onSalvo: () => void
}) {
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [fornecedor, setFornecedor] = useState('')
  const [previsao, setPrevisao] = useState('')
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string>()

  useEffect(() => {
    if (!aberto) return
    // Vindo de "está acabando", o pedido já nasce preenchido: quem clicou ali
    // já disse qual peça é.
    setDescricao(sugestao?.descricao ?? '')
    setQuantidade('1')
    setFornecedor('')
    setPrevisao('')
    setValor(sugestao?.valorSugerido != null ? String(sugestao.valorSugerido) : '')
    setErro(undefined)
  }, [aberto, sugestao])

  const salvar = useMutation({
    mutationFn: () =>
      api('/pecas/pedidos', {
        metodo: 'POST',
        corpo: {
          descricao,
          quantidade: Number(quantidade),
          pecaCatalogoId: sugestao?.id,
          fornecedor: fornecedor || undefined,
          previsaoChegada: previsao || undefined,
          valorUnitario: valor ? Number(valor) : undefined,
        },
      }),
    onSuccess: onSalvo,
    onError: (falha: Error) => setErro(falha.message),
  })

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Pedir peça para a prateleira"
      descricao="Sem carro: esta peça vem para ficar no estoque."
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            carregando={salvar.isPending}
            disabled={descricao.trim().length < 2}
            onClick={() => salvar.mutate()}
          >
            Pedir
          </Botao>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Peça" obrigatorio>
            <Entrada
              autoFocus
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Filtro de óleo Tecfil PSL560"
            />
          </Campo>
        </div>
        <Campo rotulo="Quantidade">
          <Entrada
            type="number"
            step="0.5"
            min="0.5"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Valor unitário (R$)">
          <Entrada
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Fornecedor">
          <Entrada value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
        </Campo>
        <Campo rotulo="Fornecedor prometeu para">
          <Entrada type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
        </Campo>
        <div className="sm:col-span-2">
          {erro && <p className="text-sm text-red-700">{erro}</p>}
        </div>
      </div>
    </Modal>
  )
}

function ModalReceberPrateleira({
  pedido,
  onFechar,
  onSalvo,
}: {
  pedido: PedidoEstoque | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string>()

  useEffect(() => {
    if (!pedido) return
    setCodigo('')
    setErro(undefined)
  }, [pedido])

  const receber = useMutation({
    mutationFn: () =>
      api(`/pecas/pedidos/${pedido!.id}/recebimento`, {
        metodo: 'POST',
        corpo: pedido!.pecaCatalogoId
          ? { catalogoId: pedido!.pecaCatalogoId, valorUnitario: pedido!.valorUnitario }
          : {
              novaDescricao: pedido!.descricao,
              codigo: codigo.trim() || undefined,
              valorUnitario: pedido!.valorUnitario,
            },
      }),
    onSuccess: onSalvo,
    onError: (falha: Error) => setErro(falha.message),
  })

  if (!pedido) return null

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`${pedido.descricao} chegou`}
      descricao="Vai para a prateleira e fica lá — esta peça não tem carro esperando."
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao variante="sucesso" carregando={receber.isPending} onClick={() => receber.mutate()}>
            Guardar {pedido.quantidade} na prateleira
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        {pedido.pecaCatalogoId ? (
          <p className="rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-900 ring-1 ring-emerald-200">
            Entra na peça que já está no catálogo
            {pedido.saldoAtual != null && `, que tem ${pedido.saldoAtual} na prateleira`}.
          </p>
        ) : (
          <Campo
            rotulo="Código do fabricante"
            dica="Opcional, mas é o que evita cadastrar a mesma peça duas vezes."
          >
            <Entrada value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </Campo>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
      </div>
    </Modal>
  )
}
