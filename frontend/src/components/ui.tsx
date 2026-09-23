import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ------------------------------------------------------------------ botao

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'sucesso'
type Tamanho = 'sm' | 'md' | 'lg' | 'xl'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca-600 text-white hover:bg-marca-700 focus-visible:outline-marca-600 shadow-sm',
  secundario:
    'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400',
  fantasma: 'text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400',
  perigo: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 shadow-sm',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600 shadow-sm',
}

const TAMANHOS: Record<Tamanho, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  xl: 'h-16 px-6 text-lg gap-3 font-semibold',
}

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: Tamanho
  carregando?: boolean
  bloco?: boolean
}

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  bloco = false,
  className,
  children,
  disabled,
  ...resto
}: BotaoProps) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-medium transition',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        bloco && 'w-full',
        className,
      )}
    >
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

// ------------------------------------------------------------------ cartao

export function Cartao({
  className,
  children,
  ...resto
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...resto}
      className={cx('rounded-xl bg-white shadow-sm ring-1 ring-slate-200', className)}
    >
      {children}
    </div>
  )
}

export function CartaoTitulo({
  titulo,
  descricao,
  acao,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

// ------------------------------------------------------------------ campos

export function Campo({
  rotulo,
  erro,
  dica,
  obrigatorio,
  children,
}: {
  rotulo?: string
  erro?: string
  dica?: string
  obrigatorio?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      {rotulo && (
        <span className="mb-1 block text-xs font-medium text-slate-700">
          {rotulo}
          {obrigatorio && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      )}
      {children}
      {erro ? (
        <span className="mt-1 block text-xs text-red-600">{erro}</span>
      ) : (
        dica && <span className="mt-1 block text-xs text-slate-400">{dica}</span>
      )}
    </label>
  )
}

const ESTILO_CAMPO =
  'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-300 ' +
  'placeholder:text-slate-400 focus:ring-2 focus:ring-marca-600 disabled:bg-slate-50 disabled:text-slate-500'

export function Entrada({ className, ...resto }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...resto} className={cx(ESTILO_CAMPO, className)} />
}

export function Selecao({ className, children, ...resto }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...resto} className={cx(ESTILO_CAMPO, 'pr-8', className)}>
      {children}
    </select>
  )
}

export function AreaTexto({ className, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...resto} rows={resto.rows ?? 3} className={cx(ESTILO_CAMPO, className)} />
}

export function Interruptor({
  ativo,
  onChange,
  rotulo,
  descricao,
  desabilitado,
}: {
  ativo: boolean
  onChange: (valor: boolean) => void
  rotulo: string
  descricao?: string
  desabilitado?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{rotulo}</p>
        {descricao && <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={rotulo}
        disabled={desabilitado}
        onClick={() => onChange(!ativo)}
        className={cx(
          'relative mt-0.5 h-6 w-11 flex-none rounded-full transition disabled:opacity-50',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600',
          ativo ? 'bg-marca-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
            ativo ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}

// ------------------------------------------------------------------ etiquetas

export function Etiqueta({
  className,
  children,
  titulo,
}: {
  className?: string
  children: ReactNode
  titulo?: string
}) {
  return (
    <span
      title={titulo}
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        className ?? 'bg-slate-100 text-slate-700 ring-slate-200',
      )}
    >
      {children}
    </span>
  )
}

export function Barra({
  percentual,
  cor,
  altura = 'h-1.5',
}: {
  percentual: number
  cor?: string
  altura?: string
}) {
  const largura = Math.max(Math.min(percentual, 100), 0)
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-slate-200', altura)}>
      <div
        className={cx('h-full rounded-full transition-all', cor ?? 'bg-marca-600')}
        style={{ width: `${largura}%` }}
      />
    </div>
  )
}

// ------------------------------------------------------------------ estados

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {texto}
    </div>
  )
}

export function Vazio({
  titulo,
  descricao,
  acao,
  icone,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  icone?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icone && <div className="text-slate-300">{icone}</div>}
      <p className="text-sm font-medium text-slate-700">{titulo}</p>
      {descricao && <p className="max-w-sm text-xs text-slate-500">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}

export function AvisoErro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
      <AlertTriangle className="mt-0.5 size-4 flex-none" aria-hidden />
      <span>{mensagem}</span>
    </div>
  )
}

// ------------------------------------------------------------------ modal

export function Modal({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = 'max-w-lg',
}: {
  aberto: boolean
  onFechar: () => void
  titulo: string
  descricao?: string
  children: ReactNode
  rodape?: ReactNode
  largura?: string
}) {
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = ''
    }
  }, [aberto, onFechar])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onFechar}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cx(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          largura,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-xs text-slate-500">{descricao}</p>}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && (
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {rodape}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ avisos

interface Aviso {
  id: number
  texto: string
  tipo: 'sucesso' | 'erro'
}

const ContextoAviso = createContext<(texto: string, tipo?: 'sucesso' | 'erro') => void>(() => {})

export function useAviso() {
  return useContext(ContextoAviso)
}

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const avisar = useCallback((texto: string, tipo: 'sucesso' | 'erro' = 'sucesso') => {
    const id = Date.now() + Math.random()
    setAvisos((atuais) => [...atuais, { id, texto, tipo }])
    setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== id)), 4500)
  }, [])

  const valor = useMemo(() => avisar, [avisar])

  return (
    <ContextoAviso.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            className={cx(
              'pointer-events-auto flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm shadow-lg ring-1',
              aviso.tipo === 'sucesso'
                ? 'bg-white text-slate-800 ring-slate-200'
                : 'bg-red-50 text-red-800 ring-red-200',
            )}
          >
            {aviso.tipo === 'sucesso' ? (
              <CheckCircle2 className="mt-0.5 size-4 flex-none text-emerald-600" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 flex-none text-red-600" aria-hidden />
            )}
            <span>{aviso.texto}</span>
          </div>
        ))}
      </div>
    </ContextoAviso.Provider>
  )
}

/** Relogio de 1s para os cronometros da tela do mecanico. */
export function useTique(ativo = true) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [ativo])
  return agora
}

/**
 * Tela larga o bastante para a planta do pátio arrumada à mão.
 *
 * O layout salvo é de desktop: uma planta de 6 colunas não cabe no celular.
 * Abaixo disso o pátio volta à grade automática e o cadeado some — em vez de
 * mostrar uma planta espremida e ilegível.
 */
export function useTelaLarga(minimo = 1024) {
  const [larga, setLarga] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${minimo}px)`).matches,
  )
  useEffect(() => {
    const consulta = window.matchMedia(`(min-width: ${minimo}px)`)
    const aoMudar = (e: MediaQueryListEvent) => setLarga(e.matches)
    setLarga(consulta.matches)
    consulta.addEventListener('change', aoMudar)
    return () => consulta.removeEventListener('change', aoMudar)
  }, [minimo])
  return larga
}
