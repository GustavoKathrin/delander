/*
 * O patio em 3D.
 *
 * Mesmos dados da planta 2D -- esta tela nao tem estado proprio nem editor
 * proprio. Ela le as vagas, converte celula em metro (planta.ts) e desenha.
 * Arrumar a planta com o cadeado, na vista 2D, muda o barracao aqui.
 *
 * Carregada sob demanda (React.lazy): quem nunca abre o patio nunca baixa o
 * three.js, e a tela do mecanico no celular continua exatamente como era.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

import type { Vaga } from '../../../types'
import { cx } from '../../../components/ui'
import { montarCarro } from './carro'
import { montarElevador, montarGalpao } from './galpao'
import { COR_SITUACAO, type VagaPintada } from './piso'
import {
  CONFIG_PADRAO,
  celulaDaVaga,
  geometriaDaVaga,
  medirGalpao,
  type ConfigPlanta,
} from './planta'

type Vista = 'persp' | 'cima' | 'portao'

const VISTAS: { chave: Vista; rotulo: string }[] = [
  { chave: 'persp', rotulo: 'Em perspectiva' },
  { chave: 'cima', rotulo: 'De cima' },
  { chave: 'portao', rotulo: 'Do portão' },
]

interface Props {
  vagas: Vaga[]
  colunas: number
  config?: Partial<ConfigPlanta>
  onAbrir: (osId: string) => void
  onAgendar: (vagaId: string) => void
}

export default function Patio3d({ vagas, colunas, config, onAbrir, onAgendar }: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const [vista, setVista] = useState<Vista>('persp')

  const cfg = useMemo<ConfigPlanta>(
    () => ({ ...CONFIG_PADRAO, ...config, colunas }),
    [config, colunas],
  )

  /*
   * Tudo que o three.js precisa guardar entre renderizacoes do React vive
   * aqui. Estado do React recriaria a cena a cada quadro.
   */
  const tres = useRef<{
    renderer: THREE.WebGLRenderer
    rotulos: CSS2DRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    sol: THREE.DirectionalLight
    mundo: THREE.Group | null
    carros: THREE.Object3D[]
    enquadrar: (v: Vista) => void
  } | null>(null)

  // ------------------------------------------------ montagem, uma vez
  useEffect(() => {
    const alvo = caixa.current
    if (!alvo) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(alvo.clientWidth, alvo.clientHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.72
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    /*
     * A sombra e calculada quando a cena muda, nao a cada quadro. Carro em
     * vaga nao anda sozinho: redesenhar o mapa de sombra 60 vezes por segundo
     * era quase metade das chamadas de desenho -- medido, 455 para 224.
     */
    renderer.shadowMap.autoUpdate = false
    alvo.appendChild(renderer.domElement)

    const camadaRotulos = document.createElement('div')
    camadaRotulos.className = 'pointer-events-none absolute inset-0'
    alvo.appendChild(camadaRotulos)
    const rotulos = new CSS2DRenderer({ element: camadaRotulos })
    rotulos.setSize(alvo.clientWidth, alvo.clientHeight)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x9fc0da)
    scene.fog = new THREE.Fog(0x9fc0da, 60, 160)

    const camera = new THREE.PerspectiveCamera(34, alvo.clientWidth / alvo.clientHeight, 0.5, 400)

    // o ambiente e o que faz o verniz do carro refletir alguma coisa
    const pmrem = new THREE.PMREMGenerator(renderer)
    const sala = new RoomEnvironment()
    scene.environment = pmrem.fromScene(sala, 0.04).texture
    scene.environmentIntensity = 0.38
    sala.dispose()
    pmrem.dispose()

    scene.add(new THREE.HemisphereLight(0xbcd8ef, 0x75736e, 0.6))
    const sol = new THREE.DirectionalLight(0xffffff, 2.3)
    sol.position.set(16, 26, 14)
    sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048)
    sol.shadow.normalBias = 0.03
    sol.shadow.bias = -0.0002
    scene.add(sol)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.dampingFactor = 0.07
    controls.minDistance = 5
    controls.maxDistance = 200
    controls.maxPolarAngle = Math.PI / 2 - 0.04

    const enquadrar = (v: Vista) => {
      const m = tres.current?.mundo?.userData.med
      const d = m ? Math.max(m.largura, m.comprimento) : 20
      if (v === 'cima') {
        camera.position.set(0, d * 1.95, 0.6)
        controls.target.set(0, 0, 0.4)
      } else if (v === 'portao') {
        camera.position.set(1.4, 2.7, (m?.comprimento ?? 20) / 2 + 10)
        controls.target.set(0.4, 1.5, (m?.comprimento ?? 20) / 2 - 5)
      } else {
        camera.position.set(d * 0.78, d * 1.12, d * 0.92)
        controls.target.set(0, 0.5, 0)
      }
      controls.update()
    }

    tres.current = { renderer, rotulos, scene, camera, controls, sol, mundo: null, carros: [], enquadrar }

    const timer = new THREE.Timer()
    timer.connect(document)
    renderer.setAnimationLoop(() => {
      timer.update()
      controls.update(timer.getDelta())
      renderer.render(scene, camera)
      rotulos.render(scene, camera)
    })

    const observador = new ResizeObserver(() => {
      const l = alvo.clientWidth
      const a = alvo.clientHeight
      if (!l || !a) return
      camera.aspect = l / a
      camera.updateProjectionMatrix()
      renderer.setSize(l, a)
      rotulos.setSize(l, a)
    })
    observador.observe(alvo)

    return () => {
      observador.disconnect()
      renderer.setAnimationLoop(null)
      timer.dispose()
      controls.dispose()
      scene.traverse((o) => {
        const malha = o as THREE.Mesh
        malha.geometry?.dispose()
        for (const m of [malha.material ?? []].flat()) {
          for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose()
          ;(m as THREE.Material).dispose?.()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
      camadaRotulos.remove()
      tres.current = null
    }
  }, [])

  // ------------------------------------------------ (re)construir o mundo
  useEffect(() => {
    const t = tres.current
    if (!t) return

    if (t.mundo) {
      t.mundo.traverse((o) => {
        const malha = o as THREE.Mesh
        if (malha.isMesh) malha.geometry?.dispose()
      })
      t.scene.remove(t.mundo)
    }
    for (const r of t.rotulos.domElement.querySelectorAll(':scope > *')) r.remove()

    const celulas = celulaDaVaga(vagas, cfg.colunas)
    const lista = vagas
      .map((v) => ({ vaga: v, celula: celulas.get(v.id)! }))
      .filter((x) => x.celula)
    const med = medirGalpao(cfg, lista.map((x) => x.celula))

    const mundo = new THREE.Group()
    mundo.userData.med = med
    const pintadas: VagaPintada[] = lista.map((x) => ({
      nome: x.vaga.nome,
      situacao: x.vaga.situacao,
      celula: x.celula,
    }))
    mundo.add(montarGalpao(cfg, med, pintadas))

    const carros: THREE.Object3D[] = []
    for (const { vaga, celula } of lista) {
      const g = geometriaDaVaga(cfg, med, celula)
      // vaga reservada esta livre hoje: o carro so chega depois
      const os = vaga.situacao === 'RESERVADO' ? null : vaga.ocupante

      if (vaga.tipo === 'ELEVADOR') {
        const e = montarElevador(os ? 1.5 : 0, g.aoLongoDeZ)
        e.position.set(g.x, 0, g.z)
        mundo.add(e)
      }

      const marca = document.createElement('div')
      if (os) {
        const carro = montarCarro(os.cor)
        carro.rotation.y = g.giro
        carro.position.set(g.x, vaga.tipo === 'ELEVADOR' ? 1.5 : 0, g.z)
        carro.userData.osId = os.id
        carro.userData.titulo = `${os.placa} — ${os.veiculo}`
        mundo.add(carro)
        carros.push(carro)

        marca.className =
          'flex -translate-y-1.5 items-center gap-1.5 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 shadow-lg ring-1 ring-black/20'
        marca.innerHTML =
          `<span class="size-2 flex-none rounded-full ring-2 ring-white/80" style="background:${COR_SITUACAO[vaga.situacao]}"></span>` +
          `<b class="fonte-display text-[11px] font-bold tracking-wide text-zinc-900">${os.placa}</b>` +
          `<span class="text-[10px] font-semibold text-stone-500">${vaga.nome}</span>`
        const r = new CSS2DObject(marca)
        r.position.set(0, vaga.tipo === 'ELEVADOR' ? 3.4 : 2, 0)
        carro.add(r)
      } else {
        marca.className =
          'whitespace-nowrap rounded-md bg-white/70 px-1.5 py-0.5 fonte-display text-[10px] font-semibold uppercase tracking-widest text-stone-600 shadow'
        marca.textContent = `${vaga.nome} · livre`
        marca.style.pointerEvents = 'auto'
        marca.style.cursor = 'pointer'
        marca.onclick = () => onAgendar(vaga.id)
        const r = new CSS2DObject(marca)
        r.position.set(g.x, 0.9, g.z)
        mundo.add(r)
      }
    }

    t.scene.add(mundo)
    t.mundo = mundo
    t.carros = carros

    // a sombra acompanha o tamanho do barracao, senao ela corta
    const raio = Math.max(med.largura, med.comprimento) * 0.9
    Object.assign(t.sol.shadow.camera, {
      left: -raio, right: raio, top: raio, bottom: -raio, near: 1, far: raio * 3,
    })
    t.sol.shadow.camera.updateProjectionMatrix()
    t.renderer.shadowMap.needsUpdate = true

    t.enquadrar(vista)
    // `vista` de proposito fora: trocar de camera nao reconstroi a cena
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vagas, cfg, onAgendar])

  // ------------------------------------------------ clicar num carro
  useEffect(() => {
    const t = tres.current
    if (!t) return
    const tela = t.renderer.domElement
    const raycaster = new THREE.Raycaster()
    const ponteiro = new THREE.Vector2()
    let arrastou = false

    const achar = (e: PointerEvent) => {
      const r = tela.getBoundingClientRect()
      ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ponteiro, t.camera)
      const hit = raycaster.intersectObjects(t.carros, true)[0]
      if (!hit) return null
      let o: THREE.Object3D | null = hit.object
      while (o && !o.userData.osId) o = o.parent
      return o
    }

    const aoDescer = () => { arrastou = false }
    const aoMover = (e: PointerEvent) => {
      if (e.buttons !== 0) { arrastou = true; return }
      tela.style.cursor = achar(e) ? 'pointer' : 'default'
    }
    const aoSoltar = (e: PointerEvent) => {
      if (arrastou) return
      const o = achar(e)
      if (o) onAbrir(o.userData.osId as string)
    }

    tela.addEventListener('pointerdown', aoDescer)
    tela.addEventListener('pointermove', aoMover)
    tela.addEventListener('pointerup', aoSoltar)
    return () => {
      tela.removeEventListener('pointerdown', aoDescer)
      tela.removeEventListener('pointermove', aoMover)
      tela.removeEventListener('pointerup', aoSoltar)
    }
  }, [onAbrir])

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden rounded-lg bg-[#9fc0da]">
      <div ref={caixa} className="absolute inset-0" />
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        {VISTAS.map((v) => (
          <button
            key={v.chave}
            type="button"
            onClick={() => { setVista(v.chave); tres.current?.enquadrar(v.chave) }}
            className={cx(
              'h-11 rounded-md px-3.5 fonte-display text-xs font-bold tracking-wide shadow transition',
              vista === v.chave
                ? 'bg-faixa sobre-destaque'
                : 'bg-white/85 text-stone-700 hover:bg-white',
            )}
          >
            {v.rotulo}
          </button>
        ))}
      </div>
      <p className="absolute bottom-3 left-3 z-10 rounded-md bg-zinc-900/75 px-3 py-1.5 text-xs font-medium text-zinc-100">
        Clique num carro para abrir a OS · arraste para girar · roda do mouse aproxima
      </p>
    </div>
  )
}
