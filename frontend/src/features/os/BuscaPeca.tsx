import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, PackageSearch, ShoppingCart } from 'lucide-react'
import { api } from '../../api/client'
import { Entrada, cx } from '../../components/ui'
import { moeda } from '../../lib/format'
import type { PecaCatalogo } from '../../types'

/**
 * Achar a peça no catálogo — ou descobrir que ela não existe ainda.
 *
 * O mecânico digita o nome da peça. Se ela está cadastrada, ele escolhe da
 * lista e o sistema já sabe o preço e se **tem na prateleira**: é isso que
 * separa "pego aqui e uso" de "alguém precisa comprar". Se não está, o que
 * ele digitou vira um pedido de compra, sem obrigá-lo a cadastrar nada —
 * ele está de pé ao lado do carro, não na frente de um formulário.
 *
 * O saldo aparece ao lado de cada peça de propósito. "Kit de embreagem" com
 * 0 na prateleira e "kit de embreagem" com 3 são decisões diferentes, e a
 * pessoa precisa ver isso antes de escolher, não depois.
 */
export function BuscaPeca({
  descricao,
  onDescricao,
  onEscolher,
  escolhida,
}: {
  descricao: string
  onDescricao: (texto: string) => void
  /** Peça do catálogo, ou null quando é avulsa/pedido novo. */
  onEscolher: (peca: PecaCatalogo | null) => void
  escolhida: PecaCatalogo | null
}) {
  const [termo, setTermo] = useState('')

  // Espera a digitação parar: sem isto, "amortecedor" dispara onze consultas.
  useEffect(() => {
    const id = window.setTimeout(() => setTermo(descricao.trim()), 350)
    return () => window.clearTimeout(id)
  }, [descricao])

  const busca = useQuery({
    queryKey: ['catalogo-peca', termo],
    queryFn: () =>
      api<PecaCatalogo[]>(`/pecas/catalogo/autocompletar?termo=${encodeURIComponent(termo)}`),
    enabled: termo.length >= 2 && !escolhida,
  })

  const achadas = busca.data ?? []

  if (escolhida) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 ring-1 ring-emerald-200">
        <Check className="size-4 flex-none text-emerald-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{escolhida.descricao}</p>
          <p className="text-xs text-slate-600">
            {escolhida.codigo && `${escolhida.codigo} · `}
            {escolhida.temEstoque
              ? `${escolhida.quantidadeEstoque} na prateleira`
              : 'sem estoque — vira pedido de compra'}
            {escolhida.valorSugerido != null && ` · ${moeda(escolhida.valorSugerido)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onEscolher(null)
            onDescricao('')
          }}
          className="flex-none rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200"
        >
          trocar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Entrada
        autoFocus
        value={descricao}
        onChange={(e) => onDescricao(e.target.value)}
        placeholder="Ex.: kit de embreagem"
      />

      {termo.length >= 2 && (
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
          {busca.isLoading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Procurando no catálogo...</p>
          ) : achadas.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {achadas.map((peca) => (
                <li key={peca.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onEscolher(peca)
                      onDescricao(peca.descricao)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-50"
                  >
                    <PackageSearch className="size-4 flex-none text-slate-400" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">
                        {peca.descricao}
                      </span>
                      {peca.codigo && (
                        <span className="block text-[11px] text-slate-400">{peca.codigo}</span>
                      )}
                    </span>
                    <span
                      className={cx(
                        'flex-none rounded-full px-2 py-0.5 text-[11px] font-medium',
                        peca.temEstoque
                          ? peca.acabando
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {peca.temEstoque ? `${peca.quantidadeEstoque} aqui` : 'sem estoque'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500">
              <ShoppingCart className="size-3.5 flex-none" aria-hidden />
              Não está no catálogo — vai entrar como pedido de compra.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
