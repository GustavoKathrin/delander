/*
 * O piso da oficina, desenhado num canvas e usado como textura.
 *
 * Pintura de chao e PINTURA: linha demarcando a vaga, numero estampado,
 * faixa amarela do corredor, hachura na frente do portao. Fazer isso com
 * geometria daria dezenas de malhas e outras tantas chamadas de desenho; num
 * canvas e um desenho so, e a linha sai com a borda gasta que a tinta de
 * verdade tem.
 */
import type { SituacaoVaga } from '../../../types'
import {
  faixaDoCorredor,
  geometriaDaVaga,
  type Celula,
  type ConfigPlanta,
  type MedidaGalpao,
} from './planta'

const PPM = 110 // pixels por metro

/**
 * As cores de situacao, em hexadecimal CSS.
 *
 * Espelham CORES_SITUACAO de components/oficina -- aqui precisam ser string
 * de canvas, la sao classe do Tailwind. Mesma decisao de cor, dois formatos.
 */
export const COR_SITUACAO: Record<SituacaoVaga, string> = {
  LIVRE: '#d8d2c4',
  RESERVADO: '#a8a29e',
  AGENDADO: '#7c8694',
  AGUARDANDO: '#8b5cf6',
  EM_EXECUCAO: '#2f6fe4',
  PARADO: '#f0a51c',
  PRONTO: '#1fa150',
}

export interface VagaPintada {
  nome: string
  situacao: SituacaoVaga
  celula: Celula
}

function grao(tamanho: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = tamanho
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(tamanho, tamanho)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 150
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 70
  }
  ctx.putImageData(img, 0, 0)
  return cv
}

