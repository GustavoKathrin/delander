import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Image, Plus, Search } from 'lucide-react'
import { api } from '../../api/client'
import type { ResumoArtigo } from '../../types'
import { Botao, Carregando, Entrada, Etiqueta, Vazio, useAviso } from '../../components/ui'
import { dataCurta } from '../../lib/format'
import PainelArtigo from './PainelArtigo'

interface Pagina {
  content: ResumoArtigo[]
}

export default function Wiki() {
  const avisar = useAviso()
  const queryClient = useQueryClient()

  const [termo, setTermo] = useState('')
  const [busca, setBusca] = useState('')
  const [escrevendo, setEscrevendo] = useState<{ id?: string } | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setBusca(termo.trim()), 300)
    return () => window.clearTimeout(id)
  }, [termo])

  const consulta = useQuery({
    queryKey: ['wiki', busca],
    queryFn: () => api<Pagina>(`/wiki?busca=${encodeURIComponent(busca)}&tamanho=50`),
  })

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Wiki da oficina</h1>
          <p className="mt-1 text-sm text-slate-500">
            O que já deu certo aqui, escrito por quem resolveu. O artigo fica ligado ao modelo —
            o próximo Civic 2014 com o mesmo sintoma cai nele.
          </p>
        </div>
        <Botao onClick={() => setEscrevendo({})}>
          <Plus className="size-4" aria-hidden />
          Escrever artigo
        </Botao>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <Entrada
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Sintoma, peça, marca, modelo ou motor — ex.: falha no frio, Civic"
          className="pl-8"
        />
      </div>

      {consulta.isLoading ? (
        <Carregando texto="Buscando na wiki..." />
      ) : (consulta.data?.content ?? []).length === 0 ? (
        <Vazio
          icone={<BookOpen className="size-8" />}
          titulo={busca ? 'Nada encontrado' : 'A wiki está vazia'}
          descricao={
            busca
              ? 'Tente o sintoma, a peça ou só o modelo.'
              : 'Registre a primeira solução: o que o carro tinha, o que foi feito e como confirmar.'
          }
          acao={<Botao onClick={() => setEscrevendo({})}>Escrever artigo</Botao>}
        />
      ) : (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
          {consulta.data!.content.map((a) => (
            <Link
              key={a.id}
              to={`/wiki/${a.id}`}
              className="rounded-lg bg-white p-3 ring-1 ring-slate-200 transition hover:shadow-md hover:ring-marca-400"
            >
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{a.titulo}</h2>
                {a.fotos > 0 && (
                  <span className="flex flex-none items-center gap-0.5 text-[11px] text-slate-400">
                    <Image className="size-3.5" aria-hidden />
                    {a.fotos}
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-xs font-medium text-marca-700">{a.alcance}</p>

              {a.previa && (
                <p className="mt-1.5 line-clamp-3 text-xs text-slate-600">{a.previa}</p>
              )}

              {a.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.tags.slice(0, 4).map((t) => (
                    <Etiqueta key={t}>{t}</Etiqueta>
                  ))}
                </div>
              )}

              <p className="mt-2 text-[11px] text-slate-400">
                {a.autor ? `${a.autor} · ` : ''}
                {dataCurta(a.atualizadoEm ?? a.criadoEm)}
                {!a.publicado && ' · rascunho'}
              </p>
            </Link>
          ))}
        </div>
      )}

      {escrevendo && (
        <PainelArtigo
          artigoId={escrevendo.id}
          onFechar={() => setEscrevendo(null)}
          onSalvo={() => {
            setEscrevendo(null)
            void queryClient.invalidateQueries({ queryKey: ['wiki'] })
            avisar('Artigo salvo.')
          }}
        />
      )}
    </div>
  )
}
