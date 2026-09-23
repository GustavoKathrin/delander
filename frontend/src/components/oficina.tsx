import { cx } from './ui'

// ==================================================================== cores

/** Cor que o cliente falou -> cor que a gente pinta o carro na planta. */
const CORES_VEICULO: Record<string, string> = {
  branco: '#f5f5f4',
  prata: '#c7cad1',
  cinza: '#8a9099',
  grafite: '#4b5563',
  preto: '#26272b',
  vermelho: '#c0392f',
  vinho: '#7f1d2e',
  laranja: '#e07a20',
  amarelo: '#e3b824',
  azul: '#2f5fa8',
  'azul escuro': '#1e3a6b',
  verde: '#2f7a4f',
  marrom: '#6b4b32',
  bege: '#d9c9a8',
  dourado: '#bfa14a',
}

export function corDoVeiculo(cor?: string | null): string {
  if (!cor) return '#9aa0a8'
  const chave = cor.trim().toLowerCase()
  return CORES_VEICULO[chave] ?? CORES_VEICULO[chave.split(' ')[0]] ?? '#9aa0a8'
}

export function canais(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ]
}

export function paraHex(r: number, g: number, b: number): string {
  const limite = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[r, g, b].map((v) => limite(v).toString(16).padStart(2, '0')).join('')}`
}

/** Carro claro pede vidro escuro; carro escuro pede vidro claro. */
export function claro(hex: string): boolean {
  const [r, g, b] = canais(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

export function clarear(hex: string, fator: number): string {
  const [r, g, b] = canais(hex)
  return paraHex(r + (255 - r) * fator, g + (255 - g) * fator, b + (255 - b) * fator)
}

export function escurecer(hex: string, fator: number): string {
  const [r, g, b] = canais(hex)
  return paraHex(r * (1 - fator), g * (1 - fator), b * (1 - fator))
}

// ==================================================================== situacao

export type Situacao =
  | 'LIVRE'
  | 'RESERVADO'
  | 'AGENDADO'
  | 'AGUARDANDO'
  | 'EM_EXECUCAO'
  | 'PARADO'
  | 'PRONTO'

export const CORES_SITUACAO: Record<Situacao, { led: string; borda: string; texto: string }> = {
  LIVRE: { led: '#a8a29e', borda: 'border-stone-400', texto: 'text-stone-500' },
  RESERVADO: { led: '#a8a29e', borda: 'border-stone-400', texto: 'text-stone-500' },
  AGENDADO: { led: '#64748b', borda: 'border-slate-400', texto: 'text-slate-600' },
  AGUARDANDO: { led: '#8b5cf6', borda: 'border-violet-400', texto: 'text-violet-700' },
  EM_EXECUCAO: { led: '#2563eb', borda: 'border-blue-500', texto: 'text-blue-700' },
  PARADO: { led: '#f59e0b', borda: 'border-amber-500', texto: 'text-amber-700' },
  PRONTO: { led: '#16a34a', borda: 'border-emerald-500', texto: 'text-emerald-700' },
}

export function Led({
  situacao,
  pulsando = false,
  tamanho = 8,
}: {
  situacao: Situacao
  pulsando?: boolean
  tamanho?: number
}) {
  return (
    <span
      className={cx('led inline-block flex-none rounded-full', pulsando && 'pulsando')}
      style={{
        width: tamanho,
        height: tamanho,
        backgroundColor: CORES_SITUACAO[situacao].led,
        color: CORES_SITUACAO[situacao].led,
      }}
      aria-hidden
    />
  )
}

// ==================================================================== placa

/** Placa no padrao Mercosul. Substitui o texto monoespacado generico. */
export function Placa({
  placa,
  tamanho = 'md',
  className,
}: {
  placa: string
  tamanho?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const medidas = {
    sm: { largura: 74, fonte: 'text-[13px]', tarja: 'text-[5px] py-[1px]', pad: 'px-1 pb-0.5' },
    md: { largura: 96, fonte: 'text-[17px]', tarja: 'text-[6px] py-[1px]', pad: 'px-1.5 pb-1' },
    lg: { largura: 150, fonte: 'text-[27px]', tarja: 'text-[9px] py-0.5', pad: 'px-2 pb-1.5' },
  }[tamanho]

  const limpa = (placa ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const formatada = limpa.length === 7 ? `${limpa.slice(0, 3)}${limpa.slice(3)}` : limpa

  return (
    <span
      className={cx(
        'inline-flex flex-col overflow-hidden rounded-[3px] bg-white ring-1 ring-slate-900/70 align-middle',
        className,
      )}
      style={{ width: medidas.largura }}
      title={`Placa ${formatada}`}
    >
      <span
        className={cx(
          'flex items-center justify-between bg-[#1c3f94] px-1 font-semibold uppercase tracking-[0.18em] text-white',
          medidas.tarja,
        )}
      >
        <span aria-hidden>●</span>
        <span>Brasil</span>
        <span aria-hidden>BR</span>
      </span>
      <span
        className={cx(
          'fonte-display text-center font-bold leading-none tracking-[0.06em] text-slate-900',
          medidas.fonte,
          medidas.pad,
        )}
      >
        {formatada}
      </span>
    </span>
  )
}

// ==================================================================== carro

let contadorCarro = 0

/**
 * Carro visto de cima, pintado na cor real do veiculo.
 *
 * Proporcao de carro de verdade (~1,8 x 4,4 m), pintura com gradiente de
 * lataria, vidros com reflexo, rodas com pneu e roda, e sombra no chao.
 */
export function CarroTopo({
  cor,
  largura = 58,
  className,
  titulo,
}: {
  cor?: string | null
  largura?: number
  className?: string
  titulo?: string
}) {
  const pintura = corDoVeiculo(cor)
  const ehClaro = claro(pintura)

  const borda = escurecer(pintura, 0.42)
  const meio = clarear(pintura, ehClaro ? 0.1 : 0.22)
  const vinco = ehClaro ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.14)'

  // ids unicos: varios carros na mesma tela nao podem dividir o mesmo gradiente
  const id = `carro-${(contadorCarro += 1)}`

  return (
    <svg
      viewBox="0 0 96 216"
      width={largura}
      height={(largura * 216) / 96}
      className={className}
      role="img"
      aria-label={titulo ?? 'Veículo'}
    >
      {titulo && <title>{titulo}</title>}

      <defs>
        <linearGradient id={`${id}-pintura`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={borda} />
          <stop offset="14%" stopColor={pintura} />
          <stop offset="46%" stopColor={meio} />
          <stop offset="58%" stopColor={meio} />
          <stop offset="86%" stopColor={pintura} />
          <stop offset="100%" stopColor={borda} />
        </linearGradient>
        <linearGradient id={`${id}-vidro`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="42%" stopColor="#33415a" />
          <stop offset="52%" stopColor="#5b6b83" />
          <stop offset="100%" stopColor="#141c2b" />
        </linearGradient>
        <linearGradient id={`${id}-pneu`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a0a0a" />
          <stop offset="50%" stopColor="#2a2a2e" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>

      {/* sombra no piso */}
      <ellipse cx="49" cy="112" rx="43" ry="100" fill="rgba(15,23,42,.16)" />

      {/* pneus */}
      <rect x="3" y="40" width="12" height="32" rx="5" fill={`url(#${id}-pneu)`} />
      <rect x="81" y="40" width="12" height="32" rx="5" fill={`url(#${id}-pneu)`} />
      <rect x="3" y="146" width="12" height="32" rx="5" fill={`url(#${id}-pneu)`} />
      <rect x="81" y="146" width="12" height="32" rx="5" fill={`url(#${id}-pneu)`} />

      {/* retrovisores */}
      <path d="M8 78 h9 v11 h-6 c-2 0 -3 -1.5 -3 -3.5 z" fill={borda} />
      <path d="M88 78 h-9 v11 h6 c2 0 3 -1.5 3 -3.5 z" fill={borda} />

      {/* lataria */}
      <path
        d="M48 4
           C63 4 76 12 81 28
           C84 38 85 52 85 70
           L85 158
           C85 182 80 198 70 206
           C64 210 57 212 48 212
           C39 212 32 210 26 206
           C16 198 11 182 11 158
           L11 70
           C11 52 12 38 15 28
           C20 12 33 4 48 4 Z"
        fill={`url(#${id}-pintura)`}
        stroke="rgba(0,0,0,.4)"
        strokeWidth="1.2"
      />

      {/* vincos do capo */}
      <path d="M28 16 L26 56" stroke={vinco} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M68 16 L70 56" stroke={vinco} strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* para-brisa */}
      <path d="M22 66 C31 57 65 57 74 66 L70 92 L26 92 Z" fill={`url(#${id}-vidro)`} />
      <path d="M26 68 C34 62 50 61 50 61 L34 90 L27 90 Z" fill="rgba(255,255,255,.12)" />

      {/* teto */}
      <rect x="24" y="94" width="48" height="46" rx="8" fill={clarear(pintura, ehClaro ? 0.06 : 0.3)} />
      <rect x="30" y="100" width="36" height="34" rx="6" fill={vinco} opacity=".5" />

      {/* vidro traseiro */}
      <path d="M26 142 L70 142 L74 170 C62 176 34 176 22 170 Z" fill={`url(#${id}-vidro)`} />

      {/* linha das portas */}
      <path d="M13 92 L13 152" stroke="rgba(0,0,0,.28)" strokeWidth="1.2" fill="none" />
      <path d="M83 92 L83 152" stroke="rgba(0,0,0,.28)" strokeWidth="1.2" fill="none" />
      <path d="M13 120 h6 M83 120 h-6" stroke="rgba(0,0,0,.35)" strokeWidth="2.4" strokeLinecap="round" />

      {/* farois */}
      <path d="M19 22 C24 17 32 15 38 15 L38 25 C31 26 24 28 20 31 Z" fill="rgba(255,255,255,.92)" />
      <path d="M77 22 C72 17 64 15 58 15 L58 25 C65 26 72 28 76 31 Z" fill="rgba(255,255,255,.92)" />

      {/* lanternas */}
      <path d="M16 188 C22 191 30 193 38 193 L38 201 C29 201 21 199 15 196 Z" fill="rgba(220,38,38,.9)" />
      <path d="M80 188 C74 191 66 193 58 193 L58 201 C67 201 75 199 81 196 Z" fill="rgba(220,38,38,.9)" />

      {/* brilho geral da pintura */}
      <path
        d="M30 10 C24 26 22 60 22 100 L22 180 C22 196 26 204 30 208"
        stroke="rgba(255,255,255,.18)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ==================================================================== elevador

/** Marca de elevador no piso da vaga: duas rampas, como na oficina. */
let contadorElevador = 0

/**
 * Elevador de duas colunas visto de cima.
 *
 * Retrato (120 x 260) para casar com a proporcao do carro (96 x 216) que fica
 * por cima. Dois estados: vazio, com os bracos recolhidos contra as colunas; e
 * com carro, com os bracos abertos sob a linha das rodas e sombra projetada na
 * base — le "esta suspenso", nao "esta pintado atras".
 */
export function MarcaElevador({
  className,
  comCarro = false,
}: {
  className?: string
  comCarro?: boolean
}) {
  const id = `elev-${(contadorElevador += 1)}`
  const forca = comCarro ? 1 : 0.55

  // Bracos recolhidos ficam quase paralelos a coluna; abertos apontam para as rodas.
  const braco = (x: number, y: number, espelhoX: boolean, espelhoY: boolean) => {
    const dx = (comCarro ? 30 : 8) * (espelhoX ? -1 : 1)
    const dy = (comCarro ? 16 : 30) * (espelhoY ? -1 : 1)
    return { x1: x, y1: y, x2: x + dx, y2: y + dy }
  }

  const colunaX = [16, 104]
  const bracos = colunaX.flatMap((x, i) =>
    [70, 190].map((y, j) => braco(x, y, i === 1, j === 0)),
  )

  return (
    <svg viewBox="0 0 120 260" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-coluna`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.38 * forca} />
          <stop offset="45%" stopColor="currentColor" stopOpacity={0.22 * forca} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.4 * forca} />
        </linearGradient>
      </defs>

      {/* base de concreto com os chumbadores */}
      <rect
        x="6"
        y="30"
        width="108"
        height="200"
        rx="8"
        fill="currentColor"
        opacity={0.07 * forca}
      />
      {[
        [18, 44],
        [102, 44],
        [18, 216],
        [102, 216],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill="currentColor" opacity={0.3 * forca} />
      ))}

      {/* sombra do carro suspenso: so quando tem carro em cima */}
      {comCarro && (
        <ellipse cx="60" cy="132" rx="34" ry="78" fill="currentColor" opacity="0.13" />
      )}

      {/* mangueira hidraulica ligando as colunas */}
      <path
        d="M16 236 H104"
        stroke="currentColor"
        strokeOpacity={0.22 * forca}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* bracos giratorios com sapata na ponta */}
      {bracos.map((b, i) => (
        <g key={i}>
          <path
            d={`M${b.x1} ${b.y1} L${b.x2} ${b.y2}`}
            stroke="currentColor"
            strokeOpacity={comCarro ? 0.5 : 0.24}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          <circle
            cx={b.x2}
            cy={b.y2}
            r={comCarro ? 6.5 : 5}
            fill="currentColor"
            opacity={comCarro ? 0.55 : 0.26}
          />
          {comCarro && (
            <circle cx={b.x2} cy={b.y2} r="3" fill="none" stroke="currentColor" strokeOpacity=".8" strokeWidth="1.2" />
          )}
        </g>
      ))}

      {/* as duas colunas */}
      {colunaX.map((x) => (
        <g key={x}>
          <rect x={x - 11} y="34" width="22" height="192" rx="5" fill={`url(#${id}-coluna)`} />
          <rect
            x={x - 4}
            y="44"
            width="8"
            height="172"
            rx="3"
            fill="currentColor"
            opacity={0.16 * forca}
          />
          <rect x={x - 13} y="26" width="26" height="12" rx="4" fill="currentColor" opacity={0.3 * forca} />
        </g>
      ))}
    </svg>
  )
}

/**
 * Selo do elevador no card do carro.
 * `NO_ELEVADOR` = esta em cima agora; `PRECISA` = espera a vez.
 */
export function SeloElevador({
  estado,
  titulo,
}: {
  estado: 'NO_ELEVADOR' | 'PRECISA'
  titulo?: string
}) {
  const noElevador = estado === 'NO_ELEVADOR'
  return (
    <span
      className={cx(
        'inline-flex flex-none items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide ring-1',
        noElevador
          ? 'bg-blue-600 text-white ring-blue-700'
          : 'bg-amber-100 text-amber-800 ring-amber-300',
      )}
      title={titulo ?? (noElevador ? 'No elevador' : 'Precisa de elevador')}
    >
      <svg viewBox="0 0 16 16" className="size-2.5" aria-hidden>
        <path d="M3 13V4M13 13V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 10.5V3.5M5 6l3-3 3 3" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {noElevador ? 'no elevador' : 'elevador'}
    </span>
  )
}
