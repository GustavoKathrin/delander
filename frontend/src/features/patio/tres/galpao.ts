/*
 * O barracao, em 3D.
 *
 * Tirado das fotos da Delander: retangulo comprido de bloco pintado -- verde
 * nas laterais, azul na frente --, UM portao so com batente vermelho e folha
 * azul, piso de concreto por dentro e terra vermelha em volta.
 *
 * Sem telhado e sem a estrutura dele. Foram desenhados e tirados: de cima,
 * tesoura e terca riscavam a oficina inteira de cinza e o olho lia as barras
 * antes de ler os carros. A planta existe para mostrar o CHAO.
 *
 * Nenhuma medida daqui e constante: tudo vem de `med`, que planta.ts calcula
 * a partir das vagas.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

import { desenharPiso, type VagaPintada } from './piso'
import type { ConfigPlanta, MedidaGalpao } from './planta'

const ESP = 0.26

const VERDE = 0x3f6b4a
const AZUL = 0x2f6fb5
const TOPO_MURO = 0xbfbbb2
const DENTRO = 0xa7b0b6
const VERMELHO = 0xb03a2e

const mat = (cor: number, rug = 0.88, met = 0) =>
  new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met })

function bloco(geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/**
 * Parede de bloco pintado. A espessura fica sempre no eixo Z LOCAL, e quem
 * decide a cor e a FACE, nao o lado: corMais pinta a face +Z, corMenos a -Z.
 *
 * Importa porque as laterais sao giradas 90 graus em Y, e a rotacao leva o
 * +Z local para o +X do mundo -- raciocinar em "fora e dentro" aqui pinta a
 * parede errada.
 */
function parede(larg: number, alt: number, corMais: number, corMenos: number) {
  const topo = mat(TOPO_MURO, 0.95)
  const faces = [topo, topo, topo, topo, mat(corMais, 0.92), mat(corMenos, 0.92)]
  const m = new THREE.Mesh(new THREE.BoxGeometry(larg, alt, ESP), faces)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export function montarGalpao(
  cfg: ConfigPlanta,
  med: MedidaGalpao,
  vagas: VagaPintada[],
): THREE.Group {
  const g = new THREE.Group()
  const L = med.largura
  const C = med.comprimento
  const ALT = cfg.peDireito

  // terreno e calcada
  const terra = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat(0x8e6248, 1))
  terra.rotation.x = -Math.PI / 2
  terra.position.y = -0.04
  terra.receiveShadow = true
  g.add(terra)

  const calcada = new THREE.Mesh(new THREE.BoxGeometry(L + 6, 0.12, 9), mat(0xa39d94, 0.95))
  calcada.position.set(0, -0.01, C / 2 + 4.4)
  calcada.receiveShadow = true
  g.add(calcada)

  // piso
  const textura = new THREE.CanvasTexture(desenharPiso(cfg, med, vagas))
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = 8
  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(L, C),
    new THREE.MeshStandardMaterial({ map: textura, roughness: 0.93 }),
  )
  piso.rotation.x = -Math.PI / 2
  piso.receiveShadow = true
  g.add(piso)

  // paredes
  const meioX = L / 2 + ESP / 2
  const meioZ = C / 2 + ESP / 2

  const esq = parede(C + ESP * 2, ALT, DENTRO, VERDE)
  esq.rotation.y = Math.PI / 2
  esq.position.set(-meioX, ALT / 2, 0)
  g.add(esq)

  const dir = parede(C + ESP * 2, ALT, VERDE, DENTRO)
  dir.rotation.y = Math.PI / 2
  dir.position.set(meioX, ALT / 2, 0)
  g.add(dir)

  const fundo = parede(L + ESP * 2, ALT, DENTRO, VERDE)
  fundo.position.set(0, ALT / 2, -meioZ)
  g.add(fundo)

  const vaoA = -cfg.portaoLargura / 2
  const vaoB = cfg.portaoLargura / 2
  const largE = vaoA + L / 2 + ESP
  if (largE > 0.05) {
    const fe = parede(largE, ALT, AZUL, DENTRO)
    fe.position.set((-L / 2 - ESP + vaoA) / 2, ALT / 2, meioZ)
    g.add(fe)
  }
  const largD = L / 2 + ESP - vaoB
  if (largD > 0.05) {
    const fd = parede(largD, ALT, AZUL, DENTRO)
    fd.position.set((vaoB + L / 2 + ESP) / 2, ALT / 2, meioZ)
    g.add(fd)
  }
  const verga = parede(cfg.portaoLargura, 0.85, AZUL, DENTRO)
  verga.position.set(0, ALT - 0.42, meioZ)
  g.add(verga)

  // o portao
  const batente = mat(VERMELHO, 0.72)
  const hP = ALT - 0.85
  g.add(bloco(new THREE.BoxGeometry(0.17, hP, 0.4), batente, vaoA, hP / 2, meioZ))
  g.add(bloco(new THREE.BoxGeometry(0.17, hP, 0.4), batente, vaoB, hP / 2, meioZ))
  g.add(bloco(new THREE.BoxGeometry(cfg.portaoLargura, 0.2, 0.4), batente, 0, hP - 0.1, meioZ))
  g.add(
    bloco(
      new THREE.BoxGeometry(cfg.portaoLargura * 0.42, hP - 0.25, 0.1),
      mat(AZUL, 0.6, 0.2),
      vaoB - cfg.portaoLargura * 0.23,
      (hP - 0.25) / 2,
      meioZ + 0.11,
    ),
  )

  // bancada no recuo do fundo
  const zFundo = -C / 2 + cfg.recuoFundo / 2
  const prof = Math.max(0.35, Math.min(0.7, cfg.recuoFundo - 0.3))
  const largBancada = Math.max(1.5, Math.min(L - 1.2, L * 0.62))
  const xBancada = -L / 2 + largBancada / 2 + 0.4
  g.add(bloco(new RoundedBoxGeometry(largBancada, 0.9, prof, 2, 0.04), mat(0x6b5b47, 0.8), xBancada, 0.45, zFundo))
  g.add(bloco(new THREE.BoxGeometry(largBancada, 0.06, prof + 0.04), mat(0x8a8f96, 0.45, 0.6), xBancada, 0.93, zFundo))
  g.add(bloco(new THREE.BoxGeometry(0.3, 0.26, 0.24), mat(0x2f5f7d, 0.5, 0.5), -L / 2 + 1, 1.06, zFundo))
  g.add(bloco(new THREE.BoxGeometry(largBancada * 0.7, 1.4, 0.06), mat(0x9b4a2a, 0.85), xBancada, 2.1, -C / 2 + 0.2))

  // prateleira de pecas no que sobra do fundo
  const largPrat = L - largBancada - 1
  if (largPrat > 1) {
    const xPrat = L / 2 - largPrat / 2 - 0.3
    const aco = mat(0x8d949c, 0.4, 0.8)
    for (let i = 0; i < 4; i++) {
      g.add(bloco(new THREE.BoxGeometry(largPrat, 0.07, 0.55), aco, xPrat, 0.5 + i * 0.6, -C / 2 + 0.48))
    }
    const caixa = new RoundedBoxGeometry(0.46, 0.34, 0.4, 1, 0.02)
    const cores = [0xa98a5e, 0x8e7452, 0xb09468, 0x7d6340]
    const quantas = Math.max(1, Math.floor(largPrat / 0.72))
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < quantas; j++) {
        if ((i + j) % 3 === 2) continue
        g.add(bloco(caixa, mat(cores[(i + j) % 4], 0.9), xPrat - largPrat / 2 + 0.36 + j * 0.72, 0.7 + i * 0.6, -C / 2 + 0.48))
      }
    }
  }

  // tralha de oficina, na faixa de manobra
  const zM = C / 2 - cfg.manobra / 2
  const tambor = new THREE.CylinderGeometry(0.28, 0.28, 0.86, 16)
  g.add(bloco(tambor, mat(0x2f6a8e, 0.6, 0.3), -L / 2 + 0.6, 0.43, zM - 0.6))
  g.add(bloco(tambor, mat(0xb4552f, 0.6, 0.3), -L / 2 + 1.3, 0.43, zM - 0.5))
  g.add(bloco(new THREE.CylinderGeometry(0.28, 0.28, 1.2, 14), mat(0xb03a2e, 0.55, 0.3), L / 2 - 0.65, 0.28, zM - 0.7))
  const pneu = new THREE.TorusGeometry(0.3, 0.11, 8, 18)
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(pneu, mat(0x141418, 0.95))
    p.rotation.x = Math.PI / 2
    p.position.set(L / 2 - 0.6, 0.11 + i * 0.23, zM + 0.6)
    p.castShadow = true
    g.add(p)
  }

  return g
}

