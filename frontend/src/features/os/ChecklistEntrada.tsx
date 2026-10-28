import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardCheck, X } from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import { BotoesDeFoto, GradeDeFotos, VisorDeFoto } from '../../components/fotos'
import { Botao, Cartao, CartaoTitulo, Entrada, cx, useAviso } from '../../components/ui'
import type { ArquivoOs, DetalheOs } from '../../types'

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
export function ChecklistEntrada({ os, gerencia }: { os: DetalheOs; gerencia: boolean }) {
  const avisar = useAviso()
  const queryClient = useQueryClient()

  type Resposta = { ok: boolean | null; observacao: string }
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({})
  const [aberta, setAberta] = useState<ArquivoOs | null>(null)

  const fotosDeEntrada = os.arquivos.filter((a) => a.momento === 'ENTRADA')
  const fotoAberta = aberta ? (fotosDeEntrada.find((a) => a.id === aberta.id) ?? null) : null
  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['os', os.resumo.id] })
  }

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

  // O cartão some só quando não há nada a registrar nem nada registrado: OS
  // já entregue ou cancelada, sem item e sem foto. Antes ele sumia sempre que
  // faltassem itens — e era exatamente aí que faltava o lugar de pôr a foto.
  const encerrada = os.resumo.status === 'ENTREGUE' || os.resumo.status === 'CANCELADO'
  if (os.checklist.length === 0 && fotosDeEntrada.length === 0 && encerrada) return null

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
                    'grid size-11 place-items-center rounded-lg ring-1 transition',
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
                    'grid size-11 place-items-center rounded-lg ring-1 transition',
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

      {/* ---------------- fotos da entrada ----------------
          A parte do checklist que não depende de quem preencheu ter sido
          honesto. "Risco na porta direita" em texto vira discussão de
          palavra contra palavra; em foto, não vira.

          Só uma entrada por carro: quando este carro voltar e alguém
          fotografar de novo, o servidor apaga estas. Foto de seis meses
          atrás não prova o estado de hoje — provaria contra a oficina. */}
      <div className="border-t border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-800">Fotos da entrada</span>
          {fotosDeEntrada.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              <ClipboardCheck className="size-3" aria-hidden />
              {fotosDeEntrada.length}
            </span>
          )}
          {/* A foto de entrada nasce liberada ao cliente, ao contrário da do
              serviço: ela é a prova dos dois lados numa discussão sobre risco
              que já existia, e prova que só um lado vê não serve. */}
          <BotoesDeFoto
            osId={os.resumo.id}
            momento="ENTRADA"
            visivelCliente
            onPronto={recarregar}
            className="ml-auto"
          />
        </div>

        {fotosDeEntrada.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Ainda sem foto. Fotografe a lataria, as rodas e o painel antes de mexer no carro.
          </p>
        ) : (
          <div className="mt-2">
            <GradeDeFotos fotos={fotosDeEntrada} onAbrir={setAberta} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4">
        <Botao className="w-full" tamanho="toque" carregando={salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar checklist
        </Botao>
      </div>

      {/* Apagar a foto de entrada é da gerência: é prova de como o carro
          chegou, e quem apaga prova assume a escolha. O servidor recusa de
          qualquer forma — aqui o botão nem aparece. */}
      <VisorDeFoto
        foto={fotoAberta}
        osId={os.resumo.id}
        podeApagar={gerencia}
        onFechar={() => setAberta(null)}
        onMudou={recarregar}
      />
    </Cartao>
  )
}
