import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Camera, FileText, ImageOff, Images, Loader2, Trash2, X } from 'lucide-react'

import { api, baixarArquivo, ErroApi } from '../api/client'
import { Botao, cx, useAviso } from './ui'
import { dataHora, plural } from '../lib/format'
import type { ArquivoOs } from '../types'

/**
 * O caminho do arquivo sem o `/api` da frente.
 *
 * O servidor devolve a URL pronta para um `<img src>` — e é exatamente por
 * isso que ela não serve aqui: `api()` já põe a base na frente, e com
 * `VITE_API_BASE` apontando direto para o Render essa base não é `/api`.
 */
const caminho = (url: string) => url.replace(/^\/api/, '')

/**
 * A foto, buscada com o token.
 *
 * Um `<img src="/api/os/.../arquivos/...">` não manda cabeçalho nenhum, e o
 * endpoint é protegido: **toda foto do sistema voltava 401** e aparecia como
 * ícone de imagem quebrada, que se lê como "ainda não subiu". Valia para a
 * foto de entrada desde o primeiro dia.
 *
 * O object URL morre no unmount. Sem isso, os bytes de cada foto que passou
 * pela tela ficam na memória do navegador até a aba fechar — e são fotos de
 * celular, de megabytes, numa tela que o mecânico deixa aberta o dia todo.
 */
function FotoProtegida({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string>()
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let vivo = true
    let criado: string | undefined
    setSrc(undefined)
    setFalhou(false)

    baixarArquivo(caminho(url))
      .then((blob) => {
        if (!vivo) return
        criado = URL.createObjectURL(blob)
        setSrc(criado)
      })
      .catch(() => {
        if (vivo) setFalhou(true)
      })

    return () => {
      vivo = false
      if (criado) URL.revokeObjectURL(criado)
    }
  }, [url])

  if (falhou) {
    return (
      <span
        title="Não foi possível carregar esta foto"
        className={cx('grid place-items-center bg-slate-100 text-slate-400', className)}
      >
        <ImageOff className="size-5" aria-hidden />
      </span>
    )
  }

  if (!src) {
    return (
      <span className={cx('grid animate-pulse place-items-center bg-slate-100', className)}>
        <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden />
      </span>
    )
  }

  return <img src={src} alt={alt} className={className} />
}

/**
 * Tirar, mostrar e apagar foto — num lugar só.
 *
 * A mecânica de upload (dois inputs escondidos, um com `capture` para abrir
 * a câmera e um com `multiple` para a galeria do celular, FormData, um POST
 * por arquivo) estava escrita no checklist de entrada e ia ser escrita de
 * novo na linha do serviço e no painel do mecânico. São três cópias de uma
 * regra que muda junto — foi exatamente assim que o WhatsApp e o "copiar"
 * divergiram neste projeto.
 *
 * Por que dois botões e não um `<input>` só: no celular, `capture` abre a
 * câmera direto (é o caso do mecânico, de luva, no box) e sem `capture`
 * abre a galeria (é o caso de quem fotografou antes ou vai anexar um PDF do
 * fornecedor). Um input só obrigaria o Android a perguntar, e a pergunta
 * aparece justamente com a mão suja.
 */
export function useEnviarFotos(osId: string, onPronto?: () => void) {
  const avisar = useAviso()
  const [enviando, setEnviando] = useState(false)

  const mutacao = useMutation({
    mutationFn: async (req: {
      arquivos: File[]
      momento?: 'ENTRADA' | 'EXECUCAO' | 'SAIDA'
      visivelCliente?: boolean
      osItemId?: string
    }) => {
      setEnviando(true)
      try {
        for (const arquivo of req.arquivos) {
          const dados = new FormData()
          dados.append('arquivo', arquivo)
          dados.append('momento', req.momento ?? 'EXECUCAO')
          dados.append('visivelCliente', String(req.visivelCliente ?? false))
          if (req.osItemId) dados.append('osItemId', req.osItemId)
          await api(`/os/${osId}/arquivos`, { metodo: 'POST', formData: dados })
        }
      } finally {
        setEnviando(false)
      }
    },
    onSuccess: (_, req) => {
      onPronto?.()
      avisar(
        `${plural(req.arquivos.length, 'foto')} ${req.arquivos.length === 1 ? 'anexada' : 'anexadas'}.`,
      )
    },
    onError: (erro: Error) =>
      avisar(erro instanceof ErroApi ? erro.message : 'Não foi possível enviar.', 'erro'),
  })

  return { enviar: mutacao.mutate, enviando: enviando || mutacao.isPending }
}

