import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarPlus, Loader2, Lock, LockOpen, Package, Plus } from 'lucide-react'
import { api } from '../../api/client'
import type { ItemFila, Patio as PatioTipo, SituacaoVaga, Vaga } from '../../types'
import { useAuth } from '../../lib/auth'
import { CHAVES, useConfig } from '../../lib/config'
import { Botao, Carregando, Vazio, cx, useAviso, useTelaLarga } from '../../components/ui'
import {
  CarroTopo,
  CORES_SITUACAO,
  Led,
  MarcaElevador,
  Placa,
  SeloElevador,
} from '../../components/oficina'
import { dataCurta, horas } from '../../lib/format'
import PainelAgendar from './PainelAgendar'

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/**
 * Dois tipos de arrasto convivem no pátio, e confundi-los é o jeito mais fácil
 * de quebrar esta tela: arrastar um CARRO agenda a OS; arrastar uma VAGA move
 * a planta. Tipos de dataTransfer diferentes + exclusão mútua pelo modo de
 * edição — as duas coisas, porque uma só não basta.
 */
const TIPO_CARRO = 'text/plain'
const TIPO_VAGA = 'application/x-delander-vaga'

type Densidade = 'detalhado' | 'visual'

/** Preferência de quem olha, não regra da oficina: fica no navegador. */
function densidadeGuardada(): Densidade {
  try {
    return localStorage.getItem('delander.patio.densidade') === 'visual' ? 'visual' : 'detalhado'
  } catch {
    return 'detalhado'
  }
}

interface Posicao {
  coluna: number
  linha: number
  largura: number
  altura: number
}

/**
 * Onde cada vaga cai na planta.
 *
 * Sem layout salvo, devolve posições em sequência — reproduzindo exatamente o
 * arranjo automático de hoje. É o que faz "abrir o sistema e não notar
 * diferença" ser verdade para quem nunca tocar no cadeado.
 */
function posicoesIniciais(vagas: Vaga[], colunas: number): Record<string, Posicao> {
  const mapa: Record<string, Posicao> = {}
  vagas.forEach((v, i) => {
    mapa[v.id] = {
      coluna: v.layoutColuna ?? (i % colunas) + 1,
      linha: v.layoutLinha ?? Math.floor(i / colunas) + 1,
      largura: v.layoutLargura || 1,
      altura: v.layoutAltura || 1,
    }
  })
  return mapa
}

/** Alguma vaga ocuparia a mesma célula? A tela evita antes de deixar soltar. */
function conflita(
  posicoes: Record<string, Posicao>,
  idIgnorado: string,
  alvo: Posicao,
  colunas: number,
): boolean {
  if (alvo.coluna < 1 || alvo.linha < 1 || alvo.coluna + alvo.largura - 1 > colunas) {
    return true
  }
  return Object.entries(posicoes).some(([id, p]) => {
    if (id === idIgnorado) return false
    const cruzaColuna = alvo.coluna < p.coluna + p.largura && p.coluna < alvo.coluna + alvo.largura
    const cruzaLinha = alvo.linha < p.linha + p.altura && p.linha < alvo.linha + alvo.altura
    return cruzaColuna && cruzaLinha
  })
}