/**
 * Elevador de duas colunas.
 *
 * `alturaCarro` e a altura em que a roda fica. Zero desenha o elevador EM
 * BAIXO, com os bracos recolhidos rente ao chao -- que e como um elevador
 * livre aparece na oficina, e a unica forma honesta de mostrar "este
 * equipamento esta vago" sem escrever por cima.
 */
export function montarElevador(alturaCarro: number, aoLongoDeZ: boolean): THREE.Group {
  const g = new THREE.Group()
  const amarelo = new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: 0.5, metalness: 0.4 })
  const escuro = new THREE.MeshStandardMaterial({ color: 0x2a2b30, roughness: 0.55, metalness: 0.55 })
  const borracha = new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.95 })

  const H = 3.05
  const braco = alturaCarro > 0.6 ? alturaCarro + 0.2 : 0.2

  for (const lado of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, H, 0.44), amarelo)
    c.position.set(lado * 1.42, H / 2, 0)
    c.castShadow = true
    c.receiveShadow = true
    g.add(c)

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.95), escuro)
    base.position.set(lado * 1.42, 0.05, 0)
    base.receiveShadow = true
    g.add(base)

    const carrinho = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.52), escuro)
    carrinho.position.set(lado * 1.42, braco + 0.1, 0)
    carrinho.castShadow = true
    g.add(carrinho)

    for (const z of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.15), escuro)
      b.position.set(lado * 0.88, braco, z * 1.2)
      b.rotation.y = lado * z > 0 ? 0.24 : -0.24
      b.castShadow = true
      g.add(b)
      const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 10), borracha)
      pe.position.set(lado * 0.42, braco + 0.1, z * 1.34)
      pe.castShadow = true
      g.add(pe)
    }
  }

  const trave = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.32), amarelo)
  trave.position.set(0, H + 0.1, 0)
  trave.castShadow = true
  g.add(trave)
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.46, 0.2), escuro).translateX(-1.42).translateY(1.3).translateZ(0.32))

  if (!aoLongoDeZ) g.rotation.y = Math.PI / 2
  return g
}
