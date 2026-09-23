import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Car, History, Plus, Search, UserPlus } from 'lucide-react'
import { api } from '../../api/client'
import type { Cliente, Pagina, ResumoOs } from '../../types'
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
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import { CORES_STATUS, dataCompleta, horas } from '../../lib/format'

export default function Clientes() {
  const avisar = useAviso()
  const queryClient = useQueryClient()

  const [termo, setTermo] = useState('')
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<Cliente | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [criando, setCriando] = useState(false)
  const [veiculoHistorico, setVeiculoHistorico] = useState<{ id: string; placa: string } | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setBusca(termo.trim()), 350)
    return () => window.clearTimeout(id)
  }, [termo])

  const lista = useQuery({
    queryKey: ['clientes', busca],
    queryFn: () =>
      api<Pagina<Cliente>>(`/clientes?busca=${encodeURIComponent(busca)}&tamanho=50`),
  })

  const detalhe = useQuery({
    queryKey: ['cliente', selecionado?.id],
    queryFn: () => api<Cliente>(`/clientes/${selecionado!.id}`),
    enabled: Boolean(selecionado),
  })

  const historico = useQuery({
    queryKey: ['historico-veiculo', veiculoHistorico?.id],
    queryFn: () => api<ResumoOs[]>(`/veiculos/${veiculoHistorico!.id}/historico`),
    enabled: Boolean(veiculoHistorico),
  })

  const cliente = detalhe.data ?? selecionado

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
      {/* ---------------- lista ---------------- */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Entrada
              className="pl-9"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar cliente..."
            />
          </div>
          <Botao tamanho="md" onClick={() => setCriando(true)} aria-label="Novo cliente">
            <UserPlus className="size-4" aria-hidden />
          </Botao>
        </div>

        <Cartao className="overflow-hidden">
          {lista.isLoading ? (
            <Carregando />
          ) : (lista.data?.content ?? []).length === 0 ? (
            <Vazio titulo="Nenhum cliente encontrado" />
          ) : (
            <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto rolagem-suave">
              {lista.data!.content.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionado(c)}
                    className={cx(
                      'flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50',
                      selecionado?.id === c.id && 'bg-marca-50',
                    )}
                  >
                    <span className="grid size-8 flex-none place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {c.nome.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {c.nome}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {c.telefone ?? 'sem telefone'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      {/* ---------------- detalhe ---------------- */}
      <div className="space-y-4">
        {!cliente ? (
          <Cartao>
            <Vazio
              titulo="Selecione um cliente"
              descricao="Veja os carros dele e todo o histórico de serviços por placa."
            />
          </Cartao>
        ) : (
          <>
            <Cartao>
              <CartaoTitulo
                titulo={cliente.nome}
                descricao={[cliente.telefone, cliente.email, cliente.documento]
                  .filter(Boolean)
                  .join(' · ')}
                acao={
                  <Botao variante="secundario" tamanho="sm" onClick={() => setEditando(cliente)}>
                    Editar
                  </Botao>
                }
              />
              {cliente.observacoes && (
                <p className="px-4 py-3 text-sm text-slate-600">{cliente.observacoes}</p>
              )}
              <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-2.5">
                <Etiqueta
                  className={
                    cliente.compartilhamentoHabilitado === false
                      ? 'bg-slate-100 text-slate-500 ring-slate-200'
                      : 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                  }
                >
                  {cliente.compartilhamentoHabilitado === false
                    ? 'Não recebe link de acompanhamento'
                    : 'Recebe link de acompanhamento'}
                </Etiqueta>
                {cliente.consentimentoContato && (
                  <Etiqueta>Autorizou contato</Etiqueta>
                )}
              </div>
            </Cartao>

            <Cartao>
              <CartaoTitulo titulo="Veículos" descricao={`${cliente.veiculos.length} cadastrado(s)`} />
              {cliente.veiculos.length === 0 ? (
                <Vazio icone={<Car className="size-8" />} titulo="Nenhum veículo cadastrado" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cliente.veiculos.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Car className="size-4 flex-none text-slate-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-slate-900">{v.placa}</p>
                        <p className="truncate text-xs text-slate-500">
                          {v.descricao}
                          {v.cor && ` · ${v.cor}`}
                          {v.km && ` · ${v.km.toLocaleString('pt-BR')} km`}
                        </p>
                      </div>
                      <Botao
                        variante="secundario"
                        tamanho="sm"
                        onClick={() => setVeiculoHistorico({ id: v.id, placa: v.placa })}
                      >
                        <History className="size-3.5" aria-hidden />
                        Histórico
                      </Botao>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </>
        )}
      </div>

      {/* ---------------- modais ---------------- */}
      <ModalCliente
        aberto={criando || editando !== null}
        cliente={editando}
        onFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        onSalvo={(salvo) => {
          setCriando(false)
          setEditando(null)
          setSelecionado(salvo)
          void queryClient.invalidateQueries({ queryKey: ['clientes'] })
          void queryClient.invalidateQueries({ queryKey: ['cliente', salvo.id] })
          avisar('Cliente salvo.')
        }}
      />

      <Modal
        aberto={veiculoHistorico !== null}
        onFechar={() => setVeiculoHistorico(null)}
        titulo={`Histórico da placa ${veiculoHistorico?.placa ?? ''}`}
        descricao="Todas as passagens deste veículo pela oficina, inclusive com donos anteriores."
        largura="max-w-2xl"
      >
        {historico.isLoading ? (
          <Carregando />
        ) : (historico.data ?? []).length === 0 ? (
          <Vazio titulo="Primeira passagem deste veículo pela oficina" />
        ) : (
          <ul className="space-y-2">
            {historico.data!.map((os) => (
              <li key={os.id}>
                <Link
                  to={`/os/${os.id}`}
                  className="block rounded-lg p-3 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">OS #{os.numero}</span>
                    <Etiqueta className={CORES_STATUS[os.status].chip}>{os.statusDescricao}</Etiqueta>
                    <span className="ml-auto text-xs text-slate-500">
                      {horas(os.horasTrabalhadas)} de mão de obra
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{os.queixa ?? 'Sem relato'}</p>
                  <p className="text-[11px] text-slate-400">
                    {os.dataAgendada ? `Agendado ${dataCompleta(os.dataAgendada)} · ` : ''}
                    {os.diasNaOficina} dia(s) na oficina
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}

function ModalCliente({
  aberto,
  cliente,
  onFechar,
  onSalvo,
}: {
  aberto: boolean
  cliente: Cliente | null
  onFechar: () => void
  onSalvo: (cliente: Cliente) => void
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [documento, setDocumento] = useState('')
  const [email, setEmail] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [consentimento, setConsentimento] = useState(true)
  const [compartilha, setCompartilha] = useState(true)
  const [erro, setErro] = useState<string>()

  useEffect(() => {
    if (!aberto) return
    setNome(cliente?.nome ?? '')
    setTelefone(cliente?.telefone ?? '')
    setDocumento(cliente?.documento ?? '')
    setEmail(cliente?.email ?? '')
    setObservacoes(cliente?.observacoes ?? '')
    setConsentimento(cliente?.consentimentoContato ?? true)
    setCompartilha(cliente?.compartilhamentoHabilitado !== false)
    setErro(undefined)
  }, [aberto, cliente])

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        nome,
        telefone: telefone || undefined,
        documento: documento || undefined,
        email: email || undefined,
        observacoes: observacoes || undefined,
        consentimentoContato: consentimento,
        compartilhamentoHabilitado: compartilha,
      }
      return cliente
        ? api<Cliente>(`/clientes/${cliente.id}`, { metodo: 'PUT', corpo })
        : api<Cliente>('/clientes', { metodo: 'POST', corpo })
    },
    onSuccess: onSalvo,
    onError: (falha: Error) => setErro(falha.message),
  })

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={cliente ? 'Editar cliente' : 'Novo cliente'}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Nome" obrigatorio>
            <Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Telefone">
          <Entrada value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </Campo>
        <Campo rotulo="CPF/CNPJ">
          <Entrada value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </Campo>
        <div className="sm:col-span-2">
          <Campo rotulo="E-mail">
            <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
        </div>
        <div className="sm:col-span-2">
          <Campo rotulo="Observações">
            <AreaTexto
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: cliente prefere ser avisado só depois das 18h."
            />
          </Campo>
        </div>
        <div className="divide-y divide-slate-100 rounded-lg px-3 ring-1 ring-slate-200 sm:col-span-2">
          <Interruptor
            ativo={compartilha}
            rotulo="Enviar link de acompanhamento para este cliente"
            descricao="Desligue para clientes que não devem receber o link"
            onChange={setCompartilha}
          />
          <Interruptor
            ativo={consentimento}
            rotulo="Cliente autorizou contato"
            descricao="Registro de consentimento (LGPD)"
            onChange={setConsentimento}
          />
        </div>
        <div className="sm:col-span-2">
          <AvisoErro mensagem={erro} />
        </div>
      </div>
    </Modal>
  )
}
