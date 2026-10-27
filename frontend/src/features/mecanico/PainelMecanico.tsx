import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardCheck, PauseCircle, Play, Wrench } from 'lucide-react'
import { api } from '../../api/client'
import { AjudaDaTela } from '../../components/AjudaDaTela'
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
  /** Teclado numerico escondido ate alguem pedir um tempo fora dos atalhos. */
  const [tempoLivre, setTempoLivre] = useState(false)
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
  /**
   * Servico parado no meio nao e servico na fila.
   *
   * Os dois caiam juntos em "Na fila", com o mesmo botao "Iniciar". Mas um
   * deles e um carro que ja esta aberto na bancada, com 22h de apontamento
   * e as pecas espalhadas — "iniciar" ali e a palavra errada, e a estimativa
   * que o modal pedia ja tinha sido dada. Separar os dois e dizer "Retomar"
   * custa um cabecalho e economiza um passo inteiro no caso mais comum.
   */
  const parados = useMemo(
    () => lista.filter((s) => !s.apontamentoAbertoId && s.horasTrabalhadas > 0),
    [lista],
  )
  const pendentes = useMemo(
    () => lista.filter((s) => !s.apontamentoAbertoId && s.horasTrabalhadas <= 0),
    [lista],
  )
  /** Retomar nao pergunta tempo de novo: a estimativa ja existe. */
  const retomando = iniciando !== null && iniciando.horasTrabalhadas > 0

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

      <AjudaDaTela chave="meus-servicos" titulo="O cronômetro é o que conta as horas">
        Toque em <strong>Iniciar</strong> quando pegar o carro e em <strong>Pausar</strong> quando
        largar, dizendo o motivo — é daí que sai o relatório do que trava a oficina. Hora só conta
        com o cronômetro rodando: serviço concluído sem ele entra com zero. Você também faz tudo
        isso pela linha do serviço, dentro da OS.
      </AjudaDaTela>

      {lista.length === 0 && (
        <Cartao>
          <Vazio
            icone={<ClipboardCheck className="size-10" />}
            titulo={gerencia ? 'Nenhum serviço aberto na oficina' : 'Nenhum serviço na sua fila'}
            descricao={
              gerencia
                ? 'Nenhum carro tem serviço pendente, em execução ou pausado neste momento.'
                : 'Quando o dono atribuir um serviço a você, ele aparece aqui.'
            }
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

      {parados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-800">Parados no meio</h2>
          {parados.map((servico) => (
            <CartaoServico
              key={servico.itemId}
              servico={servico}
              agora={agora}
              onIniciar={() => {
                setErro(undefined)
                setEstimativa(String(servico.horasEstimadas ?? 1))
                setTempoLivre(false)
                setIniciando(servico)
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
                const previsto = servico.horasEstimadas ?? 1
                setEstimativa(String(previsto))
                // Se o tempo que veio da OS nao e um dos atalhos, ja abre o
                // teclado -- senao o valor apareceria sem nenhum botao aceso,
                // e nao daria para saber de onde ele saiu.
                setTempoLivre(![0.5, 1, 2, 3, 4, 6, 8].includes(previsto))
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
        titulo={retomando ? 'Retomar o serviço' : 'Começar o serviço'}
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
              {retomando ? 'Retomar agora' : 'Iniciar agora'}
            </Botao>
          </>
        }
      >
        {/* Botao primeiro, campo depois.
            Antes era o contrario: um campo numerico de passo 0,25 em cima e os
            atalhos embaixo, como complemento. Mas quem esta aqui acabou de
            calcar a luva e vai responder "umas duas horas" -- nao "1.75". O
            teclado numerico so aparece para quem realmente quer um valor
            quebrado, e ai e ele que vira o complemento. */}
        <div className="space-y-4">
          {/* Retomar nao pergunta tempo de novo.
              O servico parado no meio ja tem estimativa dada e horas
              apontadas; repetir a pergunta e um passo a mais com a luva na
              mao, e a resposta certa e sempre a mesma que ja esta la. */}
          {retomando && (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200">
              Já tem{' '}
              <strong className="text-slate-900">{horas(iniciando?.horasTrabalhadas)}</strong>{' '}
              apontadas neste serviço, previsto em {horas(iniciando?.horasEstimadas)}. O cronômetro
              continua de onde parou.
            </p>
          )}

          {!retomando && (
          <Campo
            rotulo="Quanto tempo você acha que vai gastar?"
            obrigatorio={flag(CHAVES.exigirEstimativa)}
            dica="É essa previsão que o dono usa para prometer prazo ao cliente."
          >
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[0.5, 1, 2, 3, 4, 6, 8].map((valor) => {
                const escolhido = Number(estimativa) === valor
                return (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={escolhido}
                    onClick={() => {
                      setEstimativa(String(valor))
                      setTempoLivre(false)
                    }}
                    className={cx(
                      // h-14: alvo de dedo com luva. O minimo recomendado e
                      // 44px; aqui sobra porque errar o botao custa refazer.
                      'h-14 rounded-xl text-base font-semibold ring-1 transition',
                      escolhido
                        ? 'bg-marca-600 text-white ring-marca-600'
                        : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 active:bg-slate-100',
                    )}
                  >
                    {horas(valor)}
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={tempoLivre}
                onClick={() => setTempoLivre(true)}
                className={cx(
                  'h-14 rounded-xl text-base font-semibold ring-1 transition',
                  tempoLivre
                    ? 'bg-slate-700 text-white ring-slate-700'
                    : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 active:bg-slate-100',
                )}
              >
                Outro
              </button>
            </div>
          </Campo>
          )}

          {!retomando && tempoLivre && (
            <Entrada
              type="number"
              step="0.25"
              min="0.25"
              inputMode="decimal"
              autoFocus
              aria-label="Tempo em horas"
              className="text-lg"
              value={estimativa}
              onChange={(e) => setEstimativa(e.target.value)}
            />
          )}

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
  /** Ja tem hora apontada: o carro esta aberto na bancada, nao na fila. */
  const jaMexeram = !rodando && servico.horasTrabalhadas > 0
  const excedente = servico.horasTrabalhadas - servico.horasEstimadas
  const estourou = !rodando && servico.horasEstimadas > 0 && excedente > 0
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
              <Link
                to={`/os/${servico.osId}`}
                aria-label={`Abrir OS do ${servico.placa}`}
                className="-my-1.5 inline-flex items-center py-1.5"
              >
                <Placa placa={servico.placa} tamanho="md" />
              </Link>
              {servico.precisaElevador && <SeloElevador estado="PRECISA" />}
              {/* Sem modelo cadastrado o servidor devolve a propria placa, e o
                  cartao saia "[KLM4C88] KLM4C88". */}
              {servico.veiculo !== servico.placa && (
                <span className="text-sm text-slate-500">{servico.veiculo}</span>
              )}
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
        ) : estourou ? (
          /*
           * 22h59 apontadas num servico previsto em 6h sairam no mesmo cinza
           * de 12px que "0min apontadas de 2h30" — o cartao nao distinguia
           * um servico intacto de um que ja consumiu quase quatro vezes o
           * previsto. Quem precisa saber disso antes de pegar a chave de
           * roda e justamente quem esta olhando este cartao.
           */
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
            {horas(servico.horasTrabalhadas)} já apontadas — {horas(excedente)} a mais que as{' '}
            {horas(servico.horasEstimadas)} previstas
          </p>
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
            {jaMexeram ? 'Retomar' : 'Iniciar'}
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
