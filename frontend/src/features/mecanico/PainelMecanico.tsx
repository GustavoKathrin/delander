import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardCheck, PauseCircle, Play, Wrench } from 'lucide-react'
import { api } from '../../api/client'
import type { MeuServico, MotivoParada } from '../../types'
import {
  AreaTexto,
  AvisoErro,
  Botao,
  Campo,
  Carregando,
  Cartao,
  Entrada,
  Etiqueta,
  Interruptor,
  Modal,
  Selecao,
  Vazio,
  cx,
  useAviso,
  useTique,
} from '../../components/ui'
import {
  CORES_ITEM,
  CORES_PRIORIDADE,
  dataCompleta,
  decorrido,
  horas,
} from '../../lib/format'
import { CHAVES, useConfig } from '../../lib/config'
import { CarroTopo, Placa, SeloElevador } from '../../components/oficina'
import { useAuth } from '../../lib/auth'

export default function PainelMecanico() {
  const { usuario, gerencia } = useAuth()
  const { flag } = useConfig()
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const agora = useTique()

  const [iniciando, setIniciando] = useState<MeuServico | null>(null)
  const [estimativa, setEstimativa] = useState('')
  const [pausando, setPausando] = useState<MeuServico | null>(null)
  const [motivoId, setMotivoId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(true)
  const [concluindo, setConcluindo] = useState<MeuServico | null>(null)
  const [erro, setErro] = useState<string>()

  const consulta = useQuery({
    queryKey: ['meus-servicos'],
    queryFn: () => api<MeuServico[]>('/apontamentos/meus'),
    refetchInterval: 30_000,
  })

  const motivos = useQuery({
    queryKey: ['motivos', true],
    queryFn: () => api<MotivoParada[]>('/motivos-parada?apenasAtivos=true'),
  })

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ['meus-servicos'] })
    void queryClient.invalidateQueries({ queryKey: ['quadro'] })
    void queryClient.invalidateQueries({ queryKey: ['radar'] })
  }

  const iniciar = useMutation({
    mutationFn: (servico: MeuServico) =>
      api('/apontamentos/iniciar', {
        metodo: 'POST',
        corpo: {
          osItemId: servico.itemId,
          horasEstimadas: estimativa ? Number(estimativa) : undefined,
        },
      }),
    onSuccess: () => {
      recarregar()
      setIniciando(null)
      setEstimativa('')
      setErro(undefined)
      avisar('Cronômetro iniciado. Bom trabalho!')
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  const pausar = useMutation({
    mutationFn: (servico: MeuServico) =>
      api(`/apontamentos/${servico.apontamentoAbertoId}/pausar`, {
        metodo: 'POST',
        corpo: {
          motivoParadaId: motivoId || undefined,
          descricao: observacao || undefined,
          visivelCliente,
        },
      }),
    onSuccess: () => {
      recarregar()
      setPausando(null)
      setMotivoId('')
      setObservacao('')
      setErro(undefined)
      avisar('Serviço pausado e motivo registrado.')
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  const concluir = useMutation({
    mutationFn: (servico: MeuServico) =>
      api(`/apontamentos/${servico.apontamentoAbertoId}/concluir`, {
        metodo: 'POST',
        corpo: { observacao: observacao || undefined },
      }),
    onSuccess: () => {
      recarregar()
      setConcluindo(null)
      setObservacao('')
      setErro(undefined)
      avisar('Serviço concluído!')
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  const lista = consulta.data ?? []
  const rodando = useMemo(() => lista.filter((s) => s.apontamentoAbertoId), [lista])
  const pendentes = useMemo(() => lista.filter((s) => !s.apontamentoAbertoId), [lista])

  if (consulta.isLoading) return <Carregando texto="Buscando seus serviços..." />

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
      <header>
        <h1 className="text-lg font-semibold text-slate-900">
          {gerencia ? 'Serviços abertos na oficina' : `Olá, ${usuario?.nome.split(' ')[0]}`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {rodando.length > 0
            ? `${rodando.length} serviço(s) com cronômetro rodando.`
            : 'Toque em Iniciar quando começar a mexer no carro.'}
        </p>
      </header>

      {lista.length === 0 && (
        <Cartao>
          <Vazio
            icone={<ClipboardCheck className="size-10" />}
            titulo="Nenhum serviço na sua fila"
            descricao="Quando o dono atribuir um serviço a você, ele aparece aqui."
          />
        </Cartao>
      )}

      {rodando.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-blue-700">Em andamento</h2>
          {rodando.map((servico) => (
            <CartaoServico
              key={servico.itemId}
              servico={servico}
              agora={agora}
              onPausar={() => {
                setErro(undefined)
                setObservacao('')
                const padrao = motivos.data?.find((m) => m.categoria === 'PECA')
                setMotivoId(padrao?.id ?? '')
                setVisivelCliente(padrao?.visivelClientePadrao ?? true)
                setPausando(servico)
              }}
              onConcluir={() => {
                setErro(undefined)
                setObservacao('')
                setConcluindo(servico)
              }}
            />
          ))}
        </section>
      )}

      {pendentes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Na fila</h2>
          {pendentes.map((servico) => (
            <CartaoServico
              key={servico.itemId}
              servico={servico}
              agora={agora}
              onIniciar={() => {
                setErro(undefined)
                setEstimativa(String(servico.horasEstimadas ?? 1))
                setIniciando(servico)
              }}
            />
          ))}
        </section>
      )}

      {/* ---------------- iniciar ---------------- */}
      <Modal
        aberto={iniciando !== null}
        onFechar={() => setIniciando(null)}
        titulo="Começar o serviço"
        descricao={iniciando ? `${iniciando.placa} — ${iniciando.descricao}` : undefined}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setIniciando(null)}>
              Cancelar
            </Botao>
            <Botao
              tamanho="lg"
              carregando={iniciar.isPending}
              onClick={() => iniciando && iniciar.mutate(iniciando)}
            >
              <Play className="size-4" aria-hidden />
              Iniciar agora
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo
            rotulo="Quanto tempo você acha que vai gastar?"
            obrigatorio={flag(CHAVES.exigirEstimativa)}
            dica="É essa previsão que o dono usa para prometer prazo ao cliente."
          >
            <Entrada
              type="number"
              step="0.25"
              min="0.25"
              inputMode="decimal"
              className="text-lg"
              value={estimativa}
              onChange={(e) => setEstimativa(e.target.value)}
            />
          </Campo>
          <div className="flex flex-wrap gap-2">
            {[0.5, 1, 2, 3, 4, 6, 8].map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setEstimativa(String(valor))}
                className={cx(
                  'h-9 rounded-lg px-3 text-sm ring-1 transition',
                  Number(estimativa) === valor
                    ? 'bg-marca-600 text-white ring-marca-600'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                )}
              >
                {horas(valor)}
              </button>
            ))}
          </div>
          <AvisoErro mensagem={erro} />
        </div>
      </Modal>

      {/* ---------------- pausar ---------------- */}
      <Modal
        aberto={pausando !== null}
        onFechar={() => setPausando(null)}
        titulo="Pausar o serviço"
        descricao="Diga o que travou. Isso não é cobrança — é o que mostra ao dono onde está o gargalo."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setPausando(null)}>
              Voltar
            </Botao>
            <Botao
              tamanho="lg"
              carregando={pausar.isPending}
              onClick={() => pausando && pausar.mutate(pausando)}
            >
              <PauseCircle className="size-4" aria-hidden />
              Pausar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="O que travou?" obrigatorio={flag(CHAVES.exigirMotivoPausa)}>
            <div className="grid gap-2">
              {(motivos.data ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMotivoId(m.id)
                    setVisivelCliente(m.visivelClientePadrao)
                  }}
                  className={cx(
                    'flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm ring-1 transition',
                    motivoId === m.id
                      ? 'bg-marca-50 text-marca-900 ring-marca-400'
                      : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  <span>{m.nome}</span>
                  <Etiqueta className="bg-slate-100 text-slate-500 ring-slate-200">
                    {m.categoriaDescricao}
                  </Etiqueta>
                </button>
              ))}
            </div>
          </Campo>

          <Campo rotulo="Detalhe (opcional)">
            <AreaTexto
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: falta o retentor do lado direito."
            />
          </Campo>

          <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
            <Interruptor
              ativo={visivelCliente}
              rotulo="O cliente pode ver esta parada"
              onChange={setVisivelCliente}
            />
          </div>

          <AvisoErro mensagem={erro} />
        </div>
      </Modal>

      {/* ---------------- concluir ---------------- */}
      <Modal
        aberto={concluindo !== null}
        onFechar={() => setConcluindo(null)}
        titulo="Concluir o serviço"
        descricao={
          concluindo
            ? `${concluindo.descricao} — ${horas(concluindo.horasTrabalhadas)} trabalhadas de ${horas(
                concluindo.horasEstimadas,
              )} estimadas`
            : undefined
        }
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConcluindo(null)}>
              Voltar
            </Botao>
            <Botao
              variante="sucesso"
              tamanho="lg"
              carregando={concluir.isPending}
              onClick={() => concluindo && concluir.mutate(concluindo)}
            >
              <Check className="size-4" aria-hidden />
              Concluir
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="O que foi feito (opcional)">
            <AreaTexto
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: trocado kit de embreagem, atuador e rolamento."
            />
          </Campo>
          <p className="text-xs text-slate-500">
            Se este for o último serviço da OS, o carro passa para "Pronto — aguardando retirada"
            e o sistema começa a contar quantos dias ele fica parado esperando o cliente.
          </p>
          <AvisoErro mensagem={erro} />
        </div>
      </Modal>
    </div>
  )
}

