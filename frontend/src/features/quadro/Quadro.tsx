import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clock, Inbox, LayoutGrid, Loader2 } from 'lucide-react'
import { api } from '../../api/client'
import type { DiaQuadro, Quadro as QuadroTipo } from '../../types'
import { useAuth } from '../../lib/auth'
import { CHAVES, useConfig } from '../../lib/config'
import { Botao, Carregando, Cartao, Etiqueta, Selecao, Vazio, cx, useAviso } from '../../components/ui'
import { corSemaforo, dataCurta, horas, textoSemaforo } from '../../lib/format'
import CardOs from './CardOs'

function segundaDaSemana(base = new Date()): string {
  const d = new Date(base)
  const diferenca = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diferenca)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a, m - 1, d + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

export default function Quadro() {
  const { gerencia } = useAuth()
  const { flag } = useConfig()
  const avisar = useAviso()
  const queryClient = useQueryClient()

  const [inicio, setInicio] = useState(() => segundaDaSemana())
  const [filtroMecanico, setFiltroMecanico] = useState('')
  const [diaSobre, setDiaSobre] = useState<string | null>(null)

  const podeArrastar = gerencia || flag(CHAVES.mecanicoRealoca)

  const consulta = useQuery({
    queryKey: ['quadro', inicio],
    queryFn: () => api<QuadroTipo>(`/quadro?inicio=${inicio}&dias=7`),
  })

  const alocar = useMutation({
    mutationFn: ({ osId, data }: { osId: string; data: string | null }) =>
      api(`/os/${osId}/alocar`, { metodo: 'POST', corpo: { dataAgendada: data } }),
    onSuccess: () => {
      avisar('Agenda atualizada.')
      void queryClient.invalidateQueries({ queryKey: ['quadro'] })
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const mecanicos = useMemo(() => {
    const nomes = new Set<string>()
    consulta.data?.dias.forEach((dia) =>
      dia.ordens.forEach((os) => os.mecanicos.forEach((m) => nomes.add(m))),
    )
    return [...nomes].sort()
  }, [consulta.data])

  const filtrar = (dia: DiaQuadro) =>
    filtroMecanico ? dia.ordens.filter((os) => os.mecanicos.includes(filtroMecanico)) : dia.ordens

  if (consulta.isLoading) return <Carregando texto="Montando o quadro da semana..." />
  if (consulta.isError) {
    return (
      <div className="p-4">
        <Vazio
          titulo="Não foi possível carregar o quadro"
          descricao={(consulta.error as Error).message}
          acao={<Botao onClick={() => void consulta.refetch()}>Tentar novamente</Botao>}
        />
      </div>
    )
  }

  const quadro = consulta.data!

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---------------- cabecalho ---------------- */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => setInicio(somarDias(inicio, -7))}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Botao>
            <Botao variante="secundario" tamanho="sm" onClick={() => setInicio(segundaDaSemana())}>
              Hoje
            </Botao>
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => setInicio(somarDias(inicio, 7))}
              aria-label="Próxima semana"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Botao>
          </div>

          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <LayoutGrid className="size-4 text-slate-400" aria-hidden />
              Semana de {quadro.titulo}
            </h1>
            <p className="text-xs text-slate-500">
              {quadro.semana.carros} carro(s) alocado(s) · {horas(quadro.semana.horasAlocadas)} de{' '}
              {horas(quadro.semana.horasDisponiveis)} ·{' '}
              <span className={textoSemaforo(quadro.semana.semaforo)}>
                {quadro.semana.percentual}% da capacidade
              </span>
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {mecanicos.length > 0 && (
              <Selecao
                aria-label="Filtrar por mecânico"
                className="h-8 w-44 py-1 text-xs"
                value={filtroMecanico}
                onChange={(e) => setFiltroMecanico(e.target.value)}
              >
                <option value="">Todos os mecânicos</option>
                {mecanicos.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </Selecao>
            )}
            {alocar.isPending && <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden />}
          </div>
        </div>
      </div>

      {/* ---------------- colunas da semana ---------------- */}
      <div className="min-h-0 flex-1 overflow-x-auto rolagem-suave p-4">
        <div className="flex h-full min-h-0 gap-3" style={{ minWidth: '980px' }}>
          {/* fila sem dia definido */}
          <div className="flex w-60 flex-none flex-col">
            <div
              className={cx(
                'mb-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200',
                diaSobre === 'fila' && 'solta-aqui',
              )}
              onDragOver={(e) => {
                if (!podeArrastar) return
                e.preventDefault()
                setDiaSobre('fila')
              }}
              onDragLeave={() => setDiaSobre(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDiaSobre(null)
                const osId = e.dataTransfer.getData('text/plain')
                if (osId && podeArrastar) alocar.mutate({ osId, data: null })
              }}
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Inbox className="size-4 text-slate-400" aria-hidden />
                Fila de espera
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {quadro.fila.length} esperando · {horas(quadro.backlogHoras)} de trabalho
              </p>
            </div>

            <div
              className="flex-1 space-y-2 overflow-y-auto rolagem-suave rounded-lg bg-slate-50/60 p-1.5"
              onDragOver={(e) => podeArrastar && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const osId = e.dataTransfer.getData('text/plain')
                if (osId && podeArrastar) alocar.mutate({ osId, data: null })
              }}
            >
              {quadro.fila.length === 0 ? (
                <p className="px-2 py-6 text-center text-[11px] text-slate-400">
                  Nenhum carro esperando vaga.
                </p>
              ) : (
                quadro.fila.map((item) => (
                  <div key={item.os.id}>
                    <CardOs os={item.os} arrastavel={podeArrastar} compacto />
                    <p
                      className={cx(
                        'mt-0.5 flex items-center gap-1 px-1 text-[10px]',
                        item.entradaPrevista ? 'text-slate-500' : 'text-red-600',
                      )}
                    >
                      <span className="font-semibold">{item.posicao}º</span>
                      <span aria-hidden>·</span>
                      {item.entradaPrevista ? (
                        <>entra <span className="font-medium capitalize">{item.entradaPrevistaRotulo}</span></>
                      ) : (
                        item.entradaPrevistaRotulo
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* dias */}
          {quadro.dias.map((dia) => {
            const ordens = filtrar(dia)
            const cap = dia.capacidade
            return (
              <div key={dia.data} className="flex w-60 flex-none flex-col">
                <div
                  className={cx(
                    'mb-2 rounded-lg px-3 py-2 shadow-sm ring-1',
                    dia.hoje ? 'bg-marca-50 ring-marca-200' : 'bg-white ring-slate-200',
                    !dia.funciona && 'opacity-60',
                    diaSobre === dia.data && 'solta-aqui',
                  )}
                  onDragOver={(e) => {
                    if (!podeArrastar || !dia.funciona) return
                    e.preventDefault()
                    setDiaSobre(dia.data)
                  }}
                  onDragLeave={() => setDiaSobre(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDiaSobre(null)
                    const osId = e.dataTransfer.getData('text/plain')
                    if (osId && podeArrastar) alocar.mutate({ osId, data: dia.data })
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold capitalize text-slate-800">
                      {dia.diaSemana}{' '}
                      <span className="font-normal text-slate-500">{dataCurta(dia.data)}</span>
                    </p>
                    <span
                      className={cx('size-2.5 rounded-full', corSemaforo(cap.semaforo))}
                      title={
                        dia.funciona
                          ? `${cap.percentual}% ocupado (limite: ${cap.limitante})`
                          : 'Oficina fechada'
                      }
                      aria-hidden
                    />
                  </div>

                  {dia.funciona ? (
                    <>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={cx('h-full rounded-full', corSemaforo(cap.semaforo))}
                          style={{ width: `${Math.min(cap.percentual, 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {horas(cap.horasAlocadas)}/{horas(cap.horasDisponiveis)} ·{' '}
                        {cap.boxesTotal > 0
                          ? `${cap.boxesOcupados}/${cap.boxesTotal} boxes`
                          : `${cap.carros} carros`}
                      </p>
                      {cap.cheio && (
                        <p className="mt-1 text-[11px] font-medium text-red-600">
                          Dia cheio ({cap.limitante})
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">Oficina fechada</p>
                  )}
                </div>

                <div
                  className={cx(
                    'flex-1 space-y-2 overflow-y-auto rolagem-suave rounded-lg p-1.5',
                    dia.funciona ? 'bg-slate-50/60' : 'bg-slate-100/60',
                  )}
                  onDragOver={(e) => {
                    if (!podeArrastar || !dia.funciona) return
                    e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const osId = e.dataTransfer.getData('text/plain')
                    if (osId && podeArrastar && dia.funciona) alocar.mutate({ osId, data: dia.data })
                  }}
                >
                  {ordens.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[11px] text-slate-400">
                      {dia.funciona ? 'Dia livre' : '—'}
                    </p>
                  ) : (
                    ordens.map((os) => <CardOs key={os.id} os={os} arrastavel={podeArrastar} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ---------------- rodape ---------------- */}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden /> até 74% da capacidade
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" aria-hidden /> 75% a 99%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500" aria-hidden /> dia cheio
        </span>
        {podeArrastar && (
          <span className="ml-auto inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            Arraste um card para mudar o dia
          </span>
        )}
      </div>
    </div>
  )
}
