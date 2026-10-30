import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Tag } from 'lucide-react'

import { api } from '../api/client'
import { moeda } from '../lib/format'
import type { MomentoPeca, StatusPeca } from '../types'
import { Botao, Entrada, cx, useAviso } from './ui'

/**
 * O preço da peça, editável no lugar.
 *
 * Cotar é a tarefa da etapa 3, e abrir um modal para digitar um número
 * seriam três cliques por peça numa lista de quinze. Aqui o valor É o
 * botão: toca, digita, sai do campo e salvou.
 *
 * Peça sem preço aparece como "sem preço" em âmbar, porque é o que impede o
 * orçamento de fechar — e não como "R$ 0,00", que parece peça de graça.
 *
 * Mora em `components/` e não dentro da tela de peças porque é usado nos
 * dois lugares onde essa tarefa aparece: a fila de compras e a etapa 3 da
 * própria OS. Antes existia só na fila, e a etapa 3 da OS mandava pôr o
 * preço numa tela que não tinha onde pôr: a linha da peça era só leitura.
 */
export interface PecaCotavel {
  id: string
  descricao: string
  quantidade: number
  fornecedor?: string
  status: StatusPeca
  momentoNecessario: MomentoPeca
  previsaoChegada?: string
  valorUnitario?: number
}

export function PrecoDaPeca({
  osId,
  peca,
  onSalvou,
}: {
  osId: string
  peca: PecaCotavel
  onSalvou: () => void
}) {
  const avisar = useAviso()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')

  const semPreco = peca.valorUnitario === null || peca.valorUnitario === undefined

  const salvar = useMutation({
    mutationFn: () =>
      api(`/os/${osId}/pecas/${peca.id}`, {
        metodo: 'PUT',
        corpo: {
          // O PUT troca a peça inteira: o que não for reenviado volta nulo.
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
      onSalvou()
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
        semPreco
          ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100'
          : 'text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
      )}
    >
      <Tag className="size-4" aria-hidden />
      {semPreco ? 'sem preço' : moeda(peca.valorUnitario)}
    </button>
  )
}
