import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardCheck, X } from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import { Botao, Cartao, CartaoTitulo, Entrada, cx, useAviso } from '../../components/ui'
import type { DetalheOs } from '../../types'

/**
 * O checklist de entrada: como o carro chegou.
 *
 * Existe por um motivo só — não pagar por um risco que já estava lá. Por
 * isso o sistema exige que ele esteja respondido ANTES de iniciar a
 * execução: preenchido depois que o mecânico abriu o carro, não prova nada.
 *
 * "OK" e "Tem ressalva" são dois botões em vez de uma caixinha porque isto
 * é preenchido de pé, com o cliente esperando, muitas vezes no celular —
 * e nessa situação um alvo grande vale mais do que uma tela bonita.
 */
export function ChecklistEntrada({ os }: { os: DetalheOs }) {
  const avisar = useAviso()
  const queryClient = useQueryClient()

  type Resposta = { ok: boolean | null; observacao: string }
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({})

  // A OS chega depois do primeiro render, e pode ser recarregada: as
  // respostas do servidor mandam, mas o que a pessoa acabou de marcar e
  // ainda não salvou não pode sumir embaixo da mão dela.
  useEffect(() => {
    setRespostas((atuais) => {
      const novo: Record<string, Resposta> = {}
      for (const item of os.checklist) {
        novo[item.id] = atuais[item.id] ?? {
          ok: item.ok ?? null,
          observacao: item.observacao ?? '',
        }
      }
      return novo
    })
  }, [os.checklist])

  const salvar = useMutation({
    mutationFn: () =>
      api(`/os/${os.resumo.id}/checklist`, {
        metodo: 'PUT',
        corpo: {
          itens: os.checklist.map((i) => ({
            id: i.id,
            ok: respostas[i.id]?.ok ?? null,
            observacao: respostas[i.id]?.observacao || undefined,
          })),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['os', os.resumo.id] })
      avisar('Checklist salvo.')
    },
    onError: (erro: Error) =>
      avisar(erro instanceof ErroApi ? erro.message : 'Não foi possível salvar.', 'erro'),
  })

  if (os.checklist.length === 0) return null

  const faltam = os.checklist.filter((i) => (respostas[i.id]?.ok ?? null) === null).length
  const marcar = (id: string, ok: boolean) =>
    setRespostas((r) => ({ ...r, [id]: { ...(r[id] ?? { observacao: '' }), ok } }))

  return (
    <Cartao>
      <CartaoTitulo
        titulo="Checklist de entrada"
        descricao="Como o carro chegou. Precisa estar respondido antes de iniciar o serviço."
        acao={
          faltam > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              faltam {faltam}
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              <ClipboardCheck className="size-3.5" aria-hidden />
              completo
            </span>
          )
        }
      />

      <ul className="divide-y divide-slate-100 px-4">
        {os.checklist.map((item) => {
          const r = respostas[item.id] ?? { ok: null, observacao: '' }
          return (
            <li key={item.id} className="py-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-slate-800">{item.descricao}</span>
                <button
                  type="button"
                  onClick={() => marcar(item.id, true)}
                  aria-label={`${item.descricao}: sem problema`}
                  className={cx(
                    'grid size-9 place-items-center rounded-lg ring-1 transition',
                    r.ok === true
                      ? 'bg-emerald-500 text-white ring-emerald-500'
                      : 'bg-white text-slate-400 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  <Check className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => marcar(item.id, false)}
                  aria-label={`${item.descricao}: tem ressalva`}
                  className={cx(
                    'grid size-9 place-items-center rounded-lg ring-1 transition',
                    r.ok === false
                      ? 'bg-red-500 text-white ring-red-500'
                      : 'bg-white text-slate-400 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* A observação só aparece quando há ressalva: é ali que mora a
                  prova — "risco na porta direita" vale mais que o "não" seco. */}
              {r.ok === false && (
                <Entrada
                  className="mt-2 text-xs"
                  value={r.observacao}
                  onChange={(e) =>
                    setRespostas((s) => ({
                      ...s,
                      [item.id]: { ...(s[item.id] ?? { ok: false }), observacao: e.target.value },
                    }))
                  }
                  placeholder="O que tem? Ex.: risco na porta direita"
                />
              )}
            </li>
          )
        })}
      </ul>

      <div className="border-t border-slate-200 p-4">
        <Botao className="w-full" carregando={salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar checklist
        </Botao>
      </div>
    </Cartao>
  )
}
