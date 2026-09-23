import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, PackageCheck } from 'lucide-react'
import { api } from '../../api/client'
import type { PecaPendente } from '../../types'
import {
  Botao,
  Carregando,
  Cartao,
  CartaoTitulo,
  Etiqueta,
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import { dataCompleta, dataLocal } from '../../lib/format'

export default function Pecas() {
  const avisar = useAviso()
  const queryClient = useQueryClient()

  const lista = useQuery({
    queryKey: ['pecas-pendentes'],
    queryFn: () => api<PecaPendente[]>('/pecas/pendentes'),
  })

  const marcar = useMutation({
    mutationFn: ({ peca, status }: { peca: PecaPendente; status: string }) =>
      api(`/os/${peca.osId}/pecas/${peca.id}`, {
        metodo: 'PUT',
        corpo: {
          descricao: peca.descricao,
          quantidade: peca.quantidade,
          fornecedor: peca.fornecedor,
          previsaoChegada: peca.previsaoChegada,
          status,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pecas-pendentes'] })
      void queryClient.invalidateQueries({ queryKey: ['quadro'] })
      void queryClient.invalidateQueries({ queryKey: ['radar'] })
      avisar('Situação da peça atualizada.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  if (lista.isLoading) return <Carregando texto="Buscando peças pendentes..." />

  const pecas = lista.data ?? []
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const atrasadas = pecas.filter((p) => {
    const previsao = dataLocal(p.previsaoChegada)
    return previsao && previsao < hoje
  })

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-slate-900">Peças pendentes</h1>
        <p className="mt-1 text-sm text-slate-500">
          A fila de compras da oficina. Cada peça aqui é um carro que pode estar parado esperando.
        </p>
      </header>

      {atrasadas.length > 0 && (
        <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
          {atrasadas.length} peça(s) passaram da previsão de chegada. Vale cobrar o fornecedor hoje.
        </div>
      )}

      <Cartao>
        <CartaoTitulo
          titulo="Solicitadas e compradas"
          descricao={`${pecas.length} peça(s) aguardando chegada`}
        />
        {pecas.length === 0 ? (
          <Vazio
            icone={<PackageCheck className="size-10" />}
            titulo="Nenhuma peça pendente"
            descricao="Todas as peças solicitadas já chegaram ou foram aplicadas."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pecas.map((peca) => {
              const previsao = dataLocal(peca.previsaoChegada)
              const atrasada = previsao && previsao < hoje
              return (
                <li key={peca.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Package
                    className={cx(
                      'size-4 flex-none',
                      atrasada ? 'text-red-500' : 'text-slate-400',
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {peca.quantidade > 1 && `${peca.quantidade}x `}
                      {peca.descricao}
                    </p>
                    <p className="text-xs text-slate-500">
                      <Link to={`/os/${peca.osId}`} className="font-mono hover:text-marca-700">
                        {peca.placa}
                      </Link>
                      {' · '}
                      {peca.cliente}
                      {peca.fornecedor && ` · ${peca.fornecedor}`}
                    </p>
                    {peca.previsaoChegada && (
                      <p className={cx('text-[11px]', atrasada ? 'text-red-600' : 'text-slate-400')}>
                        Previsão: {dataCompleta(peca.previsaoChegada)}
                        {atrasada && ' (atrasada)'}
                      </p>
                    )}
                  </div>

                  <Etiqueta
                    className={
                      peca.status === 'COMPRADA'
                        ? 'bg-sky-100 text-sky-700 ring-sky-200'
                        : 'bg-amber-100 text-amber-800 ring-amber-200'
                    }
                  >
                    {peca.statusDescricao}
                  </Etiqueta>

                  <div className="flex gap-2">
                    {peca.status === 'SOLICITADA' && (
                      <Botao
                        variante="secundario"
                        tamanho="sm"
                        carregando={marcar.isPending}
                        onClick={() => marcar.mutate({ peca, status: 'COMPRADA' })}
                      >
                        Comprei
                      </Botao>
                    )}
                    <Botao
                      variante="sucesso"
                      tamanho="sm"
                      carregando={marcar.isPending}
                      onClick={() => marcar.mutate({ peca, status: 'RECEBIDA' })}
                    >
                      Chegou
                    </Botao>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>
    </div>
  )
}
