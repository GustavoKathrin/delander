import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ImagePlus, Trash2, X } from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import type { DetalheArtigo, FotoWiki } from '../../types'
import {
  AreaTexto,
  AvisoErro,
  Campo,
  Entrada,
  Interruptor,
  cx,
} from '../../components/ui'

/**
 * Escrever o artigo.
 *
 * O campo que decide o valor da wiki é o **alcance** (marca/modelo/anos/motor):
 * é ele que faz o texto reaparecer no próximo carro igual. Por isso ele vem
 * antes do corpo, e não escondido no fim do formulário.
 */
export default function PainelArtigo({
  artigoId,
  inicial,
  onFechar,
  onSalvo,
}: {
  artigoId?: string
  inicial?: Partial<{
    marca: string
    modelo: string
    ano: number
    veiculoId: string
    ordemServicoId: string
    leituraId: string
  }>
  onFechar: () => void
  onSalvo: (id: string) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [marca, setMarca] = useState(inicial?.marca ?? '')
  const [modelo, setModelo] = useState(inicial?.modelo ?? '')
  const [motor, setMotor] = useState('')
  const [anoDe, setAnoDe] = useState<string>(inicial?.ano ? String(inicial.ano) : '')
  const [anoAte, setAnoAte] = useState<string>(inicial?.ano ? String(inicial.ano) : '')
  const [tags, setTags] = useState('')
  const [publicado, setPublicado] = useState(true)
  const [fotos, setFotos] = useState<FotoWiki[]>([])
  const [erro, setErro] = useState<string>()

  const existente = useQuery({
    queryKey: ['wiki-artigo', artigoId],
    queryFn: () => api<DetalheArtigo>(`/wiki/${artigoId}`),
    enabled: Boolean(artigoId),
  })

  useEffect(() => {
    const a = existente.data
    if (!a) return
    setTitulo(a.resumo.titulo)
    setCorpo(a.corpo ?? '')
    setMarca(a.resumo.marca ?? '')
    setModelo(a.resumo.modelo ?? '')
    setMotor(a.resumo.motor ?? '')
    setAnoDe(a.resumo.anoDe ? String(a.resumo.anoDe) : '')
    setAnoAte(a.resumo.anoAte ? String(a.resumo.anoAte) : '')
    setTags(a.resumo.tags.join(', '))
    setPublicado(a.resumo.publicado)
    setFotos(a.fotos)
  }, [existente.data])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  const enviarFoto = useMutation({
    mutationFn: (arquivo: File) => {
      const dados = new FormData()
      dados.append('arquivo', arquivo)
      if (artigoId) dados.append('artigoId', artigoId)
      return api<{ id: string; url: string }>('/wiki/fotos', { metodo: 'POST', formData: dados })
    },
    onSuccess: (f) =>
      setFotos((atuais) => [...atuais, { id: f.id, url: f.url, ordem: atuais.length }]),
    onError: (falha) =>
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível enviar a foto.'),
  })

  const apagarFoto = useMutation({
    mutationFn: (id: string) => api(`/wiki/fotos/${id}`, { metodo: 'DELETE' }),
    onSuccess: (_, id) => setFotos((atuais) => atuais.filter((f) => f.id !== id)),
  })

  const salvar = useMutation({
    mutationFn: () => {
      const corpoReq = {
        titulo,
        corpo,
        marca: marca || undefined,
        modelo: modelo || undefined,
        motor: motor || undefined,
        anoDe: anoDe ? Number(anoDe) : undefined,
        anoAte: anoAte ? Number(anoAte) : undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        veiculoId: inicial?.veiculoId,
        ordemServicoId: inicial?.ordemServicoId,
        leituraId: inicial?.leituraId,
        publicado,
        arquivos: fotos.map((f) => f.id),
      }
      return artigoId
        ? api<DetalheArtigo>(`/wiki/${artigoId}`, { metodo: 'PUT', corpo: corpoReq })
        : api<DetalheArtigo>('/wiki', { metodo: 'POST', corpo: corpoReq })
    },
    onSuccess: (a) => onSalvo(a.resumo.id),
    onError: (falha) =>
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível salvar.'),
  })

  const pronto = titulo.trim().length > 3 && corpo.trim().length > 10

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-aco-900/60" onClick={onFechar} aria-hidden />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={artigoId ? 'Editar artigo' : 'Escrever artigo'}
        className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
      >
        <header className="chapa flex items-center gap-2 px-4 py-3">
          <h2 className="fonte-display text-sm font-extrabold uppercase tracking-widest text-white">
            {artigoId ? 'Editar artigo' : 'Escrever artigo'}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="ml-auto rounded p-1 text-zinc-400 hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto rolagem-suave p-4">
          <Campo rotulo="Título" obrigatorio dica="O sintoma, do jeito que o cliente descreve">
            <Entrada
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Falha na partida a frio e luz de injeção acesa"
            />
          </Campo>

          {/* O alcance vem antes do texto: é ele que faz o artigo reaparecer. */}
          <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="fonte-display text-xs font-bold uppercase tracking-widest text-slate-500">
              Para quais carros isto serve
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Deixe em branco o que não importa. Sem marca e modelo, vale para qualquer carro.
            </p>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Campo rotulo="Marca">
                <Entrada value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Honda" />
              </Campo>
              <Campo rotulo="Modelo">
                <Entrada value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Civic" />
              </Campo>
              <Campo rotulo="Motor">
                <Entrada value={motor} onChange={(e) => setMotor(e.target.value)} placeholder="2.0 flex" />
              </Campo>
              <div className="grid grid-cols-2 gap-2">
                <Campo rotulo="Do ano">
                  <Entrada
                    type="number"
                    value={anoDe}
                    onChange={(e) => setAnoDe(e.target.value)}
                    placeholder="2012"
                  />
                </Campo>
                <Campo rotulo="Até">
                  <Entrada
                    type="number"
                    value={anoAte}
                    onChange={(e) => setAnoAte(e.target.value)}
                    placeholder="2016"
                  />
                </Campo>
              </div>
            </div>
          </div>

          <Campo
            rotulo="O que foi feito"
            obrigatorio
            dica="O que o carro tinha, o que você testou, o que resolveu e como confirmar"
          >
            <AreaTexto
              rows={12}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              placeholder={
                'Sintoma: …\n\nO que foi medido: …\n\nCausa: …\n\nSolução: …\n\nComo confirmar: …'
              }
            />
          </Campo>

          <Campo rotulo="Etiquetas" dica="Separadas por vírgula — ajudam na busca">
            <Entrada
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="partida a frio, sensor ECT, injeção"
            />
          </Campo>

          {/* ------------------------------------------------------ fotos */}
          <div>
            <p className="mb-1.5 fonte-display text-xs font-bold uppercase tracking-widest text-slate-500">
              Fotos
            </p>
            <div className="flex flex-wrap gap-2">
              {fotos.map((f) => (
                <div key={f.id} className="relative">
                  <img
                    src={f.url}
                    alt={f.legenda ?? 'foto do artigo'}
                    className="size-24 rounded-md object-cover ring-1 ring-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => apagarFoto.mutate(f.id)}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white shadow"
                    aria-label="Remover foto"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                </div>
              ))}

              <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-stone-300 text-stone-400 transition hover:border-marca-500 hover:text-marca-600">
                <ImagePlus className="size-5" aria-hidden />
                <span className="text-[10px]">adicionar</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0]
                    if (arquivo) enviarFoto.mutate(arquivo)
                  }}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
            <Interruptor
              ativo={publicado}
              onChange={setPublicado}
              rotulo="Publicado"
              descricao="Desligue para deixar como rascunho enquanto termina de escrever."
            />
          </div>

          <AvisoErro mensagem={erro} />
        </div>

        <footer className="border-t border-slate-200 bg-white p-3">
          <button
            type="button"
            disabled={!pronto || salvar.isPending}
            onClick={() => salvar.mutate()}
            className={cx(
              'fonte-display h-12 w-full rounded-md text-sm font-extrabold uppercase tracking-wider transition',
              pronto && !salvar.isPending
                ? 'bg-faixa sobre-destaque hover:brightness-110'
                : 'cursor-not-allowed bg-slate-200 text-slate-400',
            )}
          >
            {salvar.isPending ? 'Salvando...' : 'Salvar artigo'}
          </button>
        </footer>
      </aside>
    </div>
  )
}
