/*
 * De quem a oficina compra peça.
 *
 * Existe por causa da cotação: a secretária liga para três lugares, anota o
 * preço de cada um e escolhe. Sem cadastro, o nome era digitado de novo a
 * cada peça — e "Auto Peças Silva", "autopecas silva" e "Silva" viravam três
 * fornecedores diferentes na hora de comparar o histórico de preço.
 *
 * Quase tudo é opcional de propósito. O que a oficina tem na mão no começo é
 * um nome e um telefone; exigir CNPJ e endereço só faria o cadastro ficar
 * vazio e a secretária continuar anotando no papel.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Phone, Plus, Trash2, Truck } from 'lucide-react'

import { api } from '../../api/client'
import {
  AvisoErro,
  Botao,
  Campo,
  Carregando,
  Entrada,
  Interruptor,
  Modal,
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import type { Fornecedor } from '../../types'

const VAZIO = {
  nome: '',
  especialidade: '',
  telefone: '',
  whatsapp: '',
  email: '',
  cnpj: '',
  cidade: '',
  prazoDiasTipico: '',
  observacao: '',
  ativo: true,
}

export default function Fornecedores() {
  const queryClient = useQueryClient()
  const avisar = useAviso()
  const [editando, setEditando] = useState<Fornecedor | null>(null)
  const [aberto, setAberto] = useState(false)

  const consulta = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => api<Fornecedor[]>('/fornecedores'),
  })

  const apagar = useMutation({
    mutationFn: (id: string) => api(`/fornecedores/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => {
      avisar('Fornecedor apagado.')
      void queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
    },
    onError: (e: Error) => avisar(e.message, 'erro'),
  })

  if (consulta.isLoading) return <Carregando texto="Abrindo os fornecedores..." />

  const lista = consulta.data ?? []
  const ativos = lista.filter((f) => f.ativo)
  const comPrazo = ativos.filter((f) => f.prazoDiasTipico != null)
  const prazoMedio =
    comPrazo.length > 0
      ? Math.round(comPrazo.reduce((s, f) => s + (f.prazoDiasTipico ?? 0), 0) / comPrazo.length)
      : null

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <header className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200">
        <div>
          <h1 className="fonte-display text-base font-bold text-slate-900">Fornecedores</h1>
          <p className="text-xs text-slate-500">de quem a oficina compra peça</p>
        </div>
        <div>
          <p className="fonte-display text-2xl font-bold leading-none text-slate-900">
            {ativos.length}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            ativos
          </p>
        </div>
        <div>
          <p className="fonte-display text-2xl font-bold leading-none text-slate-900">
            {prazoMedio == null ? '—' : `${prazoMedio}d`}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            prazo típico médio
          </p>
          {prazoMedio == null && (
            <p className="mt-0.5 text-[11px] text-slate-400">ninguém tem prazo anotado</p>
          )}
        </div>
        <Botao
          className="ml-auto"
          onClick={() => {
            setEditando(null)
            setAberto(true)
          }}
        >
          <Plus className="size-4" aria-hidden />
          Novo fornecedor
        </Botao>
      </header>

      {lista.length === 0 ? (
        <Vazio
          icone={<Truck className="size-8" />}
          titulo="Nenhum fornecedor cadastrado"
          descricao="Cadastre quem vende peça para a oficina. É dessa lista que sai a cotação."
          acao={
            <Botao
              onClick={() => {
                setEditando(null)
                setAberto(true)
              }}
            >
              Cadastrar o primeiro
            </Botao>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {lista.map((f) => (
              <li
                key={f.id}
                className={cx(
                  'flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3',
                  !f.ativo && 'opacity-60',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {f.nome}
                    {!f.ativo && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        desativado
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[f.especialidade, f.cidade].filter(Boolean).join(' · ') || 'sem descrição'}
                  </p>
                </div>

                {f.telefone && (
                  <a
                    href={`tel:${f.telefone.replace(/\D/g, '')}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-marca-700 hover:underline"
                  >
                    <Phone className="size-3.5" aria-hidden />
                    {f.telefone}
                  </a>
                )}

                <span className="w-24 text-right text-xs text-slate-500">
                  {f.prazoDiasTipico != null ? `${f.prazoDiasTipico} dias` : '—'}
                </span>

                <div className="flex flex-none gap-1">
                  <button
                    type="button"
                    aria-label={`Editar ${f.nome}`}
                    onClick={() => {
                      setEditando(f)
                      setAberto(true)
                    }}
                    className="grid size-11 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Apagar ${f.nome}`}
                    onClick={() => {
                      if (confirm(`Apagar ${f.nome}?`)) apagar.mutate(f.id)
                    }}
                    className="grid size-11 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormularioFornecedor
        aberto={aberto}
        fornecedor={editando}
        onFechar={() => setAberto(false)}
        onSalvo={() => {
          setAberto(false)
          void queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
        }}
      />
    </div>
  )
}

function FormularioFornecedor({
  aberto,
  fornecedor,
  onFechar,
  onSalvo,
}: {
  aberto: boolean
  fornecedor: Fornecedor | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const [campos, setCampos] = useState(VAZIO)
  const [erro, setErro] = useState<string>()

  /*
   * Carrega pela CHAVE, não por efeito.
   *
   * Com useEffect, cada digitada reavaliava a dependência e o campo voltava
   * ao valor salvo no meio da frase. Derivar de uma chave resolve sem efeito
   * nenhum: enquanto a chave não muda, o que a pessoa digitou manda.
   */
  const chave = aberto ? (fornecedor?.id ?? 'novo') : null
  const [carregadoDe, setCarregadoDe] = useState<string | null>(null)
  if (chave !== carregadoDe) {
    setCarregadoDe(chave)
    setErro(undefined)
    setCampos(
      fornecedor
        ? {
            nome: fornecedor.nome,
            especialidade: fornecedor.especialidade ?? '',
            telefone: fornecedor.telefone ?? '',
            whatsapp: fornecedor.whatsapp ?? '',
            email: fornecedor.email ?? '',
            cnpj: fornecedor.cnpj ?? '',
            cidade: fornecedor.cidade ?? '',
            prazoDiasTipico:
              fornecedor.prazoDiasTipico != null ? String(fornecedor.prazoDiasTipico) : '',
            observacao: fornecedor.observacao ?? '',
            ativo: fornecedor.ativo,
          }
        : VAZIO,
    )
  }

  const salvar = useMutation({
    mutationFn: () =>
      api(fornecedor ? `/fornecedores/${fornecedor.id}` : '/fornecedores', {
        metodo: fornecedor ? 'PUT' : 'POST',
        corpo: {
          ...campos,
          prazoDiasTipico: campos.prazoDiasTipico ? Number(campos.prazoDiasTipico) : undefined,
        },
      }),
    onSuccess: onSalvo,
    onError: (e: Error) => setErro(e.message),
  })

  const mudar = (chave: keyof typeof VAZIO, valor: string | boolean) =>
    setCampos((c) => ({ ...c, [chave]: valor }))

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={fornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}
      descricao="Só o nome é obrigatório. O resto entra quando você souber."
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            onClick={() => salvar.mutate()}
            carregando={salvar.isPending}
            disabled={campos.nome.trim().length < 2}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Nome" obrigatorio>
            <Entrada
              autoFocus
              value={campos.nome}
              onChange={(e) => mudar('nome', e.target.value)}
              placeholder="Ex.: Auto Peças Silva"
            />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo rotulo="O que costuma vender" dica="Serve de lembrete na hora de cotar.">
            <Entrada
              value={campos.especialidade}
              onChange={(e) => mudar('especialidade', e.target.value)}
              placeholder="Ex.: freio, suspensão, filtros"
            />
          </Campo>
        </div>
        <Campo rotulo="Telefone">
          <Entrada
            value={campos.telefone}
            onChange={(e) => mudar('telefone', e.target.value)}
            inputMode="tel"
          />
        </Campo>
        <Campo rotulo="WhatsApp" dica="Vira link direto na cotação.">
          <Entrada
            value={campos.whatsapp}
            onChange={(e) => mudar('whatsapp', e.target.value)}
            inputMode="tel"
          />
        </Campo>
        <Campo rotulo="Cidade">
          <Entrada value={campos.cidade} onChange={(e) => mudar('cidade', e.target.value)} />
        </Campo>
        <Campo
          rotulo="Prazo típico (dias)"
          dica="Quanto ele costuma levar. Não é promessa, é a média."
        >
          <Entrada
            value={campos.prazoDiasTipico}
            onChange={(e) => mudar('prazoDiasTipico', e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
          />
        </Campo>
        <Campo rotulo="E-mail">
          <Entrada
            type="email"
            value={campos.email}
            onChange={(e) => mudar('email', e.target.value)}
          />
        </Campo>
        <Campo rotulo="CNPJ">
          <Entrada value={campos.cnpj} onChange={(e) => mudar('cnpj', e.target.value)} />
        </Campo>
        <div className="sm:col-span-2">
          <Campo rotulo="Observação">
            <Entrada
              value={campos.observacao}
              onChange={(e) => mudar('observacao', e.target.value)}
              placeholder="Ex.: só entrega acima de R$ 200"
            />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Interruptor
            ativo={campos.ativo}
            onChange={(v) => mudar('ativo', v)}
            rotulo="Ativo"
            descricao="Desativado some das listas de cotação, mas o histórico de preço continua."
          />
        </div>
        <div className="sm:col-span-2">
          <AvisoErro mensagem={erro} />
        </div>
      </div>
    </Modal>
  )
}
