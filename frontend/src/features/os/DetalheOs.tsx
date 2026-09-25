import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Clock,
  History,
  Package,
  PauseCircle,
  Plus,
  Printer,
  Share2,
  Trash2,
  User,
  Wrench,
} from 'lucide-react'
import { api } from '../../api/client'
import type {
  Box,
  DetalheOs as DetalheTipo,
  FilaElevador,
  Funcionario,
  MotivoParada,
  ResumoArtigo,
  ResumoLeitura,
  ServicoCatalogo,
  StatusOs,
} from '../../types'
import {
  AreaTexto,
  AvisoErro,
  Botao,
  Campo,
  Carregando,
  Cartao,
  CartaoTitulo,
  Entrada,
  Etiqueta,
  Interruptor,
  Modal,
  Selecao,
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import {
  CORES_ITEM,
  CORES_PRIORIDADE,
  CORES_STATUS,
  dataCompleta,
  dataHora,
  diasTexto,
  horaMinuto,
  horas,
  moeda,
} from '../../lib/format'
import { useAuth } from '../../lib/auth'
import { CHAVES, useConfig } from '../../lib/config'
import { CarroTopo, Placa } from '../../components/oficina'
import ModalCompartilhar from './ModalCompartilhar'

const ROTULOS_ACAO: Partial<Record<StatusOs, string>> = {
  EM_DIAGNOSTICO: 'Iniciar diagnóstico',
  AGUARDANDO_APROVACAO: 'Enviar orçamento',
  ORCAMENTO_APROVADO: 'Aprovar orçamento',
  AGENDADO: 'Agendar',
  EM_EXECUCAO: 'Iniciar execução',
  PAUSADO: 'Pausar',
  PRONTO_AGUARDANDO_RETIRADA: 'Marcar como pronto',
  ENTREGUE: 'Entregar veículo',
  CANCELADO: 'Cancelar OS',
  RECEBIDO: 'Voltar para recebido',
}

/**
 * O mesmo destino quer dizer coisas diferentes dependendo de onde a OS esta.
 *
 * Voltar para o diagnostico vindo da aprovacao nao e "iniciar diagnostico" —
 * e o cliente ter dito nao. Chamar os dois de "Iniciar diagnostico" faria o
 * atendente recusar um orcamento achando que estava so voltando uma etapa.
 */
function rotuloDaAcao(de: StatusOs, para: StatusOs): string {
  if (para === 'EM_DIAGNOSTICO' && de === 'AGUARDANDO_APROVACAO') {
    return 'Cliente recusou'
  }
  return ROTULOS_ACAO[para] ?? para
}

/** Quem pode dar o passo. O servidor recusa de novo; aqui é só não mostrar. */
function podeAcionar(
  de: StatusOs,
  para: StatusOs,
  perfil: { podeAtender: boolean; ehMecanico: boolean; gerencia: boolean },
): boolean {
  if (para === 'ORCAMENTO_APROVADO' || (para === 'EM_DIAGNOSTICO' && de === 'AGUARDANDO_APROVACAO')) {
    return perfil.podeAtender
  }
  if (para === 'EM_EXECUCAO') {
    return perfil.ehMecanico || perfil.gerencia
  }
  return true
}

export default function DetalheOs() {
  const { id = '' } = useParams()
  const { gerencia, ehMecanico, podeAtender } = useAuth()
  const perfil = { gerencia, ehMecanico, podeAtender }
  const { flag } = useConfig()
  const avisar = useAviso()
  const queryClient = useQueryClient()

  const [compartilhando, setCompartilhando] = useState(false)
  const [pausando, setPausando] = useState<StatusOs | null>(null)
  const [motivoParadaId, setMotivoParadaId] = useState('')
  const [descricaoParada, setDescricaoParada] = useState('')
  const [paradaVisivel, setParadaVisivel] = useState(true)
  const [adicionandoServico, setAdicionandoServico] = useState(false)
  const [adicionandoPeca, setAdicionandoPeca] = useState(false)
  const [erroAcao, setErroAcao] = useState<string>()

  const consulta = useQuery({
    queryKey: ['os', id],
    queryFn: () => api<DetalheTipo>(`/os/${id}`),
    refetchInterval: 30_000,
  })

  const motivos = useQuery({
    queryKey: ['motivos', true],
    queryFn: () => api<MotivoParada[]>('/motivos-parada?apenasAtivos=true'),
  })

  const funcionarios = useQuery({
    queryKey: ['funcionarios', true],
    queryFn: () => api<Funcionario[]>('/funcionarios?apenasAtivos=true'),
    enabled: gerencia,
  })

  const boxes = useQuery({
    queryKey: ['boxes', true],
    queryFn: () => api<Box[]>('/boxes?apenasAtivos=true'),
    enabled: gerencia,
  })

  /** A reserva viva nao vem no resumo; sai da fila do elevador. */
  const filaElevador = useQuery({
    queryKey: ['elevadores'],
    queryFn: () => api<FilaElevador>('/elevadores'),
    enabled: gerencia,
  })

  /** Artigos da wiki que servem para este modelo. */
  const wikiDoCarro = useQuery({
    queryKey: ['wiki-veiculo', consulta.data?.resumo.veiculoId],
    queryFn: () => api<ResumoArtigo[]>(`/wiki/veiculo/${consulta.data!.resumo.veiculoId}`),
    enabled: Boolean(consulta.data?.resumo.veiculoId),
  })

  /** As leituras deste carro: o "clico no carro e vejo os relatorios dele". */
  const leiturasDoCarro = useQuery({
    queryKey: ['leituras-veiculo', consulta.data?.resumo.veiculoId],
    queryFn: () => api<ResumoLeitura[]>(`/leituras/veiculo/${consulta.data!.resumo.veiculoId}`),
    enabled: Boolean(consulta.data?.resumo.veiculoId),
  })

  const [elevadorEscolhido, setElevadorEscolhido] = useState('')
  const elevadores = (boxes.data ?? []).filter((b) => b.tipo === 'ELEVADOR')
  const reservaAtual = filaElevador.data?.emUso.find((r) => r.osId === id)

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['os', id] })
    void queryClient.invalidateQueries({ queryKey: ['quadro'] })
    void queryClient.invalidateQueries({ queryKey: ['radar'] })
    void queryClient.invalidateQueries({ queryKey: ['patio'] })
    void queryClient.invalidateQueries({ queryKey: ['elevadores'] })
  }

  const transicionar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) =>
      api<DetalheTipo>(`/os/${id}/transicao`, { metodo: 'POST', corpo }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      setPausando(null)
      setMotivoParadaId('')
      setDescricaoParada('')
      setErroAcao(undefined)
      avisar(`OS agora está em "${dados.resumo.statusDescricao}".`)
    },
    onError: (erro: Error) => setErroAcao(erro.message),
  })

  const alocar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) =>
      api<DetalheTipo>(`/os/${id}/alocar`, { metodo: 'POST', corpo }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Agenda atualizada.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const marcarElevador = useMutation({
    mutationFn: (precisaElevador: boolean) =>
      api<DetalheTipo>(`/os/${id}/elevador`, { metodo: 'PATCH', corpo: { precisaElevador } }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const subirElevador = useMutation({
    mutationFn: (boxId: string) =>
      api<DetalheTipo>(`/os/${id}/elevador/subir`, { metodo: 'POST', corpo: { boxId } }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Carro no elevador.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const descerElevador = useMutation({
    mutationFn: () => api<DetalheTipo>(`/os/${id}/elevador/descer`, { metodo: 'POST' }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Carro desceu do elevador.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const atribuir = useMutation({
    mutationFn: ({ itemId, funcionarioId }: { itemId: string; funcionarioId: string }) =>
      api<DetalheTipo>(`/os/${id}/itens/${itemId}/atribuir`, {
        metodo: 'POST',
        corpo: { funcionarioId },
      }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const removerItem = useMutation({
    mutationFn: (itemId: string) =>
      api<DetalheTipo>(`/os/${id}/itens/${itemId}`, { metodo: 'DELETE' }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Serviço removido.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  if (consulta.isLoading) return <Carregando texto="Abrindo a OS..." />
  if (consulta.isError) {
    return (
      <div className="p-4">
        <Vazio titulo="OS não encontrada" descricao={(consulta.error as Error).message} />
      </div>
    )
  }

  const os = consulta.data!
  const r = os.resumo
  const cores = CORES_STATUS[r.status]
  const mostraValores = gerencia || flag(CHAVES.mecanicoVeValores)

  const acionar = (status: StatusOs) => {
    setErroAcao(undefined)
    if (status === 'PAUSADO' || status === 'CANCELADO') {
      setPausando(status)
      const padrao = motivos.data?.find((m) => m.categoria === 'PECA')
      setMotivoParadaId(padrao?.id ?? '')
      setParadaVisivel(padrao?.visivelClientePadrao ?? true)
      return
    }
    transicionar.mutate({ status })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      {/* ---------------- cabecalho ---------------- */}
      <div className="sem-impressao">
        <Link
          to="/quadro"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar para o quadro
        </Link>
      </div>

      <Cartao className="p-4">
        <div className="flex flex-wrap items-start gap-4">
          <CarroTopo cor={r.cor} largura={46} titulo={r.veiculo} className="flex-none" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Placa placa={r.placa} tamanho="lg" />
              <Etiqueta className={cores.chip}>{r.statusDescricao}</Etiqueta>
              {r.prioridade !== 'NORMAL' && (
                <Etiqueta className={CORES_PRIORIDADE[r.prioridade]}>{r.prioridade}</Etiqueta>
              )}
              <span className="text-xs text-slate-400">OS #{r.numero}</span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{r.veiculo}</p>
            <p className="text-sm text-slate-500">
              {r.clienteNome}
              {r.clienteTelefone && ` · ${r.clienteTelefone}`}
            </p>
            {r.queixa && (
              <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
                <span className="font-medium">Relato do cliente: </span>
                {r.queixa}
              </p>
            )}
          </div>

          <div className="flex flex-none flex-col gap-2 sem-impressao">
            <div className="flex gap-2">
              {flag(CHAVES.compAtivo) && gerencia && (
                <Botao variante="secundario" tamanho="sm" onClick={() => setCompartilhando(true)}>
                  <Share2 className="size-3.5" aria-hidden />
                  {r.compartilhado ? 'Link ativo' : 'Compartilhar'}
                </Botao>
              )}
              <Botao variante="secundario" tamanho="sm" onClick={() => window.print()}>
                <Printer className="size-3.5" aria-hidden />
                Ficha
              </Botao>
            </div>

            {os.proximosStatus.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2">
                {os.proximosStatus
                  .filter((status) => status !== 'CANCELADO')
                  .filter((status) => podeAcionar(r.status, status, perfil))
                  .map((status) => {
                    const recusa = status === 'EM_DIAGNOSTICO' && r.status === 'AGUARDANDO_APROVACAO'
                    return (
                      <Botao
                        key={status}
                        tamanho="sm"
                        variante={
                          status === 'ENTREGUE'
                            ? 'sucesso'
                            : status === 'PAUSADO' || recusa
                              ? 'secundario'
                              : 'primario'
                        }
                        carregando={transicionar.isPending}
                        onClick={() => acionar(status)}
                      >
                        {status === 'PAUSADO' && <PauseCircle className="size-3.5" aria-hidden />}
                        {rotuloDaAcao(r.status, status)}
                      </Botao>
                    )
                  })}
                {os.proximosStatus.includes('CANCELADO') && (
                  <Botao variante="fantasma" tamanho="sm" onClick={() => acionar('CANCELADO')}>
                    Cancelar
                  </Botao>
                )}
              </div>
            )}
          </div>
        </div>

        <AvisoErro mensagem={erroAcao} />

        {/* indicadores rapidos */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-4">
          <Indicador rotulo="Na oficina" valor={diasTexto(r.diasNaOficina)} />
          <Indicador
            rotulo="Mão de obra"
            valor={`${horas(r.horasTrabalhadas)} / ${horas(r.horasEstimadas)}`}
            alerta={r.percentualExecutado > 110}
          />
          <Indicador
            rotulo="Sem movimento"
            valor={diasTexto(r.diasSemMovimentacao)}
            alerta={r.diasSemMovimentacao >= 3}
          />
          <Indicador
            rotulo={r.status === 'PRONTO_AGUARDANDO_RETIRADA' ? 'Aguardando retirada' : 'Parado'}
            valor={
              r.status === 'PRONTO_AGUARDANDO_RETIRADA'
                ? diasTexto(r.diasAguardandoRetirada)
                : horas(r.horasParado)
            }
            alerta={r.diasAguardandoRetirada >= 2}
          />
        </div>

        {r.paradaMotivo && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-orange-50 p-2.5 text-xs text-orange-800 ring-1 ring-orange-200">
            <PauseCircle className="mt-0.5 size-4 flex-none" aria-hidden />
            <span>
              <span className="font-medium">Parado: {r.paradaMotivo}.</span> O tempo continua
              contando no relatório de paradas até alguém retomar o serviço.
            </span>
          </div>
        )}
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------------- coluna principal ---------------- */}
        <div className="space-y-4 lg:col-span-2">
          <Cartao>
            <CartaoTitulo
              titulo="Serviços"
              descricao={`${os.itens.length} item(ns) · ${horas(r.horasEstimadas)} estimadas`}
              acao={
                gerencia && (
                  <Botao
                    variante="secundario"
                    tamanho="sm"
                    onClick={() => setAdicionandoServico(true)}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Adicionar
                  </Botao>
                )
              }
            />
            {os.itens.length === 0 ? (
              <Vazio
                icone={<Wrench className="size-8" />}
                titulo="Nenhum serviço na OS"
                descricao="Adicione o que será feito para o sistema poder estimar o tempo e a capacidade do dia."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {os.itens.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{item.descricao}</p>
                        <Etiqueta className={CORES_ITEM[item.status]}>
                          {item.statusDescricao}
                        </Etiqueta>
                        {item.especialidadeNome && (
                          <Etiqueta
                            className="text-white ring-transparent"
                            titulo="Especialidade exigida"
                          >
                            <span
                              className="inline-block size-2 rounded-full"
                              style={{ backgroundColor: item.especialidadeCor ?? '#64748b' }}
                              aria-hidden
                            />
                            <span className="text-slate-600">{item.especialidadeNome}</span>
                          </Etiqueta>
                        )}
                        {item.apontamentoAberto && (
                          <Etiqueta className="bg-blue-100 text-blue-700 ring-blue-200">
                            <Clock className="size-2.5 pulsando" aria-hidden />
                            rodando desde {horaMinuto(item.apontamentoInicio)}
                          </Etiqueta>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {horas(item.horasTrabalhadas)} de {horas(item.horasEstimadas)}
                        {mostraValores && item.valor !== undefined && ` · ${moeda(item.valor)}`}
                      </p>
                    </div>

                    {gerencia ? (
                      <Selecao
                        aria-label={`Mecânico de ${item.descricao}`}
                        className="h-8 w-40 py-1 text-xs"
                        value={item.funcionarioId ?? ''}
                        onChange={(e) =>
                          e.target.value &&
                          atribuir.mutate({ itemId: item.id, funcionarioId: e.target.value })
                        }
                      >
                        <option value="">Sem mecânico</option>
                        {(funcionarios.data ?? []).map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </Selecao>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <User className="size-3" aria-hidden />
                        {item.funcionarioNome ?? 'sem mecânico'}
                      </span>
                    )}

                    {gerencia && item.status !== 'CANCELADO' && (
                      <button
                        type="button"
                        onClick={() => removerItem.mutate(item.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remover ${item.descricao}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao>
            <CartaoTitulo
              titulo="Peças"
              descricao="Falta de peça é o motivo número um de carro parado"
              acao={
                gerencia && (
                  <Botao variante="secundario" tamanho="sm" onClick={() => setAdicionandoPeca(true)}>
                    <Plus className="size-3.5" aria-hidden />
                    Adicionar
                  </Botao>
                )
              }
            />
            {os.pecas.length === 0 ? (
              <Vazio
                icone={<Package className="size-8" />}
                titulo="Nenhuma peça registrada"
                descricao="Registre a peça e a previsão de chegada para o quadro mostrar por que o carro está parado."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {os.pecas.map((peca) => (
                  <li key={peca.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        {peca.quantidade > 1 && `${peca.quantidade}x `}
                        {peca.descricao}
                      </p>
                      <p className="text-xs text-slate-500">
                        {peca.fornecedor ?? 'sem fornecedor'}
                        {peca.previsaoChegada && ` · chega ${dataCompleta(peca.previsaoChegada)}`}
                      </p>
                    </div>
                    <Etiqueta
                      className={cx(
                        peca.status === 'RECEBIDA' || peca.status === 'APLICADA'
                          ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                          : 'bg-amber-100 text-amber-800 ring-amber-200',
                      )}
                    >
                      {peca.statusDescricao}
                    </Etiqueta>
                    {mostraValores && (
                      <span className="w-24 text-right text-xs text-slate-600">
                        {moeda(peca.total)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {/* Clicar no carro e ver os relatorios dele: e para isto que as
              leituras do scanner existem. */}
          <Cartao>
            <CartaoTitulo
              titulo="Leituras do scanner"
              descricao="Os dados dos módulos deste carro"
            />
            {(leiturasDoCarro.data ?? []).length === 0 ? (
              <div className="px-4 py-5">
                <p className="text-sm text-slate-500">
                  Nenhuma leitura deste carro ainda.{' '}
                  <Link to="/leituras" className="font-medium text-marca-600 hover:underline">
                    Importar o PDF do scanner
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {leiturasDoCarro.data!.map((l) => (
                  <Link
                    key={l.id}
                    to={`/leituras/${l.id}`}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50"
                  >
                    <Etiqueta
                      className={
                        l.tipo === 'OFICIAL'
                          ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                          : 'bg-amber-100 text-amber-800 ring-amber-200'
                      }
                    >
                      {l.tipoDescricao}
                    </Etiqueta>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {l.condicao ?? l.modeloDescricao}
                    </span>
                    <span className="flex-none text-xs text-slate-400">
                      {l.modulos} mód · {l.itens} itens
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Cartao>

          {/* O que a oficina ja resolveu em carro igual a este. */}
          {(wikiDoCarro.data ?? []).length > 0 && (
            <Cartao>
              <CartaoTitulo
                titulo="A oficina já viu isso"
                descricao="Artigos da wiki que servem para este modelo"
              />
              <div className="divide-y divide-slate-100">
                {wikiDoCarro.data!.map((a) => (
                  <Link
                    key={a.id}
                    to={`/wiki/${a.id}`}
                    className="block px-4 py-2 hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
                    <p className="text-xs text-marca-700">{a.alcance}</p>
                  </Link>
                ))}
              </div>
            </Cartao>
          )}

          <Cartao>
            <CartaoTitulo titulo="Linha do tempo" descricao="Tudo que aconteceu com este veículo" />
            {os.eventos.length === 0 ? (
              <Vazio icone={<History className="size-8" />} titulo="Sem eventos ainda" />
            ) : (
              <ol className="space-y-0 px-4 py-3">
                {[...os.eventos].reverse().map((evento, indice) => (
                  <li key={evento.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cx(
                          'mt-1.5 size-2 flex-none rounded-full',
                          indice === 0 ? 'bg-marca-600' : 'bg-slate-300',
                        )}
                        aria-hidden
                      />
                      {indice < os.eventos.length - 1 && (
                        <span className="w-px flex-1 bg-slate-200" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-3">
                      <p className="text-sm text-slate-800">{evento.descricao ?? evento.tipo}</p>
                      <p className="text-[11px] text-slate-400">
                        {dataHora(evento.quando)}
                        {evento.autor && ` · ${evento.autor}`}
                        {evento.visivelCliente && ' · visível ao cliente'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Cartao>
        </div>

        {/* ---------------- coluna lateral ---------------- */}
        <div className="space-y-4">
          {gerencia && (
            <Cartao>
              <CartaoTitulo titulo="Agenda e vaga" />
              <div className="space-y-3 p-4">
                <Campo rotulo="Dia na agenda">
                  <Entrada
                    type="date"
                    value={r.dataAgendada ?? ''}
                    onChange={(e) =>
                      alocar.mutate({ dataAgendada: e.target.value || null, boxId: r.boxId ?? null })
                    }
                  />
                </Campo>
                <Campo rotulo="Box / vaga">
                  <Selecao
                    value={r.boxId ?? ''}
                    onChange={(e) =>
                      alocar.mutate({
                        dataAgendada: r.dataAgendada ?? null,
                        boxId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Sem vaga definida</option>
                    {(boxes.data ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome}
                      </option>
                    ))}
                  </Selecao>
                </Campo>
                {r.previsaoEntrega && (
                  <p className={cx('text-xs', r.atrasada ? 'text-red-600' : 'text-slate-500')}>
                    Entrega prometida: {dataCompleta(r.previsaoEntrega)}
                    {r.atrasada && ' (atrasada)'}
                  </p>
                )}

                {/* elevador: um carro por vez, e o tempo corre em hora */}
                <div className="border-t border-slate-200 pt-1">
                  <Interruptor
                    ativo={r.precisaElevador}
                    onChange={(v) => marcarElevador.mutate(v)}
                    rotulo="Precisa de elevador"
                    descricao="Entra na fila do elevador; um carro sobe de cada vez."
                  />

                  {r.precisaElevador && (
                    <div className="flex flex-wrap items-center gap-2 pb-1">
                      {elevadores.length === 0 ? (
                        <p className="text-xs text-amber-700">
                          Nenhum elevador cadastrado. Ajuste em Configurações › Capacidade.
                        </p>
                      ) : reservaAtual?.status === 'EM_USO' ? (
                        <>
                          <span className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                            {reservaAtual.boxNome} · {reservaAtual.rotulo}
                          </span>
                          <Botao variante="secundario" onClick={() => descerElevador.mutate()}>
                            Descer
                          </Botao>
                        </>
                      ) : (
                        <>
                          <Selecao
                            value={elevadorEscolhido}
                            onChange={(e) => setElevadorEscolhido(e.target.value)}
                            className="w-auto min-w-40"
                          >
                            <option value="">Escolha o elevador</option>
                            {elevadores.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.nome}
                              </option>
                            ))}
                          </Selecao>
                          <Botao
                            onClick={() => subirElevador.mutate(elevadorEscolhido)}
                            disabled={!elevadorEscolhido}
                          >
                            Subir agora
                          </Botao>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Cartao>
          )}

          {mostraValores && (
            <Cartao>
              <CartaoTitulo titulo="Valores" />
              <dl className="divide-y divide-slate-100 px-4 py-2 text-sm">
                <Linha rotulo="Peças" valor={moeda(os.valorPecas)} />
                <Linha rotulo="Mão de obra" valor={moeda(os.valorMaoObra)} />
                {os.desconto > 0 && <Linha rotulo="Desconto" valor={`- ${moeda(os.desconto)}`} />}
                <Linha rotulo="Total" valor={moeda(os.valorTotal)} destaque />
              </dl>
            </Cartao>
          )}

          <Cartao>
            <CartaoTitulo titulo="Apontamentos" descricao="Horário registrado pelo servidor" />
            {os.apontamentos.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">
                Nenhuma hora apontada ainda.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...os.apontamentos].reverse().map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-slate-700">
                        {a.funcionarioNome}
                      </p>
                      <span
                        className={cx(
                          'text-xs font-semibold',
                          a.fim ? 'text-slate-700' : 'text-blue-600',
                        )}
                      >
                        {horas(a.horas)}
                        {!a.fim && ' (rodando)'}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-slate-500">{a.itemDescricao}</p>
                    <p className="text-[11px] text-slate-400">
                      {horaMinuto(a.inicio)} → {a.fim ? horaMinuto(a.fim) : '...'}
                      {a.horasEstimadasInformadas &&
                        ` · previu ${horas(a.horasEstimadasInformadas)}`}
                      {a.encerradoAutomaticamente && ' · fechado no fim do turno'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {os.paradas.length > 0 && (
            <Cartao>
              <CartaoTitulo titulo="Paradas" descricao="Por que o carro ficou sem andar" />
              <ul className="divide-y divide-slate-100">
                {[...os.paradas].reverse().map((p) => (
                  <li key={p.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-slate-700">{p.motivo}</p>
                      <span
                        className={cx(
                          'text-xs font-semibold',
                          p.fim ? 'text-slate-700' : 'text-orange-600',
                        )}
                      >
                        {horas(p.horas)}
                        {!p.fim && ' (em aberto)'}
                      </span>
                    </div>
                    {p.descricao && <p className="text-[11px] text-slate-500">{p.descricao}</p>}
                    <p className="text-[11px] text-slate-400">
                      desde {dataHora(p.inicio)}
                      {p.visivelCliente ? ' · visível ao cliente' : ' · interno'}
                    </p>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      </div>

      {/* ---------------- modais ---------------- */}
      <ModalCompartilhar
        aberto={compartilhando}
        onFechar={() => setCompartilhando(false)}
        os={os}
      />

      <Modal
        aberto={pausando !== null}
        onFechar={() => setPausando(null)}
        titulo={pausando === 'CANCELADO' ? 'Cancelar OS' : 'Pausar serviço'}
        descricao={
          pausando === 'CANCELADO'
            ? 'A OS sai do pátio e a vaga é liberada.'
            : 'O motivo vira métrica no painel do dono. É assim que você descobre o gargalo real.'
        }
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setPausando(null)}>
              Voltar
            </Botao>
            <Botao
              variante={pausando === 'CANCELADO' ? 'perigo' : 'primario'}
              carregando={transicionar.isPending}
              onClick={() =>
                transicionar.mutate({
                  status: pausando,
                  motivoParadaId: pausando === 'PAUSADO' ? motivoParadaId || undefined : undefined,
                  descricao: descricaoParada || undefined,
                  visivelCliente: paradaVisivel,
                })
              }
            >
              Confirmar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          {pausando === 'PAUSADO' && (
            <Campo rotulo="Motivo da parada" obrigatorio={flag(CHAVES.exigirMotivoPausa)}>
              <Selecao
                value={motivoParadaId}
                onChange={(e) => {
                  setMotivoParadaId(e.target.value)
                  const m = motivos.data?.find((x) => x.id === e.target.value)
                  setParadaVisivel(m?.visivelClientePadrao ?? false)
                }}
              >
                <option value="">Selecione...</option>
                {(motivos.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.categoriaDescricao})
                  </option>
                ))}
              </Selecao>
            </Campo>
          )}

          <Campo
            rotulo={pausando === 'CANCELADO' ? 'Motivo do cancelamento' : 'Observação'}
            dica="Fica no histórico da OS"
          >
            <AreaTexto
              value={descricaoParada}
              onChange={(e) => setDescricaoParada(e.target.value)}
              placeholder={
                pausando === 'CANCELADO'
                  ? 'Ex.: cliente desistiu do orçamento.'
                  : 'Ex.: kit de embreagem em falta, fornecedor entrega quinta.'
              }
            />
          </Campo>

          {pausando === 'PAUSADO' && (
            <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
              <Interruptor
                ativo={paradaVisivel}
                rotulo="Mostrar esta parada para o cliente"
                descricao="Se desligado, o dono vê o motivo mas o cliente não"
                onChange={setParadaVisivel}
              />
            </div>
          )}
        </div>
      </Modal>

      <ModalNovoServico
        aberto={adicionandoServico}
        onFechar={() => setAdicionandoServico(false)}
        osId={id}
        onSalvo={(dados) => {
          queryClient.setQueryData(['os', id], dados)
          invalidar()
          setAdicionandoServico(false)
          avisar('Serviço adicionado.')
        }}
      />

      <ModalNovaPeca
        aberto={adicionandoPeca}
        onFechar={() => setAdicionandoPeca(false)}
        osId={id}
        onSalvo={() => {
          invalidar()
          setAdicionandoPeca(false)
          avisar('Peça registrada.')
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------------ auxiliares

function Indicador({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string
  valor: string
  alerta?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={cx('text-sm font-semibold', alerta ? 'text-red-600' : 'text-slate-800')}>
        {valor}
      </p>
    </div>
  )
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className={cx('text-xs', destaque ? 'font-semibold text-slate-800' : 'text-slate-500')}>
        {rotulo}
      </dt>
      <dd className={cx(destaque ? 'text-sm font-semibold text-slate-900' : 'text-xs text-slate-700')}>
        {valor}
      </dd>
    </div>
  )
}

function ModalNovoServico({
  aberto,
  onFechar,
  osId,
  onSalvo,
}: {
  aberto: boolean
  onFechar: () => void
  osId: string
  onSalvo: (dados: DetalheTipo) => void
}) {
  const [catalogoId, setCatalogoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [horasEstimadas, setHorasEstimadas] = useState('1')
  const [erro, setErro] = useState<string>()

  const catalogo = useQuery({
    queryKey: ['catalogo', true],
    queryFn: () => api<ServicoCatalogo[]>('/catalogo-servicos?apenasAtivos=true'),
    enabled: aberto,
  })

  const salvar = useMutation({
    mutationFn: () =>
      api<DetalheTipo>(`/os/${osId}/itens`, {
        metodo: 'POST',
        corpo: {
          catalogoServicoId: catalogoId || undefined,
          descricao: descricao || undefined,
          horasEstimadas: Number(horasEstimadas),
        },
      }),
    onSuccess: (dados) => {
      setCatalogoId('')
      setDescricao('')
      setHorasEstimadas('1')
      onSalvo(dados)
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Adicionar serviço"
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Adicionar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Do catálogo" dica="Traz o tempo padrão e o preço sugerido">
          <Selecao
            value={catalogoId}
            onChange={(e) => {
              setCatalogoId(e.target.value)
              const escolhido = catalogo.data?.find((c) => c.id === e.target.value)
              if (escolhido) setHorasEstimadas(String(escolhido.horasPadrao))
            }}
          >
            <option value="">Serviço avulso</option>
            {(catalogo.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao} ({c.horasPadrao}h)
              </option>
            ))}
          </Selecao>
        </Campo>

        {!catalogoId && (
          <Campo rotulo="Descrição do serviço" obrigatorio>
            <Entrada
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: soldar suporte do escapamento"
            />
          </Campo>
        )}

        <Campo rotulo="Horas estimadas" obrigatorio>
          <Entrada
            type="number"
            step="0.25"
            min="0.25"
            value={horasEstimadas}
            onChange={(e) => setHorasEstimadas(e.target.value)}
          />
        </Campo>

        <AvisoErro mensagem={erro} />
      </div>
    </Modal>
  )
}

function ModalNovaPeca({
  aberto,
  onFechar,
  osId,
  onSalvo,
}: {
  aberto: boolean
  onFechar: () => void
  osId: string
  onSalvo: () => void
}) {
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [fornecedor, setFornecedor] = useState('')
  const [status, setStatus] = useState('SOLICITADA')
  const [previsao, setPrevisao] = useState('')
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string>()

  const salvar = useMutation({
    mutationFn: () =>
      api(`/os/${osId}/pecas`, {
        metodo: 'POST',
        corpo: {
          descricao,
          quantidade: Number(quantidade),
          fornecedor: fornecedor || undefined,
          status,
          previsaoChegada: previsao || undefined,
          valorUnitario: valor ? Number(valor) : undefined,
        },
      }),
    onSuccess: () => {
      setDescricao('')
      setQuantidade('1')
      setFornecedor('')
      setPrevisao('')
      setValor('')
      onSalvo()
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Registrar peça"
      descricao="Com a previsão de chegada, o quadro mostra até quando o carro fica esperando."
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Registrar
          </Botao>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Peça" obrigatorio>
            <Entrada
              autoFocus
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: kit de embreagem"
            />
          </Campo>
        </div>
        <Campo rotulo="Quantidade">
          <Entrada
            type="number"
            step="0.5"
            min="0.5"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Fornecedor">
          <Entrada value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
        </Campo>
        <Campo rotulo="Situação">
          <Selecao value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="SOLICITADA">Solicitada</option>
            <option value="COMPRADA">Comprada</option>
            <option value="RECEBIDA">Recebida</option>
            <option value="APLICADA">Aplicada</option>
          </Selecao>
        </Campo>
        <Campo rotulo="Previsão de chegada">
          <Entrada type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
        </Campo>
        <Campo rotulo="Valor unitário (R$)">
          <Entrada
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </Campo>
        <div className="sm:col-span-2">
          <AvisoErro mensagem={erro} />
        </div>
      </div>
    </Modal>
  )
}