/**
 * Os dois botões de foto: câmera e galeria.
 *
 * `compacto` reduz tudo a um ícone de câmera de 44px — é o que cabe na linha
 * do serviço, onde já existem cinco botões e não sobra largura para a
 * palavra "Câmera".
 */
export function BotoesDeFoto({
  osId,
  osItemId,
  momento,
  visivelCliente,
  onPronto,
  compacto = false,
  rotulo,
  className,
}: {
  osId: string
  osItemId?: string
  momento?: 'ENTRADA' | 'EXECUCAO' | 'SAIDA'
  visivelCliente?: boolean
  onPronto?: () => void
  compacto?: boolean
  /** O que o botão de câmera diz. Padrão: "Câmera". */
  rotulo?: string
  className?: string
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)
  const { enviar, enviando } = useEnviarFotos(osId, () => {
    if (cameraRef.current) cameraRef.current.value = ''
    if (galeriaRef.current) galeriaRef.current.value = ''
    onPronto?.()
  })

  const escolheu = (lista: FileList | null) => {
    if (lista?.length) enviar({ arquivos: Array.from(lista), momento, visivelCliente, osItemId })
  }

  return (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => escolheu(e.target.files)}
      />
      <input
        ref={galeriaRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => escolheu(e.target.files)}
      />

      {compacto ? (
        <button
          type="button"
          disabled={enviando}
          onClick={() => cameraRef.current?.click()}
          title={rotulo ?? 'Fotografar este serviço'}
          aria-label={rotulo ?? 'Fotografar este serviço'}
          className={cx(
            'grid size-11 flex-none place-items-center rounded-lg text-slate-500 transition',
            'hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50',
            className,
          )}
        >
          <Camera className="size-4" aria-hidden />
        </button>
      ) : (
        <div className={cx('flex flex-wrap items-center gap-2', className)}>
          <Botao
            variante="secundario"
            tamanho="toque"
            carregando={enviando}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="size-4" aria-hidden />
            {rotulo ?? 'Câmera'}
          </Botao>
          <Botao
            variante="secundario"
            tamanho="toque"
            carregando={enviando}
            onClick={() => galeriaRef.current?.click()}
          >
            <Images className="size-4" aria-hidden />
            Escolher
          </Botao>
        </div>
      )}
    </>
  )
}

/**
 * Uma grade de miniaturas quadradas.
 *
 * Quadrado e recortado (`object-cover`) de propósito: foto de celular vem em
 * retrato e paisagem na mesma OS, e uma grade que respeita a proporção de
 * cada uma vira escada. O recorte perde pedaço da borda — por isso o toque
 * abre a foto inteira.
 */
