/*
 * O carrinho, em 3D.
 *
 * Caixas de quina matada, nao capsulas: carro de verdade visto de cima e um
 * retangulo com os cantos matados. RoundedBoxGeometry da exatamente isso.
 *
 * A pintura e MeshPhysicalMaterial com CLEARCOAT -- a camada de verniz por
 * cima da cor. E o que separa "plastico colorido" de carro: o verniz reflete
 * o galpao numa faixa estreita e nitida enquanto a cor por baixo continua
 * fosca. Carro branco e carro preto saem certos de graca, porque quem da
 * volume aqui e luz de verdade, e nao um gradiente desenhado a mao -- que era
 * justamente o que quebrava no SVG.
 *
 * A cor sai de `corDoVeiculo`, a MESMA tabela que pinta o carro na tela 2D.
 * Duas tabelas divergiriam no primeiro carro cor-de-rosa.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { corDoVeiculo } from '../../../components/oficina'

const G = {
  corpo: new RoundedBoxGeometry(1.8, 0.64, 4.35, 3, 0.13),
  saia: new RoundedBoxGeometry(1.74, 0.3, 4.2, 2, 0.06),
  estufa: new RoundedBoxGeometry(1.63, 0.52, 2.34, 2, 0.07),
  teto: new RoundedBoxGeometry(1.53, 0.14, 1.62, 2, 0.05),
  capo: new RoundedBoxGeometry(1.5, 0.06, 1.15, 2, 0.03),
  parachoque: new RoundedBoxGeometry(1.8, 0.3, 0.2, 2, 0.07),
  farol: new RoundedBoxGeometry(0.48, 0.17, 0.1, 2, 0.03),
  lanterna: new RoundedBoxGeometry(0.44, 0.17, 0.08, 2, 0.03),
  grade: new THREE.BoxGeometry(1, 0.13, 0.06),
  retrovisor: new RoundedBoxGeometry(0.17, 0.1, 0.22, 2, 0.04),
  braco: new THREE.BoxGeometry(0.07, 0.05, 0.1),
  roda: new THREE.CylinderGeometry(0.325, 0.325, 0.22, 20),
  aro: new THREE.CylinderGeometry(0.2, 0.2, 0.225, 16),
}
G.roda.rotateZ(Math.PI / 2)
G.aro.rotateZ(Math.PI / 2)

/*
 * Um carro, sete malhas.
 *
 * Peca separada custa uma chamada de desenho, e sete carros davam 154
 * chamadas so de carro -- medido com renderer.info. As pecas que dividem o
 * mesmo material sao coladas numa geometria so, uma vez, no carregamento: o
 * carro cai de 22 malhas para 7 e a cena inteira foi de 224 para 138
 * chamadas.
 *
 * `toNonIndexed` em tudo porque mergeGeometries devolve null quando mistura
 * geometria indexada com nao indexada.
 */
type Peca = [THREE.BufferGeometry, number, number, number]

function colar(pecas: Peca[]): THREE.BufferGeometry {
  const partes = pecas.map(([geo, x, y, z]) => {
    const g = geo.clone().toNonIndexed()
    g.translate(x, y, z)
    return g
  })
  return BufferGeometryUtils.mergeGeometries(partes)!
}

const RODAS: [number, number][] = [
  [-0.84, -1.4],
  [0.84, -1.4],
  [-0.84, 1.42],
  [0.84, 1.42],
]

const COLADO = {
  pintura: colar([
    [G.corpo, 0, 0.66, 0],
    [G.capo, 0, 0.965, -1.22],
    [G.teto, 0, 1.49, -0.26],
    [G.retrovisor, -1, 1.04, -0.8],
    [G.retrovisor, 1, 1.04, -0.8],
  ]),
  plastico: colar([
    [G.saia, 0, 0.42, 0],
    [G.parachoque, 0, 0.56, -2.12],
    [G.parachoque, 0, 0.56, 2.12],
    [G.grade, 0, 0.78, -2.18],
    [G.braco, -0.92, 1.04, -0.78],
    [G.braco, 0.92, 1.04, -0.78],
  ]),
  pneus: colar(RODAS.map(([x, z]) => [G.roda, x, 0.325, z] as Peca)),
  aros: colar(RODAS.map(([x, z]) => [G.aro, x * 1.01, 0.325, z] as Peca)),
  farois: colar([
    [G.farol, -0.6, 0.84, -2.16],
    [G.farol, 0.6, 0.84, -2.16],
  ]),
  lanternas: colar([
    [G.lanterna, -0.62, 0.86, 2.16],
    [G.lanterna, 0.62, 0.86, 2.16],
  ]),
  vidro: colar([[G.estufa, 0, 1.2, -0.12]]),
}

const M = {
  vidro: new THREE.MeshPhysicalMaterial({
    color: 0x0e1621,
    metalness: 0.1,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  }),
  pneu: new THREE.MeshStandardMaterial({ color: 0x121216, roughness: 0.92 }),
  aro: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 }),
  plastico: new THREE.MeshStandardMaterial({ color: 0x26282d, roughness: 0.62, metalness: 0.15 }),
  farol: new THREE.MeshPhysicalMaterial({
    color: 0xeef2f6,
    roughness: 0.08,
    clearcoat: 1,
    emissive: 0x223044,
    emissiveIntensity: 0.4,
  }),
  lanterna: new THREE.MeshPhysicalMaterial({
    color: 0x8f1414,
    roughness: 0.15,
    clearcoat: 1,
    emissive: 0x6b0f0f,
    emissiveIntensity: 0.5,
  }),
}

function peca(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export interface Carro extends THREE.Group {
  pintar: (cor?: string | null) => void
}

/** Monta um carro. A frente aponta para -Z, como tudo no three.js. */
export function montarCarro(cor?: string | null): Carro {
  const g = new THREE.Group() as Carro

  const pintura = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(corDoVeiculo(cor)),
    metalness: 0.35,
    roughness: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    envMapIntensity: 1.1,
  })

  g.add(peca(COLADO.pintura, pintura))
  g.add(peca(COLADO.plastico, M.plastico))
  g.add(peca(COLADO.vidro, M.vidro))
  g.add(peca(COLADO.pneus, M.pneu))
  g.add(peca(COLADO.aros, M.aro))
  g.add(peca(COLADO.farois, M.farol))
  g.add(peca(COLADO.lanternas, M.lanterna))

  g.pintar = (nova) => pintura.color.set(corDoVeiculo(nova))
  return g
}