export default function Patio() {
  const { gerencia } = useAuth()
  const { flag, numero, texto } = useConfig()
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const navegar = useNavigate()

  const [vagaSobre, setVagaSobre] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [agendar, setAgendar] = useState<{ vagaId?: string; data?: string } | null>(null)

  const [densidade, setDensidade] = useState<Densidade>(densidadeGuardada)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [posicoes, setPosicoes] = useState<Record<string, Posicao>>({})
  const [vagaArrastada, setVagaArrastada] = useState<string | null>(null)
  const grade = useRef<HTMLDivElement>(null)

  const telaLarga = useTelaLarga()
  const podeAgendar = (gerencia || flag(CHAVES.mecanicoRealoca)) && !modoEdicao
  const colunas = numero(CHAVES.patioColunas, 6) || 6

  const consulta = useQuery({
    queryKey: ['patio'],
    queryFn: () => api<PatioTipo>('/patio'),
    // Enquanto o cadeado esta aberto o patio nao recarrega sozinho: um refetch
    // no meio da arrumacao apagaria o trabalho de quem esta mexendo.
    refetchInterval: modoEdicao ? false : 30_000,
  })

  const alocar = useMutation({
    mutationFn: ({ osId, boxId, data }: { osId: string; boxId: string; data: string }) =>
      api(`/os/${osId}/alocar`, { metodo: 'POST', corpo: { dataAgendada: data, boxId } }),
    onSuccess: () => {
      avisar('Carro colocado na vaga.')
      recarregar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  /** Subir o carro aloca a OS naquela vaga no backend — nada a fazer aqui. */
  const subir = useMutation({
    mutationFn: ({ osId, boxId }: { osId: string; boxId: string }) =>
      api(`/os/${osId}/elevador/subir`, { metodo: 'POST', corpo: { boxId } }),
    onSuccess: () => {
      avisar('Carro no elevador.')
      recarregar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const descer = useMutation({
    mutationFn: (osId: string) => api(`/os/${osId}/elevador/descer`, { metodo: 'POST' }),
    onSuccess: () => {
      avisar('Carro desceu do elevador.')
      recarregar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const salvarLayout = useMutation({
    mutationFn: (vagas: { boxId: string; coluna: number; linha: number; largura: number; altura: number }[]) =>
      api('/boxes/layout', { metodo: 'PUT', corpo: { vagas } }),
    onSuccess: () => {
      avisar('Planta salva.')
      setModoEdicao(false)
      recarregar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const limparLayout = useMutation({
    mutationFn: () => api('/boxes/layout', { metodo: 'DELETE' }),
    onSuccess: () => {
      avisar('Planta voltou ao automático.')
      setModoEdicao(false)
      setPosicoes({})
      recarregar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['patio'] })
    void queryClient.invalidateQueries({ queryKey: ['boxes'] })
    void queryClient.invalidateQueries({ queryKey: ['quadro'] })
    void queryClient.invalidateQueries({ queryKey: ['fila'] })
    void queryClient.invalidateQueries({ queryKey: ['radar'] })
    void queryClient.invalidateQueries({ queryKey: ['elevadores'] })
  }

  if (consulta.isLoading) return <Carregando texto="Abrindo a oficina..." />
  if (consulta.isError) {
    return (
      <div className="p-4">
        <Vazio
          titulo="Não foi possível carregar o pátio"
          descricao={(consulta.error as Error).message}
          acao={<Botao onClick={() => void consulta.refetch()}>Tentar de novo</Botao>}
        />
      </div>
    )
  }

  const patio = consulta.data!
  const lotada = patio.vagasLivres === 0

  /**
   * Soltar numa vaga ocupada agenda para o dia em que ela libera.
   * Vaga reservada esta livre hoje, entao entra hoje — quem manda e a
   * ocupacao de agora, nao a reserva futura.
   */
  const soltarNaVaga = (vaga: Vaga, osId: string) => {
    if (!podeAgendar || !osId) return
    const ocupadaAgora = Boolean(vaga.ocupante) && vaga.situacao !== 'RESERVADO'
    const data = ocupadaAgora ? vaga.liberaEm : (patio.proximaVagaLivre ?? hojeIso())
    alocar.mutate({ osId, boxId: vaga.id, data: data ?? hojeIso() })
  }

  // ------------------------------------------------------------- planta

  /**
   * A planta só é explícita quando alguém arrumou (ou está arrumando) E a tela
   * comporta. No celular, e para quem nunca abriu o cadeado, continua a grade
   * automática de sempre.
   */
  const temLayoutSalvo = patio.vagas.some((v) => v.layoutColuna != null)
  const plantaArrumada = telaLarga && (temLayoutSalvo || modoEdicao)

  // As posições vivem no estado enquanto se arruma; fora disso saem dos dados.
  const posicoesAtuais = Object.keys(posicoes).length > 0 ? posicoes : posicoesIniciais(patio.vagas, colunas)

  const larguraCelula = () => {
    const caixa = grade.current?.getBoundingClientRect()
    if (!caixa) return 210
    // gap-3 = 12px entre colunas
    return (caixa.width - (colunas - 1) * 12) / colunas
  }

  /** Solta a vaga arrastada na célula sob o cursor. */
  const soltarVaga = (e: React.DragEvent) => {
    if (!modoEdicao) return
    const boxId = e.dataTransfer.getData(TIPO_VAGA)
    if (!boxId) return
    e.preventDefault()

    const caixa = grade.current?.getBoundingClientRect()
    const atual = posicoesAtuais[boxId]
    if (!caixa || !atual) return

    const largura = larguraCelula()
    const altura = 248 + 12
    const coluna = Math.min(
      Math.max(Math.floor((e.clientX - caixa.left) / (largura + 12)) + 1, 1),
      colunas,
    )
    const linha = Math.max(Math.floor((e.clientY - caixa.top) / altura) + 1, 1)

    const alvo = { ...atual, coluna, linha }
    if (conflita(posicoesAtuais, boxId, alvo, colunas)) {
      avisar('Já tem uma vaga nesse lugar.', 'erro')
      setVagaArrastada(null)
      return
    }
    setPosicoes({ ...posicoesAtuais, [boxId]: alvo })
    setVagaArrastada(null)
  }

  const redimensionar = (boxId: string, largura: number, altura: number) => {
    const atual = posicoesAtuais[boxId]
    if (!atual) return
    const alvo = { ...atual, largura, altura }
    if (conflita(posicoesAtuais, boxId, alvo, colunas)) return
    setPosicoes({ ...posicoesAtuais, [boxId]: alvo })
  }

  const abrirCadeado = () => {
    setPosicoes(posicoesIniciais(patio.vagas, colunas))
    setModoEdicao(true)
  }

  const guardarPlanta = () =>
    salvarLayout.mutate(
      Object.entries(posicoesAtuais).map(([boxId, p]) => ({
        boxId,
        coluna: p.coluna,
        linha: p.linha,
        largura: p.largura,
        altura: p.altura,
      })),
    )

  return (
    <div className="flex min-h-full flex-col">
      {/* ============================ chapa do topo ============================ */}
      <header className="chapa sticky top-0 z-20 border-b-4 border-aco-900">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="lg:hidden">
            <h1 className="fonte-display text-lg font-extrabold uppercase tracking-wide text-white">
              {texto(CHAVES.nomeOficina, 'Delander')}
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-zinc-400">Pátio agora</p>
          </div>
          <p className="hidden text-[11px] uppercase tracking-[0.2em] text-zinc-400 lg:block">
            Pátio agora
          </p>

          <div className="flex items-center gap-5">
            <Indicador
              valor={`${patio.vagasLivres}/${patio.vagasTotal}`}
              rotulo="vagas livres"
              alerta={lotada}
            />
            <Indicador
              valor={patio.proximaVagaLivreRotulo}
              rotulo="próxima vaga"
              capitalizar
            />
            {patio.elevadores.total > 0 && (
              <Indicador
                valor={`${patio.elevadores.livresAgora}/${patio.elevadores.total}`}
                rotulo="elevadores"
                alerta={patio.elevadores.livresAgora === 0}
              />
            )}
            <Indicador valor={String(patio.fila.length)} rotulo="na fila" />
            <Indicador valor={horas(patio.backlogHoras)} rotulo="trabalho parado" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* densidade: preferência de quem olha */}
            <div className="flex overflow-hidden rounded-md ring-1 ring-white/20">
              {(['detalhado', 'visual'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDensidade(d)
                    try {
                      localStorage.setItem('delander.patio.densidade', d)
                    } catch {
                      /* modo privado: fica só nesta sessão */
                    }
                  }}
                  className={cx(
                    'fonte-display px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition',
                    densidade === d
                      ? 'bg-faixa sobre-destaque'
                      : 'text-zinc-400 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {d === 'detalhado' ? 'Detalhado' : 'Visual'}
                </button>
              ))}
            </div>

            {/* cadeado: só faz sentido em tela que comporta a planta */}
            {gerencia && telaLarga && !modoEdicao && (
              <button
                type="button"
                onClick={abrirCadeado}
                title="Arrumar a planta do pátio"
                className="rounded-md p-2 text-zinc-300 ring-1 ring-white/20 transition hover:bg-white/10 hover:text-white"
              >
                <Lock className="size-4" aria-hidden />
              </button>
            )}

            {podeAgendar && (
              <button
                type="button"
                onClick={() => setAgendar({})}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-faixa px-5 fonte-display text-sm font-extrabold uppercase tracking-wider sobre-destaque shadow-lg transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Plus className="size-5" aria-hidden />
                Agendar carro
              </button>
            )}
            {alocar.isPending && (
              <Loader2 className="size-5 animate-spin text-zinc-400" aria-hidden />
            )}
          </div>
        </div>

        {/* barra de arrumar a planta */}
        {modoEdicao && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-marca-900/40 px-4 py-2">
            <LockOpen className="size-4 flex-none text-faixa" aria-hidden />
            <p className="text-[11px] text-zinc-200">
              Arraste as vagas para arrumar a planta. Puxe o canto para esticar.
              <span className="ml-1 text-zinc-400">Agendar fica desligado enquanto arruma.</span>
            </p>
            <div className="ml-auto flex gap-2">
              <Botao
                tamanho="sm"
                variante="secundario"
                onClick={() => limparLayout.mutate()}
                carregando={limparLayout.isPending}
              >
                Voltar ao automático
              </Botao>
              <Botao
                tamanho="sm"
                variante="secundario"
                onClick={() => {
                  setPosicoes({})
                  setModoEdicao(false)
                }}
              >
                Descartar
              </Botao>
              <Botao tamanho="sm" onClick={guardarPlanta} carregando={salvarLayout.isPending}>
                Salvar planta
              </Botao>
            </div>
          </div>
        )}

        <div className="faixa-seguranca h-1.5" aria-hidden />
      </header>

      {/* ============================ piso da oficina ============================ */}
      <div className="piso flex-1 p-4">
        <div
          ref={grade}
          className={cx(
            'grid gap-3',
            !plantaArrumada && '[grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]',
          )}
          style={
            plantaArrumada
              ? { gridTemplateColumns: `repeat(${colunas}, minmax(0,1fr))`, gridAutoRows: 'minmax(248px, auto)' }
              : undefined
          }
          onDragOver={(e) => {
            // Alvo de soltar VAGA: a grade inteira, para poder largar em celula vazia.
            if (!modoEdicao || !e.dataTransfer.types.includes(TIPO_VAGA)) return
            e.preventDefault()
          }}
          onDrop={(e) => soltarVaga(e)}
        >
          {patio.vagas.map((vaga) => (
            <CelulaVaga
              key={vaga.id}
              vaga={vaga}
              densidade={densidade}
              posicao={plantaArrumada ? posicoesAtuais[vaga.id] : undefined}
              modoEdicao={modoEdicao}
              movendo={vagaArrastada === vaga.id}
              onMoverInicio={() => setVagaArrastada(vaga.id)}
              onMoverFim={() => setVagaArrastada(null)}
              onRedimensionar={(largura, altura) => redimensionar(vaga.id, largura, altura)}
              larguraCelula={larguraCelula}
              sobre={vagaSobre === vaga.id}
              arrastando={arrastando}
              podeAgendar={podeAgendar}
              onSobre={(ativo) => setVagaSobre(ativo ? vaga.id : null)}
              onSoltar={(osId) => {
                setVagaSobre(null)
                setArrastando(false)
                soltarNaVaga(vaga, osId)
              }}
              onAbrir={() =>
                // vaga reservada esta livre hoje: clicar nela agenda, nao abre a OS
                vaga.ocupante && vaga.situacao !== 'RESERVADO'
                  ? navegar(`/os/${vaga.ocupante.id}`)
                  : podeAgendar &&
                    setAgendar({
                      vagaId: vaga.id,
                      data: patio.proximaVagaLivre ?? hojeIso(),
                    })
              }
              onSubir={() => {
                // quem sobe: o carro que ja esta na vaga, senao o primeiro da fila
                const alvo =
                  (vaga.ocupante && vaga.situacao !== 'RESERVADO' ? vaga.ocupante.id : null) ??
                  patio.elevadores.itens[0]?.os.id
                if (!alvo) {
                  avisar('Nenhum carro esperando elevador.', 'erro')
                  return
                }
                subir.mutate({ osId: alvo, boxId: vaga.id })
              }}
              onDescer={() => {
                if (vaga.reserva) descer.mutate(vaga.reserva.osId)
              }}
            />
          ))}
        </div>

        {patio.elevadores.itens.length > 0 && (
          <section className="mt-4 rounded-lg bg-white/70 p-3 ring-1 ring-amber-400/60">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="fonte-display text-xs font-bold uppercase tracking-widest text-stone-600">
                Fila do elevador ({patio.elevadores.itens.length})
              </h2>
              <span className="text-[11px] text-stone-500">
                um carro por elevador ·{' '}
                <span className="font-semibold capitalize text-stone-700">
                  {patio.elevadores.proximoLivreRotulo}
                </span>
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {patio.elevadores.itens.map((item) => (
                <button
                  key={item.os.id}
                  type="button"
                  draggable={podeAgendar}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TIPO_CARRO, item.os.id)
                    setArrastando(true)
                  }}
                  onDragEnd={() => setArrastando(false)}
                  onClick={() => navegar(`/os/${item.os.id}`)}
                  className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 ring-1 ring-stone-300 transition hover:ring-amber-500"
                >
                  <span className="fonte-display grid size-5 flex-none place-items-center rounded bg-amber-400 text-[10px] font-extrabold text-aco-900">
                    {item.posicao}
                  </span>
                  <CarroTopo cor={item.os.cor} largura={16} titulo={item.os.veiculo} />
                  <span className="flex flex-col items-start gap-0.5">
                    <Placa placa={item.os.placa} tamanho="sm" />
                    <span className="text-[10px] leading-none text-stone-500">
                      {horas(item.horasPrevistas)} ·{' '}
                      <span className="capitalize">{item.rotulo}</span>
                      {item.boxSugeridoNome ? ` (${item.boxSugeridoNome})` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {patio.semVaga.length > 0 && (
          <section className="mt-4 rounded-lg bg-white/70 p-3 ring-1 ring-stone-400/50">
            <h2 className="fonte-display text-xs font-bold uppercase tracking-widest text-stone-600">
              Agendados, ainda fora da planta ({patio.semVaga.length})
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {patio.semVaga.map((os) => (
                <button
                  key={os.id}
                  type="button"
                  draggable={podeAgendar}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TIPO_CARRO, os.id)
                    setArrastando(true)
                  }}
                  onDragEnd={() => setArrastando(false)}
                  onClick={() => navegar(`/os/${os.id}`)}
                  className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 ring-1 ring-stone-300 hover:ring-marca-500"
                >
                  <CarroTopo cor={os.cor} largura={16} titulo={os.veiculo} />
                  <span className="flex flex-col items-start gap-0.5">
                    <Placa placa={os.placa} tamanho="sm" />
                    {/* Ter box marcado e nao estar na planta significa que a vaga
                        ainda esta com outro carro — dizer "sem vaga" seria mentira. */}
                    <span className="text-[10px] leading-none text-stone-500">
                      {os.boxNome
                        ? `${os.boxNome} · ${dataCurta(os.dataAgendada)}`
                        : `sem vaga · ${dataCurta(os.dataAgendada)}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ============================ portão / fila ============================ */}
      <section className="border-t-4 border-aco-900 bg-aco-800">
        <div className="faixa-seguranca h-1.5" aria-hidden />
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="fonte-display text-sm font-bold uppercase tracking-widest text-zinc-200">
              Portão · fila de espera
            </h2>
            <span className="rounded bg-zinc-700 px-2 py-0.5 text-[11px] font-semibold text-zinc-200">
              {patio.fila.length}
            </span>
            {podeAgendar && patio.fila.length > 0 && (
              <span className="text-[11px] text-zinc-400">
                arraste um carro para uma vaga para agendar
              </span>
            )}
          </div>

          {patio.fila.length === 0 ? (
            <p className="py-3 text-sm text-zinc-500">
              Nenhum carro esperando vaga. Todo mundo que entrou já tem dia marcado.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto rolagem-suave pb-1">
              {patio.fila.map((item) => (
                <CarroNaFila
                  key={item.os.id}
                  item={item}
                  arrastavel={podeAgendar}
                  onArrastar={() => setArrastando(true)}
                  onSoltar={() => setArrastando(false)}
                  onAbrir={() => navegar(`/os/${item.os.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {agendar && (
        <PainelAgendar
          vagaIdInicial={agendar.vagaId}
          dataInicial={agendar.data}
          vagas={patio.vagas}
          resumo={patio}
          onFechar={() => setAgendar(null)}
          onAgendado={(placa) => {
            setAgendar(null)
            avisar(`${placa} agendado.`)
            recarregar()
          }}
        />
      )}
    </div>
  )
}

// ==================================================================== peças

function Indicador({
  valor,
  rotulo,
  alerta,
  capitalizar,
}: {
  valor: string
  rotulo: string
  alerta?: boolean
  capitalizar?: boolean
}) {
  return (
    <div>
      <p
        className={cx(
          'fonte-display text-xl font-bold leading-none',
          capitalizar && 'capitalize',
          alerta ? 'text-red-400' : 'text-white',
        )}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-zinc-400">{rotulo}</p>
    </div>
  )
}

function CelulaVaga({
  vaga,
  densidade,
  posicao,
  modoEdicao,
  movendo,
  onMoverInicio,
  onMoverFim,
  onRedimensionar,
  larguraCelula,
  sobre,
  arrastando,
  podeAgendar,
  onSobre,
  onSoltar,
  onAbrir,
  onSubir,
  onDescer,
}: {
  vaga: Vaga
  densidade: Densidade
  posicao?: Posicao
  modoEdicao: boolean
  movendo: boolean
  onMoverInicio: () => void
  onMoverFim: () => void
  onRedimensionar: (largura: number, altura: number) => void
  larguraCelula: () => number
  sobre: boolean
  arrastando: boolean
  podeAgendar: boolean
  onSobre: (ativo: boolean) => void
  onSoltar: (osId: string) => void
  onAbrir: () => void
  onSubir: () => void
  onDescer: () => void
}) {
  const visual = densidade === 'visual'
  const situacao = vaga.situacao as SituacaoVaga
  const reservada = situacao === 'RESERVADO'
  const noElevador = vaga.reserva?.status === 'EM_USO'
  // Reservada nao e ocupada: o carro so chega depois, entao a vaga esta livre hoje.
  const os = reservada ? null : vaga.ocupante
  const futuro = reservada ? vaga.ocupante : null
  const cores = CORES_SITUACAO[situacao]
  const critico = os?.alertas.some((a) => a.severidade === 'ALTA') ?? false
  const atrasado = vaga.liberaEmRotulo === 'atrasado'
  const percentual = os && os.horasEstimadas > 0 ? os.percentualExecutado : 0

  // Só aceita CARRO, e só fora do modo de edição. No modo de edição quem
  // recebe o drop é a grade, com o outro tipo de dataTransfer.
  const alvo = {
    onDragOver: (e: React.DragEvent) => {
      if (!podeAgendar || modoEdicao || !e.dataTransfer.types.includes(TIPO_CARRO)) return
      e.preventDefault()
      onSobre(true)
    },
    onDragLeave: () => onSobre(false),
    onDrop: (e: React.DragEvent) => {
      if (modoEdicao || !e.dataTransfer.types.includes(TIPO_CARRO)) return
      e.preventDefault()
      onSoltar(e.dataTransfer.getData(TIPO_CARRO))
    },
  }

  /** Puxador de esticar. Pointer Events funcionam igual em mouse e toque. */
  const puxar = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const partida = { x: e.clientX, y: e.clientY }
    const inicial = { largura: posicao?.largura ?? 1, altura: posicao?.altura ?? 1 }
    const celula = larguraCelula()
    const alturaCelula = 248 + 12
    const elemento = e.currentTarget as HTMLElement
    elemento.setPointerCapture(e.pointerId)

    const mover = (ev: PointerEvent) => {
      const passosX = Math.round((ev.clientX - partida.x) / (celula + 12))
      const passosY = Math.round((ev.clientY - partida.y) / alturaCelula)
      onRedimensionar(
        Math.min(Math.max(inicial.largura + passosX, 1), 6),
        Math.min(Math.max(inicial.altura + passosY, 1), 3),
      )
    }
    const soltar = () => {
      elemento.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  return (
    // div, nao button: o elevador precisa de um botao proprio aqui dentro, e
    // botao dentro de botao e HTML invalido e quebra a navegacao por teclado.
    // A area de clique principal vira uma camada por baixo do conteudo.
    <div
      {...alvo}
      draggable={modoEdicao}
      onDragStart={(e) => {
        if (!modoEdicao) return
        e.dataTransfer.setData(TIPO_VAGA, vaga.id)
        e.dataTransfer.effectAllowed = 'move'
        onMoverInicio()
      }}
      onDragEnd={onMoverFim}
      style={
        posicao
          ? {
              gridColumn: `${posicao.coluna} / span ${posicao.largura}`,
              gridRow: `${posicao.linha} / span ${posicao.altura}`,
            }
          : undefined
      }
      className={cx(
        'group relative flex flex-col overflow-hidden rounded-lg text-left transition',
        'min-h-[248px]',
        // a borda carrega a SITUACAO (azul andando, ambar parado, verde pronto).
        // alerta critico entra como tarja vermelha na lateral, para nao apagar
        // a leitura de estado deixando todo card igual.
        os
          ? cx('border-2 bg-white shadow-md hover:shadow-lg', cores.borda)
          : 'vaga-livre bg-stone-100/60 hover:bg-stone-100',
        // Elevador ganha um anel amarelo POR FORA da borda de situacao: o anel
        // diz "isto e equipamento", a borda continua dizendo o estado.
        vaga.tipo === 'ELEVADOR' && 'ring-2 ring-faixa ring-offset-1 ring-offset-piso',
        sobre && 'vaga-alvo',
        arrastando && !sobre && 'ring-2 ring-marca-500/30',
        modoEdicao && 'cursor-move ring-2 ring-dashed ring-marca-500',
        movendo && 'opacity-40',
      )}
    >
      <button
        type="button"
        onClick={onAbrir}
        disabled={modoEdicao}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-500"
        aria-label={os ? `Abrir ${os.placa} no ${vaga.nome}` : `Agendar carro no ${vaga.nome}`}
      />

      {modoEdicao && (
        <span
          onPointerDown={puxar}
          title="Puxe para esticar"
          className="absolute bottom-0 right-0 z-30 size-5 cursor-nwse-resize touch-none rounded-tl-md bg-marca-600 shadow"
          aria-hidden
        />
      )}

      {critico && (
        <span
          className="absolute inset-y-0 left-0 w-1.5 bg-red-600"
          aria-hidden
          title="Precisa de ação"
        />
      )}
      {/* cabeçalho da vaga */}
      <div
        className={cx(
          'pointer-events-none relative z-10 flex items-center gap-2 px-2.5 py-1.5',
          vaga.tipo === 'ELEVADOR'
            ? 'bg-faixa sobre-destaque'
            : os
              ? 'bg-aco-800 text-white'
              : 'bg-stone-300/70 text-stone-700',
        )}
      >
        <span className="fonte-display truncate text-[11px] font-bold uppercase tracking-widest">
          {vaga.nome}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {os?.precisaElevador && (
            <SeloElevador estado={noElevador ? 'NO_ELEVADOR' : 'PRECISA'} />
          )}
          <Led situacao={situacao} pulsando={situacao === 'EM_EXECUCAO'} />
        </span>
      </div>

      {/* piso da vaga com o carro */}
      <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-center py-2">
        {vaga.tipo === 'ELEVADOR' && (
          <MarcaElevador
            comCarro={noElevador}
            className="absolute inset-0 m-auto h-full w-[78%] text-stone-600"
          />
        )}

        {os ? (
          <CarroTopo
            cor={os.cor}
            largura={visual ? 74 : 54}
            titulo={` `}
          />
        ) : futuro ? (
          <span className="flex flex-col items-center gap-1 opacity-45">
            <CarroTopo cor={futuro.cor} largura={44} titulo={`${futuro.veiculo} (chega depois)`} />
          </span>
        ) : (
          <span className="fonte-display flex flex-col items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-stone-500">
            <CalendarPlus className="size-6" aria-hidden />
            vaga livre
            {podeAgendar && (
              <span className="text-[10px] font-medium normal-case tracking-normal text-stone-400">
                clique para agendar
              </span>
            )}
          </span>
        )}
      </div>

      {futuro && (
        <div className="pointer-events-none relative z-10 space-y-0.5 px-2.5 pb-2 text-center">
          <Placa placa={futuro.placa} tamanho="sm" />
          <p className="truncate text-[10px] text-stone-500">{futuro.veiculo}</p>
        </div>
      )}

      {/* identificação e situação */}
      {os && (
        <div className="pointer-events-none relative z-10 space-y-1 px-2.5 pb-2">
          <Placa placa={os.placa} tamanho="sm" />
          {!visual && <p className="truncate text-[11px] text-slate-600">{os.veiculo}</p>}

          {/* quem está com o carro: a informação que o dono mais procura */}
          {os.mecanicos.length > 0 ? (
            <div
              className="flex items-center gap-1.5 rounded-md bg-slate-100 px-1.5 py-1"
              title={os.mecanicos.join(", ")}
            >
              <span
                className="fonte-display grid size-6 flex-none place-items-center rounded-full text-[10px] font-extrabold text-white"
                style={{ backgroundColor: cores.led }}
                aria-hidden
              >
                {iniciais(os.mecanicos[0])}
              </span>
              {/* no modo visual só o avatar; o nome fica no title, e o card
                  inteiro abre a OS onde está tudo */}
              {!visual && (
                <span className="fonte-display min-w-0 flex-1 truncate text-[12px] font-bold uppercase tracking-wide text-slate-900">
                  {os.mecanicos[0]}
                </span>
              )}
              {os.mecanicos.length > 1 && (
                <span className="flex-none text-[10px] font-semibold text-slate-500">
                  +{os.mecanicos.length - 1}
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-md bg-amber-50 px-1.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
              sem mecânico
            </div>
          )}

          {!visual && (
            <p className={cx('truncate text-[11px] font-semibold', cores.texto)}>
              {vaga.situacaoRotulo}
            </p>
          )}

          {!visual && os.horasEstimadas > 0 && (
            <div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(percentual, 100)}%`,
                    backgroundColor: percentual > 110 ? '#dc2626' : cores.led,
                  }}
                />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {horas(os.horasTrabalhadas)} de {horas(os.horasEstimadas)}
              </p>
            </div>
          )}

          {critico && (
            <p className="flex items-start gap-1 text-[10px] leading-tight text-red-600">
              <AlertTriangle className="mt-px size-3 flex-none" aria-hidden />
              {os.alertas.find((a) => a.severidade === 'ALTA')?.texto}
            </p>
          )}

          {/* Peça, no card e não só dentro da OS. É o motivo número um de
              carro parado, e os dois estados pedem coisas opostas: esperando
              quer telefone para o fornecedor, chegou quer mecânico. Enquanto
              isso só aparecia dentro da OS, o carro cuja peça chegou na terça
              ficava parado até alguém lembrar de abrir a tela. */}
          {os.pecas !== 'NENHUMA' && (
            <p
              className={cx(
                'flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold leading-tight',
                os.pecas === 'ESPERANDO'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-emerald-100 text-emerald-800',
              )}
            >
              <Package className="size-3 flex-none" aria-hidden />
              {os.pecas === 'ESPERANDO' ? 'Esperando peça' : 'Peça chegou — pode trabalhar'}
            </p>
          )}
        </div>
      )}

      {/* elevador: o que falta para descer, e a ação de subir/descer */}
      {vaga.tipo === 'ELEVADOR' && podeAgendar && (
        <div className="pointer-events-none relative z-10 px-2 pb-1.5">
          {noElevador ? (
            <div className="flex items-center gap-1.5">
              <span
                className={cx(
                  'fonte-display flex-1 truncate rounded px-1.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                  (vaga.reserva?.minutosRestantes ?? 0) < 0
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white',
                )}
              >
                {vaga.reserva?.rotulo}
              </span>
              <button
                type="button"
                onClick={onDescer}
                className="pointer-events-auto fonte-display flex-none rounded bg-aco-800 px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white transition hover:bg-aco-700"
              >
                Descer
              </button>
            </div>
          ) : vaga.reserva ? (
            <span className="fonte-display block truncate rounded bg-slate-200 px-1.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
              {vaga.reserva.placa} · {vaga.reserva.rotulo}
            </span>
          ) : (
            <button
              type="button"
              onClick={onSubir}
              className="pointer-events-auto fonte-display w-full rounded bg-faixa px-2 py-1 text-[11px] font-extrabold uppercase tracking-wider sobre-destaque transition hover:brightness-110"
            >
              Subir carro
            </button>
          )}
        </div>
      )}

      {/* rodapé: quando libera */}
      <div
        className={cx(
          'fonte-display pointer-events-none relative z-10 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider',
          !os
            ? 'bg-stone-200/70 text-stone-600'
            : atrasado
              ? 'bg-red-600 text-white'
              : 'bg-slate-100 text-slate-700',
        )}
      >
        {futuro ? (
          <span className="capitalize">livre hoje · {vaga.liberaEmRotulo}</span>
        ) : !os ? (
          'disponível agora'
        ) : atrasado ? (
          'previsão vencida'
        ) : (
          <>
            libera <span className="capitalize text-slate-900">{vaga.liberaEmRotulo}</span>
          </>
        )}
      </div>
    </div>
  )
}

function CarroNaFila({
  item,
  arrastavel,
  onArrastar,
  onSoltar,
  onAbrir,
}: {
  item: ItemFila
  arrastavel: boolean
  onArrastar: () => void
  onSoltar: () => void
  onAbrir: () => void
}) {
  return (
    <button
      type="button"
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO_CARRO, item.os.id)
        e.dataTransfer.effectAllowed = 'move'
        onArrastar()
      }}
      onDragEnd={onSoltar}
      onClick={onAbrir}
      title={
        arrastavel
          ? 'Arraste para uma vaga para agendar'
          : `Entra ${item.entradaPrevistaRotulo}`
      }
      className={cx(
        'flex w-[168px] flex-none items-center gap-2 rounded-lg bg-zinc-900/60 p-2 text-left ring-1 ring-zinc-700 transition hover:ring-faixa',
        arrastavel && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <span className="fonte-display grid size-6 flex-none place-items-center rounded bg-faixa text-[11px] font-extrabold sobre-destaque">
        {item.posicao}
      </span>
      <CarroTopo cor={item.os.cor} largura={22} titulo={item.os.veiculo} />
      <span className="min-w-0 flex-1">
        <Placa placa={item.os.placa} tamanho="sm" />
        <span className="mt-0.5 block truncate text-[10px] capitalize text-zinc-400">
          entra {item.entradaPrevistaRotulo}
        </span>
      </span>
    </button>
  )
}