export function desenharPiso(
  cfg: ConfigPlanta,
  med: MedidaGalpao,
  vagas: VagaPintada[],
): HTMLCanvasElement {
  const W = Math.round(med.largura * PPM)
  const H = Math.round(med.comprimento * PPM)
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!

  const px = (x: number) => ((x + med.largura / 2) / med.largura) * W
  const pz = (z: number) => ((z + med.comprimento / 2) / med.comprimento) * H
  const pm = (m: number) => m * PPM

  // ------------------------------------------------ concreto
  c.fillStyle = '#6f6f6c'
  c.fillRect(0, 0, W, H)
  c.globalAlpha = 0.5
  c.fillStyle = c.createPattern(grao(256), 'repeat')!
  c.fillRect(0, 0, W, H)
  c.globalAlpha = 1

  // juntas de dilatacao da laje
  c.lineWidth = 3
  for (let x = -med.largura / 2 + 3; x < med.largura / 2; x += 3) {
    c.strokeStyle = 'rgba(0,0,0,.22)'
    c.beginPath(); c.moveTo(px(x), 0); c.lineTo(px(x), H); c.stroke()
    c.strokeStyle = 'rgba(255,255,255,.12)'
    c.beginPath(); c.moveTo(px(x) + 3, 0); c.lineTo(px(x) + 3, H); c.stroke()
  }
  for (let z = -med.comprimento / 2 + 3; z < med.comprimento / 2; z += 3) {
    c.strokeStyle = 'rgba(0,0,0,.22)'
    c.beginPath(); c.moveTo(0, pz(z)); c.lineTo(W, pz(z)); c.stroke()
    c.strokeStyle = 'rgba(255,255,255,.12)'
    c.beginPath(); c.moveTo(0, pz(z) + 3); c.lineTo(W, pz(z) + 3); c.stroke()
  }

  // manchas de oleo, proporcionais ao tamanho do barracao
  for (const [fx, fz, r] of [[0.3, 0.3, 1], [0.72, 0.42, 0.7], [0.5, 0.66, 1.3], [0.26, 0.8, 0.6]]) {
    const mx = (fx - 0.5) * med.largura
    const mz = (fz - 0.5) * med.comprimento
    const g = c.createRadialGradient(px(mx), pz(mz), 0, px(mx), pz(mz), pm(r))
    g.addColorStop(0, 'rgba(30,20,8,.45)')
    g.addColorStop(0.6, 'rgba(30,20,8,.18)')
    g.addColorStop(1, 'rgba(30,20,8,0)')
    c.fillStyle = g
    c.beginPath()
    c.ellipse(px(mx), pz(mz), pm(r), pm(r * 0.62), 0.4, 0, Math.PI * 2)
    c.fill()
  }

  // ------------------------------------------------ corredor
  for (const col of med.corredores) {
    const f = faixaDoCorredor(cfg, med, col)
    c.strokeStyle = 'rgba(226,168,20,.7)'
    c.lineWidth = 10
    for (const x of [f.x0 + 0.16, f.x1 - 0.16]) {
      c.beginPath()
      c.moveTo(px(x), pz(-med.comprimento / 2 + 0.5))
      c.lineTo(px(x), pz(med.comprimento / 2 - 0.4))
      c.stroke()
    }
    const cx = px((f.x0 + f.x1) / 2)
    c.fillStyle = 'rgba(226,168,20,.42)'
    for (let z = -med.comprimento / 2 + 3; z < med.comprimento / 2 - 2.5; z += 4) {
      const cy = pz(z)
      c.beginPath()
      c.moveTo(cx - pm(0.5), cy - pm(0.5))
      c.lineTo(cx + pm(0.5), cy - pm(0.5))
      c.lineTo(cx, cy + pm(0.55))
      c.closePath()
      c.fill()
    }
  }

  // hachura de nao obstruir, na boca do portao
  const za = pz(med.comprimento / 2 - 2.3)
  const zb = pz(med.comprimento / 2 - 0.35)
  const hx = px(-cfg.portaoLargura / 2)
  c.save()
  c.beginPath()
  c.rect(hx, za, pm(cfg.portaoLargura), zb - za)
  c.clip()
  c.strokeStyle = 'rgba(226,168,20,.6)'
  c.lineWidth = 11
  for (let i = -30; i < 60; i++) {
    c.beginPath()
    c.moveTo(hx + i * 28, za)
    c.lineTo(hx + i * 28 + (zb - za), zb)
    c.stroke()
  }
  c.restore()

  // ------------------------------------------------ as vagas pintadas
  for (const v of vagas) {
    const g = geometriaDaVaga(cfg, med, v.celula)
    const cor = COR_SITUACAO[v.situacao] ?? COR_SITUACAO.LIVRE
    const x0 = px(g.x - g.larg / 2)
    const z0 = pz(g.z - g.prof / 2)
    const lw = pm(g.larg)
    const lh = pm(g.prof)

    /*
     * A vaga inteira recebe um veu da cor da situacao, nao so a linha.
     *
     * Linha de 10 cm e o que existe no chao de verdade, mas a 25 metros de
     * camera ela tem um pixel e some. O veu e o que faz "este carro esta
     * parado" ser legivel de longe sem transformar o piso num semaforo.
     */
    c.save()
    c.globalAlpha = 0.17
    c.fillStyle = cor
    c.fillRect(x0, z0, lw, lh)
    c.restore()

    c.strokeStyle = 'rgba(255,255,255,.45)'
    c.lineWidth = 26
    c.strokeRect(x0, z0, lw, lh)
    c.strokeStyle = cor
    c.lineWidth = 20
    c.strokeRect(x0, z0, lw, lh)

    c.save()
    c.translate(x0 + lw / 2, z0 + lh / 2)
    c.fillStyle = 'rgba(28,23,17,.42)'
    c.font = `800 ${Math.round(Math.min(lw, lh) * 0.3)}px Archivo, Arial Black, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(v.nome, 0, g.aoLongoDeZ ? lh / 2 - pm(0.62) : 0)
    c.restore()
  }

  return cv
}
