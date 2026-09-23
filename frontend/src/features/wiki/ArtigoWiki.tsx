import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, ScanLine, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import type { DetalheArtigo, ResumoLeitura } from '../../types'
import {
  Botao,
  Carregando,
  Cartao,
  CartaoTitulo,
  Etiqueta,
  Vazio,
  useAviso,
} from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { dataCurta } from '../../lib/format'
import PainelArtigo from './PainelArtigo'

export default function ArtigoWiki() {
  const { id = '' } = useParams()
  const { gerencia } = useAuth()
  const avisar = useAviso()
  const navegar = useNavigate()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState(false)

  const consulta = useQuery({
    queryKey: ['wiki-artigo', id],
    queryFn: () => api<DetalheArtigo>(`/wiki/${id}`),
  })

  const artigo = consulta.data

  /**
   * As leituras do mesmo modelo. É o que amarra a wiki ao scanner: o texto
   * diz o que fazer, e a leitura mostra como o carro bom se comporta.
   */
  const leituras = useQuery({
    queryKey: ['leituras', artigo?.resumo.modelo ?? ''],
    queryFn: () =>
      api<{ content: ResumoLeitura[] }>(
        `/leituras?busca=${encodeURIComponent(artigo!.resumo.modelo!)}&tamanho=5`,
      ),
    enabled: Boolean(artigo?.resumo.modelo),
  })

  const apagar = useMutation({
    mutationFn: () => api(`/wiki/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wiki'] })
      avisar('Artigo apagado.')
      navegar('/wiki')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  if (consulta.isLoading) return <Carregando texto="Abrindo o artigo..." />
  if (consulta.isError || !artigo) {
    return (
      <div className="p-4">
        <Vazio titulo="Artigo não encontrado" descricao={(consulta.error as Error)?.message} />
      </div>
    )
  }

  const a = artigo.resumo

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Link
        to="/wiki"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Wiki
      </Link>

      <Cartao>
        <div className="flex flex-wrap items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-slate-900">{a.titulo}</h1>
            <p className="mt-0.5 text-sm font-medium text-marca-700">{a.alcance}</p>

            {a.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {a.tags.map((t) => (
                  <Etiqueta key={t}>{t}</Etiqueta>
                ))}
              </div>
            )}

            <p className="mt-2 text-xs text-slate-400">
              {a.autor ? `${a.autor} · ` : ''}
              {dataCurta(a.atualizadoEm ?? a.criadoEm)}
              {!a.publicado && ' · rascunho'}
            </p>
          </div>

          <div className="flex gap-2">
            <Botao variante="secundario" onClick={() => setEditando(true)}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </Botao>
            {gerencia && (
              <Botao
                variante="secundario"
                onClick={() => apagar.mutate()}
                carregando={apagar.isPending}
              >
                <Trash2 className="size-4" aria-hidden />
              </Botao>
            )}
          </div>
        </div>
      </Cartao>

      <Cartao>
        <div className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-slate-800">
          {artigo.corpo}
        </div>
      </Cartao>

      {artigo.fotos.length > 0 && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {artigo.fotos.map((f) => (
            <figure key={f.id} className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
              <img src={f.url} alt={f.legenda ?? a.titulo} className="w-full object-cover" />
              {f.legenda && (
                <figcaption className="px-2 py-1 text-xs text-slate-500">{f.legenda}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {(leituras.data?.content ?? []).length > 0 && (
        <Cartao>
          <CartaoTitulo
            titulo="Leituras deste modelo"
            descricao="O texto diz o que fazer; a leitura mostra como o carro bom se comporta"
          />
          <div className="divide-y divide-slate-100">
            {leituras.data!.content.map((l) => (
              <Link
                key={l.id}
                to={`/leituras/${l.id}`}
                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50"
              >
                <ScanLine className="size-4 flex-none text-slate-400" aria-hidden />
                <Etiqueta
                  className={
                    l.tipo === 'OFICIAL'
                      ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                      : 'bg-amber-100 text-amber-800 ring-amber-200'
                  }
                >
                  {l.tipoDescricao}
                </Etiqueta>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                  {l.condicao ?? l.modeloDescricao}
                </span>
                <span className="flex-none text-xs text-slate-400">{l.itens} itens</span>
              </Link>
            ))}
          </div>
        </Cartao>
      )}

      {editando && (
        <PainelArtigo
          artigoId={id}
          onFechar={() => setEditando(false)}
          onSalvo={() => {
            setEditando(false)
            void queryClient.invalidateQueries({ queryKey: ['wiki-artigo', id] })
            void queryClient.invalidateQueries({ queryKey: ['wiki'] })
            avisar('Artigo salvo.')
          }}
        />
      )}
    </div>
  )
}