function CartaoServico({
  servico,
  agora,
  onIniciar,
  onPausar,
  onConcluir,
}: {
  servico: MeuServico
  agora: number
  onIniciar?: () => void
  onPausar?: () => void
  onConcluir?: () => void
}) {
  const rodando = Boolean(servico.apontamentoAbertoId && servico.apontamentoInicio)
  const estimativa = servico.horasEstimadasInformadas ?? servico.horasEstimadas
  const decorridoTexto = rodando ? decorrido(servico.apontamentoInicio!, agora) : null
  const passouDaEstimativa =
    rodando &&
    estimativa > 0 &&
    (agora - new Date(servico.apontamentoInicio!).getTime()) / 3_600_000 > estimativa

  return (
    <Cartao className={cx('overflow-hidden', rodando && 'ring-2 ring-blue-400')}>
      <div className="p-4">
        <div className="flex flex-wrap items-start gap-2">
          <CarroTopo cor={servico.cor} largura={30} titulo={servico.veiculo} className="flex-none" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/os/${servico.osId}`} aria-label={`Abrir OS do ${servico.placa}`}>
                <Placa placa={servico.placa} tamanho="md" />
              </Link>
              {servico.precisaElevador && <SeloElevador estado="PRECISA" />}
              <span className="text-sm text-slate-500">{servico.veiculo}</span>
              {servico.prioridade !== 'NORMAL' && (
                <Etiqueta className={CORES_PRIORIDADE[servico.prioridade]}>
                  {servico.prioridade}
                </Etiqueta>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-800">{servico.descricao}</p>
            <p className="text-xs text-slate-500">
              {servico.cliente}
              {servico.box && ` · ${servico.box}`}
              {servico.previsaoEntrega && ` · entrega ${dataCompleta(servico.previsaoEntrega)}`}
            </p>
            {servico.queixa && (
              <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">"{servico.queixa}"</p>
            )}
          </div>

          <div className="flex flex-none flex-col items-end gap-1">
            <Etiqueta className={CORES_ITEM[servico.status]}>{servico.statusDescricao}</Etiqueta>
            {servico.especialidade && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: servico.especialidadeCor ?? '#64748b' }}
                  aria-hidden
                />
                {servico.especialidade}
              </span>
            )}
            {!servico.meu && servico.mecanicoNome && (
              <span className="text-[11px] text-slate-400">de {servico.mecanicoNome}</span>
            )}
          </div>
        </div>

        {/* cronometro */}
        {rodando ? (
          <div
            className={cx(
              'mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5',
              passouDaEstimativa ? 'bg-red-50 ring-1 ring-red-200' : 'bg-blue-50 ring-1 ring-blue-200',
            )}
          >
            <div>
              <p
                className={cx(
                  'font-mono text-2xl font-bold tabular-nums',
                  passouDaEstimativa ? 'text-red-700' : 'text-blue-700',
                )}
              >
                {decorridoTexto}
              </p>
              <p className="text-[11px] text-slate-500">
                previu {horas(estimativa)}
                {passouDaEstimativa && ' · já passou do previsto'}
              </p>
            </div>
            <span
              className={cx(
                'size-2.5 rounded-full pulsando',
                passouDaEstimativa ? 'bg-red-500' : 'bg-blue-500',
              )}
              aria-label="Cronômetro ativo"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            {horas(servico.horasTrabalhadas)} já apontadas de {horas(servico.horasEstimadas)}{' '}
            estimadas
          </p>
        )}
      </div>

      {/* botoes grandes: usados com a mao suja, no celular */}
      <div className="flex gap-0 border-t border-slate-200">
        {onIniciar && (
          <button
            type="button"
            onClick={onIniciar}
            className="flex flex-1 items-center justify-center gap-2 bg-marca-600 py-4 text-base font-semibold text-white transition hover:bg-marca-700"
          >
            <Play className="size-5" aria-hidden />
            Iniciar
          </button>
        )}
        {onPausar && (
          <button
            type="button"
            onClick={onPausar}
            className="flex flex-1 items-center justify-center gap-2 bg-white py-4 text-base font-semibold text-orange-700 transition hover:bg-orange-50"
          >
            <PauseCircle className="size-5" aria-hidden />
            Pausar
          </button>
        )}
        {onConcluir && (
          <button
            type="button"
            onClick={onConcluir}
            className="flex flex-1 items-center justify-center gap-2 border-l border-slate-200 bg-emerald-600 py-4 text-base font-semibold text-white transition hover:bg-emerald-700"
          >
            <Check className="size-5" aria-hidden />
            Concluir
          </button>
        )}
      </div>
    </Cartao>
  )
}
