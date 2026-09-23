import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Car, Check, Plus, Search, Sparkles, UserPlus, X } from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import type {
  Box,
  Cliente,
  DetalheOs,
  ServicoCatalogo,
  Sugestao,
  VeiculoResumo,
} from '../../types'
import {
  AvisoErro,
  Botao,
  Campo,
  Cartao,
  CartaoTitulo,
  Entrada,
  Etiqueta,
  Selecao,
  AreaTexto,
  cx,
  useAviso,
} from '../../components/ui'
import { CampoMarca } from '../../components/CampoMarca'
import { dataCompleta, horas, moeda } from '../../lib/format'

interface ServicoEscolhido {
  catalogoServicoId: string
  descricao: string
  horasEstimadas: number
  valor?: number
}

export default function Checkin() {
  const navegar = useNavigate()
  const avisar = useAviso()

  const [termo, setTermo] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', documento: '', email: '' })
  const [criandoCliente, setCriandoCliente] = useState(false)

  const [veiculo, setVeiculo] = useState<VeiculoResumo | null>(null)
  const [novoVeiculo, setNovoVeiculo] = useState({
    placa: '',
    marca: '',
    modelo: '',
    ano: '',
    cor: '',
    km: '',
  })
  const [criandoVeiculo, setCriandoVeiculo] = useState(false)

  const [queixa, setQueixa] = useState('')
  const [prioridade, setPrioridade] = useState('NORMAL')
  const [servicos, setServicos] = useState<ServicoEscolhido[]>([])
  const [dataAgendada, setDataAgendada] = useState('')
  const [previsaoEntrega, setPrevisaoEntrega] = useState('')
  const [boxId, setBoxId] = useState('')
  const [erro, setErro] = useState<string>()

  // busca com atraso curto para nao disparar a cada tecla
  useEffect(() => {
    const id = window.setTimeout(() => setTermoBusca(termo.trim()), 350)
    return () => window.clearTimeout(id)
  }, [termo])

  const buscaClientes = useQuery({
    queryKey: ['clientes-autocompletar', termoBusca],
    queryFn: () => api<Cliente[]>(`/clientes/autocompletar?termo=${encodeURIComponent(termoBusca)}`),
    enabled: termoBusca.length >= 2 && !cliente,
  })

  const buscaPlaca = useQuery({
    queryKey: ['veiculo-por-placa', termoBusca],
    queryFn: () =>
      api<{ id: string; placa: string; descricao: string; clienteId: string }>(
        `/veiculos/placa/${encodeURIComponent(termoBusca)}`,
      ).catch(() => null),
    enabled: termoBusca.length >= 6 && !cliente,
  })

  const catalogo = useQuery({
    queryKey: ['catalogo', true],
    queryFn: () => api<ServicoCatalogo[]>('/catalogo-servicos?apenasAtivos=true'),
  })

  const boxes = useQuery({
    queryKey: ['boxes', true],
    queryFn: () => api<Box[]>('/boxes?apenasAtivos=true'),
  })

  const horasTotais = useMemo(
    () => servicos.reduce((soma, s) => soma + (s.horasEstimadas || 0), 0),
    [servicos],
  )

  const sugestoes = useQuery({
    queryKey: ['sugestao', horasTotais],
    queryFn: () => api<Sugestao[]>(`/capacidade/sugestao?horas=${horasTotais || 1}&quantidade=3`),
  })

  // primeira folga entra como padrao: um clique a menos na recepcao
  useEffect(() => {
    if (!dataAgendada && sugestoes.data && sugestoes.data.length > 0) {
      setDataAgendada(sugestoes.data[0].data)
    }
  }, [sugestoes.data, dataAgendada])

  const salvar = useMutation({
    mutationFn: () =>
      api<DetalheOs>('/os/check-in', {
        metodo: 'POST',
        corpo: {
          clienteId: cliente?.id,
          novoCliente: criandoCliente
            ? {
                nome: novoCliente.nome,
                telefone: novoCliente.telefone || undefined,
                documento: novoCliente.documento || undefined,
                email: novoCliente.email || undefined,
                consentimentoContato: true,
              }
            : undefined,
          veiculoId: veiculo?.id,
          novoVeiculo: criandoVeiculo
            ? {
                placa: novoVeiculo.placa,
                marca: novoVeiculo.marca || undefined,
                modelo: novoVeiculo.modelo || undefined,
                ano: novoVeiculo.ano ? Number(novoVeiculo.ano) : undefined,
                cor: novoVeiculo.cor || undefined,
                km: novoVeiculo.km ? Number(novoVeiculo.km) : undefined,
              }
            : undefined,
          queixa,
          prioridade,
          dataAgendada: dataAgendada || undefined,
          previsaoEntrega: previsaoEntrega || undefined,
          boxId: boxId || undefined,
          kmEntrada: novoVeiculo.km ? Number(novoVeiculo.km) : undefined,
          itens: servicos.map((s) => ({
            catalogoServicoId: s.catalogoServicoId,
            horasEstimadas: s.horasEstimadas,
          })),
        },
      }),
    onSuccess: (detalhe) => {
      avisar(`OS #${detalhe.resumo.numero} aberta para ${detalhe.resumo.placa}.`)
      navegar(`/os/${detalhe.resumo.id}`)
    },
    onError: (falha) =>
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível abrir a OS.'),
  })

  const selecionarCliente = (c: Cliente) => {
    setCliente(c)
    setCriandoCliente(false)
    setTermo('')
    if (c.veiculos.length === 1) {
      setVeiculo(c.veiculos[0])
    }
  }

  const limparCliente = () => {
    setCliente(null)
    setVeiculo(null)
    setCriandoCliente(false)
    setCriandoVeiculo(false)
  }

  const clientePronto = Boolean(cliente) || (criandoCliente && novoCliente.nome.trim().length > 2)
  const veiculoPronto =
    Boolean(veiculo) || (criandoVeiculo && novoVeiculo.placa.replace(/\W/g, '').length >= 6)
  const podeSalvar = clientePronto && veiculoPronto && queixa.trim().length > 2

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <header>
        <h1 className="text-lg font-semibold text-slate-900">Novo atendimento</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cliente, carro, problema e dia — em uma tela só. O sistema já sugere o primeiro dia com
          folga.
        </p>
      </header>

      {/* ---------------- 1. cliente ---------------- */}
      <Cartao>
        <CartaoTitulo
          titulo="1. Cliente"
          descricao="Busque por nome, telefone, documento ou placa"
          acao={
            cliente || criandoCliente ? (
              <Botao variante="fantasma" tamanho="sm" onClick={limparCliente}>
                <X className="size-3.5" aria-hidden />
                Trocar
              </Botao>
            ) : undefined
          }
        />
        <div className="p-4">
          {cliente ? (
            <div className="flex items-center gap-2">
              <span className="grid size-9 flex-none place-items-center rounded-full bg-marca-100 text-sm font-semibold text-marca-700">
                {cliente.nome.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{cliente.nome}</p>
                <p className="truncate text-xs text-slate-500">
                  {cliente.telefone ?? 'sem telefone'} · {cliente.veiculos.length} veículo(s)
                </p>
              </div>
              <Check className="ml-auto size-5 flex-none text-emerald-600" aria-hidden />
            </div>
          ) : criandoCliente ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome do cliente" obrigatorio>
                <Entrada
                  autoFocus
                  value={novoCliente.nome}
                  onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                  placeholder="Ex.: João da Silva"
                />
              </Campo>
              <Campo rotulo="Telefone" dica="Usado no botão de avisar pelo WhatsApp">
                <Entrada
                  value={novoCliente.telefone}
                  onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })}
                  placeholder="(11) 90000-0000"
                />
              </Campo>
              <Campo rotulo="CPF/CNPJ">
                <Entrada
                  value={novoCliente.documento}
                  onChange={(e) => setNovoCliente({ ...novoCliente, documento: e.target.value })}
                />
              </Campo>
              <Campo rotulo="E-mail">
                <Entrada
                  type="email"
                  value={novoCliente.email}
                  onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })}
                />
              </Campo>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Entrada
                  autoFocus
                  className="pl-9"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Nome, telefone ou placa..."
                />
              </div>

              {buscaPlaca.data && (
                <button
                  type="button"
                  onClick={async () => {
                    const c = await api<Cliente>(`/clientes/${buscaPlaca.data!.clienteId}`)
                    selecionarCliente(c)
                    setVeiculo({
                      id: buscaPlaca.data!.id,
                      placa: buscaPlaca.data!.placa,
                      descricao: buscaPlaca.data!.descricao,
                    })
                  }}
                  className="flex w-full items-center gap-2 rounded-lg bg-marca-50 p-2.5 text-left ring-1 ring-marca-200 hover:bg-marca-100"
                >
                  <Car className="size-4 flex-none text-marca-700" aria-hidden />
                  <span className="text-sm text-slate-800">
                    <span className="font-mono font-semibold">{buscaPlaca.data.placa}</span> —{' '}
                    {buscaPlaca.data.descricao} (já cadastrado)
                  </span>
                </button>
              )}

              {(buscaClientes.data ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selecionarCliente(c)}
                  className="flex w-full items-center gap-2 rounded-lg p-2.5 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {c.nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{c.nome}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {c.telefone ?? 'sem telefone'}
                      {c.veiculos.length > 0 &&
                        ` · ${c.veiculos.map((v) => v.placa).join(', ')}`}
                    </span>
                  </span>
                </button>
              ))}

              {termoBusca.length >= 2 &&
                !buscaClientes.isLoading &&
                (buscaClientes.data ?? []).length === 0 &&
                !buscaPlaca.data && (
                  <p className="text-xs text-slate-500">Nenhum cliente encontrado com esse termo.</p>
                )}

              <Botao
                variante="secundario"
                onClick={() => {
                  setCriandoCliente(true)
                  setNovoCliente({ ...novoCliente, nome: '' })
                }}
              >
                <UserPlus className="size-4" aria-hidden />
                Cadastrar cliente novo
              </Botao>
            </div>
          )}
        </div>
      </Cartao>

      {/* ---------------- 2. veiculo ---------------- */}
      {clientePronto && (
        <Cartao>
          <CartaoTitulo
            titulo="2. Veículo"
            descricao={
              criandoVeiculo ? 'Cadastro rápido — o resto pode ser preenchido depois' : undefined
            }
            acao={
              veiculo || criandoVeiculo ? (
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => {
                    setVeiculo(null)
                    setCriandoVeiculo(false)
                  }}
                >
                  <X className="size-3.5" aria-hidden />
                  Trocar
                </Botao>
              ) : undefined
            }
          />
          <div className="p-4">
            {veiculo ? (
              <div className="flex items-center gap-2">
                <Car className="size-5 flex-none text-slate-400" aria-hidden />
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-slate-900">{veiculo.placa}</p>
                  <p className="truncate text-xs text-slate-500">{veiculo.descricao}</p>
                </div>
                <Check className="ml-auto size-5 flex-none text-emerald-600" aria-hidden />
              </div>
            ) : criandoVeiculo ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Placa" obrigatorio>
                  <Entrada
                    autoFocus
                    className="font-mono uppercase"
                    value={novoVeiculo.placa}
                    onChange={(e) =>
                      setNovoVeiculo({ ...novoVeiculo, placa: e.target.value.toUpperCase() })
                    }
                    placeholder="ABC1D23"
                  />
                </Campo>
                <Campo rotulo="Marca">
                  <CampoMarca
                    valor={novoVeiculo.marca}
                    onChange={(marca) => setNovoVeiculo({ ...novoVeiculo, marca })}
                  />
                </Campo>
                <Campo rotulo="Modelo">
                  <Entrada
                    value={novoVeiculo.modelo}
                    onChange={(e) => setNovoVeiculo({ ...novoVeiculo, modelo: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Ano">
                  <Entrada
                    type="number"
                    value={novoVeiculo.ano}
                    onChange={(e) => setNovoVeiculo({ ...novoVeiculo, ano: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Cor">
                  <Entrada
                    value={novoVeiculo.cor}
                    onChange={(e) => setNovoVeiculo({ ...novoVeiculo, cor: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="KM de entrada">
                  <Entrada
                    type="number"
                    value={novoVeiculo.km}
                    onChange={(e) => setNovoVeiculo({ ...novoVeiculo, km: e.target.value })}
                  />
                </Campo>
              </div>
            ) : (
              <div className="space-y-2">
                {(cliente?.veiculos ?? []).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVeiculo(v)}
                    className="flex w-full items-center gap-2 rounded-lg p-2.5 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    <Car className="size-4 flex-none text-slate-400" aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-mono text-sm font-semibold text-slate-900">
                        {v.placa}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{v.descricao}</span>
                    </span>
                  </button>
                ))}
                <Botao variante="secundario" onClick={() => setCriandoVeiculo(true)}>
                  <Plus className="size-4" aria-hidden />
                  Cadastrar veículo novo
                </Botao>
              </div>
            )}
          </div>
        </Cartao>
      )}

      {/* ---------------- 3. problema e servicos ---------------- */}
      {veiculoPronto && (
        <Cartao>
          <CartaoTitulo titulo="3. O que o cliente relatou" />
          <div className="space-y-4 p-4">
            <Campo rotulo="Problema relatado" obrigatorio>
              <AreaTexto
                autoFocus
                value={queixa}
                onChange={(e) => setQueixa(e.target.value)}
                placeholder="Ex.: barulho na suspensão ao passar em lombada, e freio vibrando."
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Prioridade">
                <Selecao value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </Selecao>
              </Campo>
              <Campo rotulo="Entrega prometida" dica="Aparece como alerta se estourar">
                <Entrada
                  type="date"
                  value={previsaoEntrega}
                  onChange={(e) => setPrevisaoEntrega(e.target.value)}
                />
              </Campo>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-700">
                Serviços previstos
                {horasTotais > 0 && (
                  <span className="ml-2 font-normal text-slate-500">
                    {horas(horasTotais)} estimada(s)
                  </span>
                )}
              </p>

              {servicos.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {servicos.map((s, indice) => (
                    <div
                      key={`${s.catalogoServicoId}-${indice}`}
                      className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-slate-200"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                        {s.descricao}
                      </span>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        aria-label={`Horas estimadas para ${s.descricao}`}
                        value={s.horasEstimadas}
                        onChange={(e) =>
                          setServicos(
                            servicos.map((item, i) =>
                              i === indice
                                ? { ...item, horasEstimadas: Number(e.target.value) }
                                : item,
                            ),
                          )
                        }
                        className="w-20 rounded-md border-0 bg-white px-2 py-1 text-right text-xs ring-1 ring-slate-300 focus:ring-2 focus:ring-marca-600"
                      />
                      <span className="text-xs text-slate-400">h</span>
                      {s.valor !== undefined && (
                        <span className="w-24 text-right text-xs text-slate-500">
                          {moeda(s.valor)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setServicos(servicos.filter((_, i) => i !== indice))}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        aria-label={`Remover ${s.descricao}`}
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Selecao
                aria-label="Adicionar serviço do catálogo"
                value=""
                onChange={(e) => {
                  const escolhido = catalogo.data?.find((c) => c.id === e.target.value)
                  if (!escolhido) return
                  setServicos([
                    ...servicos,
                    {
                      catalogoServicoId: escolhido.id,
                      descricao: escolhido.descricao,
                      horasEstimadas: escolhido.horasPadrao,
                      valor: escolhido.precoSugerido,
                    },
                  ])
                }}
              >
                <option value="">+ Adicionar serviço do catálogo...</option>
                {(catalogo.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao} ({c.horasPadrao}h)
                  </option>
                ))}
              </Selecao>
              <p className="mt-1 text-xs text-slate-400">
                Dá para abrir a OS sem serviços e detalhar depois do diagnóstico.
              </p>
            </div>
          </div>
        </Cartao>
      )}

      {/* ---------------- 4. agenda ---------------- */}
      {veiculoPronto && (
        <Cartao>
          <CartaoTitulo
            titulo="4. Quando entra na oficina"
            descricao="Sugestões calculadas pela capacidade real: horas de mecânico, boxes livres e teto de carros"
          />
          <div className="space-y-4 p-4">
            {(sugestoes.data ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sugestoes.data!.map((s) => (
                  <button
                    key={s.data}
                    type="button"
                    onClick={() => setDataAgendada(s.data)}
                    className={cx(
                      'rounded-lg px-3 py-2 text-left text-xs ring-1 transition',
                      dataAgendada === s.data
                        ? 'bg-marca-600 text-white ring-marca-600'
                        : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <span className="flex items-center gap-1 font-medium capitalize">
                      {dataAgendada === s.data ? (
                        <Check className="size-3" aria-hidden />
                      ) : (
                        <Sparkles className="size-3" aria-hidden />
                      )}
                      {s.rotulo}
                    </span>
                    <span
                      className={cx(
                        'mt-0.5 block',
                        dataAgendada === s.data ? 'text-marca-100' : 'text-slate-500',
                      )}
                    >
                      {horas(s.horasLivres)} livres · {s.vagasLivres} vaga(s)
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Dia na agenda" dica="Deixe vazio para mandar para a fila de entrada">
                <Entrada
                  type="date"
                  value={dataAgendada}
                  onChange={(e) => setDataAgendada(e.target.value)}
                />
              </Campo>
              <Campo rotulo="Box / vaga">
                <Selecao value={boxId} onChange={(e) => setBoxId(e.target.value)}>
                  <option value="">Sem vaga definida</option>
                  {(boxes.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome}
                    </option>
                  ))}
                </Selecao>
              </Campo>
            </div>
          </div>
        </Cartao>
      )}

      <AvisoErro mensagem={erro} />

      {/* ---------------- barra de acao ---------------- */}
      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0 flex-1 text-xs text-slate-500">
          {podeSalvar ? (
            <>
              {cliente?.nome ?? novoCliente.nome} ·{' '}
              <span className="font-mono">{veiculo?.placa ?? novoVeiculo.placa}</span>
              {dataAgendada && ` · ${dataCompleta(dataAgendada)}`}
              {horasTotais > 0 && ` · ${horas(horasTotais)}`}
            </>
          ) : (
            'Preencha cliente, veículo e o problema relatado.'
          )}
        </div>
        <Botao
          tamanho="lg"
          disabled={!podeSalvar}
          carregando={salvar.isPending}
          onClick={() => {
            setErro(undefined)
            salvar.mutate()
          }}
        >
          <Check className="size-4" aria-hidden />
          Abrir OS e alocar
        </Botao>
      </div>
    </div>
  )
}
