/*
 * Cotar uma peça: pedir preço em vários lugares e escolher um.
 *
 * É trabalho de balcão, feito no notebook, com o telefone na mão. Por isso a
 * tela é uma lista de linhas com o preço à esquerda e o botão de escolher à
 * direita — nada de card, nada de rolar. Quem está no meio de uma ligação
 * precisa achar a linha e sair.
 *
 * Guardar os preços RECUSADOS é o ponto. Só o escolhido seria suficiente para
 * fechar o orçamento de hoje e jogaria fora exatamente o que faz a próxima
 * negociação: "da outra vez o Silva cobrou 180 e o Souza 210".
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Phone, Plus, Trash2 } from 'lucide-react'

import { api } from '../../api/client'
import {
  AvisoErro,
  Botao,
  Campo,
  Entrada,
  Modal,
  cx,
  useAviso,
} from '../../components/ui'
import { moeda } from '../../lib/format'
import type { CotacaoPeca, Fornecedor, PecaOs } from '../../types'

export function ModalCotacao({
  aberto,
  peca,
  onFechar,
  onMudou,
}: {
  aberto: boolean
  peca: PecaOs | null
  onFechar: () => void
  onMudou: () => void
}) {
  const queryClient = useQueryClient()
  const avisar = useAviso()
  const [nome, setNome] = useState('')
  const [fornecedorId, setFornecedorId] = useState<string>('')
  const [valor, setValor] = useState('')
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState<string>()

  const cotacoes = useQuery({
    queryKey: ['cotacoes', peca?.id],
    enabled: aberto && Boolean(peca),
    queryFn: () => api<CotacaoPeca[]>(`/pecas/${peca!.id}/cotacoes`),
  })

  const fornecedores = useQuery({
    queryKey: ['fornecedores-ativos'],
    enabled: aberto,
    queryFn: () => api<Fornecedor[]>('/fornecedores?apenasAtivos=true'),
  })

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['cotacoes', peca?.id] })
    onMudou()
  }

  const registrar = useMutation({
    mutationFn: () =>
      api(`/pecas/${peca!.id}/cotacoes`, {
        metodo: 'POST',
        corpo: {
          fornecedorId: fornecedorId || undefined,
          fornecedorNome: nome.trim(),
          valorUnitario: Number(valor.replace(',', '.')),
          prazoDias: prazo ? Number(prazo) : undefined,
        },
      }),
    onSuccess: () => {
      setNome('')
      setFornecedorId('')
      setValor('')
      setPrazo('')
      setErro(undefined)
      recarregar()
    },
    onError: (e: Error) => setErro(e.message),
  })

  const escolher = useMutation({
    mutationFn: (id: string) => api(`/cotacoes/${id}/escolher`, { metodo: 'PUT' }),
    onSuccess: () => {
      avisar('Preço escolhido. O orçamento já usa esse valor.')
      recarregar()
    },
    onError: (e: Error) => avisar(e.message, 'erro'),
  })

  const apagar = useMutation({
    mutationFn: (id: string) => api(`/cotacoes/${id}`, { metodo: 'DELETE' }),
    onSuccess: recarregar,
    onError: (e: Error) => avisar(e.message, 'erro'),
  })

  const lista = cotacoes.data ?? []
  const maisBarata = lista.length > 0 ? Math.min(...lista.map((c) => c.valorUnitario)) : null

  function escolherFornecedor(id: string) {
    setFornecedorId(id)
    const f = (fornecedores.data ?? []).find((x) => x.id === id)
    if (f) {
      setNome(f.nome)
      if (f.prazoDiasTipico != null && !prazo) setPrazo(String(f.prazoDiasTipico))
    }
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={peca ? `Cotar: ${peca.descricao}` : 'Cotar peça'}
      descricao="Anote o preço de cada lugar que você ligar. Depois escolha um — é o escolhido que vai para o orçamento."
      rodape={
        <Botao variante="secundario" onClick={onFechar}>
          Fechar
        </Botao>
      }
    >
      <div className="space-y-4">
        {/* ---------------------------------------- o que já foi cotado */}
        {lista.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 ring-1 ring-slate-200">
            Nenhum preço anotado ainda. O primeiro que você registrar já entra como escolhido —
            quem liga em um lugar só não precisa de um segundo clique.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg ring-1 ring-slate-200">
            {lista.map((c) => (
              <li
                key={c.id}
                className={cx(
                  'flex items-center gap-3 px-3 py-2.5',
                  c.escolhida ? 'bg-emerald-50' : 'bg-white',
                  'border-b border-slate-100 last:border-0',
                )}
              >
                <button
                  type="button"
                  aria-label={`Escolher ${c.fornecedorNome}`}
                  onClick={() => !c.escolhida && escolher.mutate(c.id)}
                  disabled={c.escolhida || escolher.isPending}
                  className={cx(
                    'grid size-6 flex-none place-items-center rounded-full ring-1 transition',
                    c.escolhida
                      ? 'bg-emerald-600 text-white ring-emerald-700'
                      : 'bg-white text-transparent ring-slate-300 hover:ring-marca-500',
                  )}
                >
                  <Check className="size-3.5" aria-hidden />
                </button>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {c.fornecedorNome}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {c.prazoDias != null ? `entrega em ${c.prazoDias} dias` : 'sem prazo anotado'}
                    {c.escolhida && ' · é esta que vai no orçamento'}
                  </span>
                </span>

                <span className="flex-none text-right">
                  <span
                    className={cx(
                      'fonte-display block text-sm font-bold',
                      c.valorUnitario === maisBarata ? 'text-emerald-700' : 'text-slate-900',
                    )}
                  >
                    {moeda(c.valorUnitario)}
                  </span>
                  {c.valorUnitario === maisBarata && lista.length > 1 && (
                    <span className="block text-[11px] text-emerald-700">mais barato</span>
                  )}
                </span>

                {!c.escolhida && (
                  <button
                    type="button"
                    aria-label={`Apagar cotação de ${c.fornecedorNome}`}
                    onClick={() => apagar.mutate(c.id)}
                    className="grid size-9 flex-none place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* ---------------------------------------- anotar mais um */}
        <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Anotar outro preço
          </p>

          {(fornecedores.data ?? []).length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(fornecedores.data ?? []).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => escolherFornecedor(f.id)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 transition',
                    fornecedorId === f.id
                      ? 'bg-marca-600 text-white ring-marca-700'
                      : 'bg-white text-slate-700 ring-slate-300 hover:ring-marca-400',
                  )}
                >
                  {f.nome}
                  {f.whatsapp && (
                    <a
                      href={`https://wa.me/55${f.whatsapp}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`WhatsApp de ${f.nome}`}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <Phone className="size-3" aria-hidden />
                    </a>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <Campo rotulo="De quem">
              <Entrada
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value)
                  setFornecedorId('')
                }}
                placeholder="Nome do fornecedor"
              />
            </Campo>
            <Campo rotulo="Preço (R$)">
              <Entrada
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))}
                inputMode="decimal"
                className="w-28"
              />
            </Campo>
            <Campo rotulo="Prazo (dias)">
              <Entrada
                value={prazo}
                onChange={(e) => setPrazo(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                className="w-24"
              />
            </Campo>
            <div className="flex items-end">
              <Botao
                onClick={() => registrar.mutate()}
                carregando={registrar.isPending}
                disabled={nome.trim().length < 2 || !valor}
              >
                <Plus className="size-4" aria-hidden />
                Anotar
              </Botao>
            </div>
          </div>

          <AvisoErro mensagem={erro} />
        </div>
      </div>
    </Modal>
  )
}