export function GradeDeFotos({
  fotos,
  onAbrir,
  colunas = 'grid-cols-4 sm:grid-cols-6',
  tira = false,
}: {
  fotos: ArquivoOs[]
  onAbrir: (foto: ArquivoOs) => void
  colunas?: string
  /**
   * Fila que rola de lado, em vez de grade.
   *
   * É o que cabe no cartão do painel do mecânico: a grade cresceria para
   * baixo e empurraria "Iniciar" e "Concluir" para fora da tela do celular
   * — justamente os botões pelos quais o cartão existe.
   */
  tira?: boolean
}) {
  return (
    <div className={cx(tira ? 'flex gap-2 overflow-x-auto pb-1' : cx('grid gap-2', colunas))}>
      {fotos.map((foto) => (
        <button
          key={foto.id}
          type="button"
          onClick={() => onAbrir(foto)}
          title={foto.nome}
          className={cx(
            'group relative overflow-hidden rounded-lg ring-1 ring-slate-200 transition hover:ring-slate-400',
            tira ? 'size-14 flex-none' : 'aspect-square',
          )}
        >
          {foto.imagem ? (
            <FotoProtegida url={foto.url} alt={foto.nome} className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center bg-slate-100 text-slate-500">
              <FileText className="size-5" aria-hidden />
            </span>
          )}

          {/* O olho só aparece quando a foto está liberada: o normal é
              interno, e marcar o normal é ruído em cima de cada miniatura. */}
          {foto.visivelCliente && (
            <span
              className="absolute bottom-1 right-1 rounded bg-emerald-600/90 px-1 py-0.5 text-[9px] font-semibold leading-none text-white"
              title="O cliente vê esta foto"
            >
              cliente
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * O anexo que não é imagem (o PDF da nota, do orçamento do fornecedor).
 *
 * Um `<a href>` comum voltaria 401 pelo mesmo motivo do `<img>`: o navegador
 * não manda o token. Busca os bytes e abre o blob.
 */
function AbrirArquivo({ foto }: { foto: ArquivoOs }) {
  const avisar = useAviso()
  const [abrindo, setAbrindo] = useState(false)

  const abrir = async () => {
    setAbrindo(true)
    try {
      const blob = await baixarArquivo(caminho(foto.url))
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      // O blob precisa sobreviver ao open; um minuto cobre o carregamento e
      // evita segurar os bytes pelo resto da sessão.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (erro) {
      avisar(erro instanceof ErroApi ? erro.message : 'Não foi possível abrir.', 'erro')
    } finally {
      setAbrindo(false)
    }
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={abrindo}
      className="flex flex-col items-center gap-2 rounded-xl bg-white/10 px-6 py-8 text-center text-white transition hover:bg-white/20 disabled:opacity-60"
    >
      <FileText className="size-10" aria-hidden />
      <span className="text-sm">{foto.nome}</span>
      <span className="text-xs text-slate-300">{abrindo ? 'Abrindo...' : 'Abrir o arquivo'}</span>
    </button>
  )
}

/**
 * A foto inteira, por cima de tudo.
 *
 * Não é um `Modal` comum: foto quer a tela toda e fundo escuro, e os botões
 * precisam ficar longe do centro onde o dedo toca para fechar.
 */
export function VisorDeFoto({
  foto,
  osId,
  podeApagar,
  somenteLeitura = false,
  onFechar,
  onMudou,
}: {
  foto: ArquivoOs | null
  osId: string
  /** Foto de entrada é prova: só a gerência tira. */
  podeApagar: boolean
  /**
   * Sem nenhum botão de ação, só a imagem.
   *
   * É o caso do prontuário: ali se lê o que já aconteceu. Um "o cliente vê"
   * numa passagem entregue há oito meses mudaria um link que ninguém abre
   * mais, e um "apagar" apagaria o histórico de dentro do histórico.
   */
  somenteLeitura?: boolean
  onFechar: () => void
  onMudou: () => void
}) {
  const avisar = useAviso()

  const visibilidade = useMutation({
    mutationFn: (visivelCliente: boolean) =>
      api(`/os/${osId}/arquivos/${foto?.id}`, {
        metodo: 'PATCH',
        corpo: { visivelCliente },
      }),
    onSuccess: (_, visivel) => {
      onMudou()
      avisar(visivel ? 'O cliente passa a ver esta foto.' : 'Foto recolhida do link do cliente.')
    },
    onError: (erro: Error) =>
      avisar(erro instanceof ErroApi ? erro.message : 'Não foi possível mudar.', 'erro'),
  })

  const apagar = useMutation({
    mutationFn: () => api(`/os/${osId}/arquivos/${foto?.id}`, { metodo: 'DELETE' }),
    onSuccess: () => {
      onMudou()
      onFechar()
      avisar('Foto removida.')
    },
    onError: (erro: Error) =>
      avisar(erro instanceof ErroApi ? erro.message : 'Não foi possível remover.', 'erro'),
  })

  if (!foto) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={foto.nome}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 p-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {foto.servico ?? 'Foto do carro'}
          </p>
          <p className="text-xs text-slate-400">{dataHora(foto.quando)}</p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="grid size-11 flex-none place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        {foto.imagem ? (
          <FotoProtegida
            url={foto.url}
            alt={foto.nome}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <AbrirArquivo foto={foto} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* "O cliente vê" é um botão de estado e não um interruptor: aqui o
            fundo é escuro e o interruptor cinza desaparece nele. */}
        {!somenteLeitura && (
        <button
          type="button"
          disabled={visibilidade.isPending}
          onClick={() => visibilidade.mutate(!foto.visivelCliente)}
          className={cx(
            'inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50',
            foto.visivelCliente
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-white/10 text-slate-200 hover:bg-white/20',
          )}
        >
          <Camera className="size-4" aria-hidden />
          {foto.visivelCliente ? 'O cliente vê' : 'Só a oficina'}
        </button>
        )}

        {podeApagar && !somenteLeitura && (
          <button
            type="button"
            disabled={apagar.isPending}
            onClick={() => apagar.mutate()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden />
            Apagar
          </button>
        )}
      </div>
    </div>
  )
}
