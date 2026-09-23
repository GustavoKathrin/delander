import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Car, Check, Search, Sparkles, Trash2, X } from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import type {
  Cliente,
  DetalheOs,
  Funcionario,
  ServicoCatalogo,
  FilaElevador,
  Patio,
  Sugestao,
  Vaga,
  VeiculoResumo,
} from '../../types'
import {
  AreaTexto,
  AvisoErro,
  Botao,
  Campo,
  Entrada,
  Interruptor,
  Selecao,
  cx,
} from '../../components/ui'
import { CarroTopo, Placa } from '../../components/oficina'
import { CampoMarca } from '../../components/CampoMarca'
import { QuatroSemanas } from './QuatroSemanas'
import { horas, moeda } from '../../lib/format'

interface VeiculoPorPlaca {
  id: string
  clienteId: string
  clienteNome: string
  placa: string
  descricao: string
  cor?: string
}

type Alvo =
  | { tipo: 'existente'; veiculoId: string; clienteId: string; placa: string; descricao: string; cor?: string }
  | { tipo: 'novo'; placa: string }

/** Serviço fechado na hora do agendamento: tempo e preço saem daqui. */
interface ItemEscolhido {
  chave: string
  catalogoServicoId?: string
  descricao: string
  horas: number
  valor: number
  funcionarioId: string
  /** Veio do catalogo marcado como servico que sobe o carro. */
  exigeElevador?: boolean
}

const CORES = ['Branco', 'Prata', 'Preto', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Amarelo']

let sequencia = 0

/**
 * As duas etapas, ditas em voz alta.
 *
 * Na oficina o carro quase sempre NASCE aqui: o cliente liga, nunca esteve
 * antes, e cadastro e agendamento são o mesmo momento. Numerar as etapas é o
 * que deixa isso óbvio — antes o cadastro era um caminho que só aparecia se
 * você digitasse algo parecido com placa, e quem começava pelo nome do
 * cliente novo não achava porta nenhuma.
 */
function Etapa({
  numero,
  titulo,
  pronta,
  children,
}: {
  numero: number
  titulo: string
  pronta?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cx(
          'fonte-display grid size-6 flex-none place-items-center rounded-full text-xs font-extrabold',
          pronta ? 'bg-emerald-500 text-white' : 'bg-aco-800 text-white',
        )}
        aria-hidden
      >
        {pronta ? <Check className="size-3.5" /> : numero}
      </span>
      <h3 className="fonte-display text-xs font-bold uppercase tracking-widest text-slate-500">
        {titulo}
      </h3>
      {children}
    </div>
  )
}

export default function PainelAgendar({
  vagaIdInicial,
  dataInicial,
  vagas,
  resumo,
  onFechar,
  onAgendado,
}: {
  vagaIdInicial?: string
  dataInicial?: string
  vagas: Vaga[]
  /** Os contadores que o patio ja mostra na chapa, para a frase do telefone. */
  resumo?: Pick<Patio, 'vagasLivres' | 'vagasTotal' | 'proximaVagaLivreRotulo' | 'elevadores'>
  onFechar: () => void
  onAgendado: (placa: string) => void
}) {
  const [termo, setTermo] = useState('')
  const [busca, setBusca] = useState('')
  const [alvo, setAlvo] = useState<Alvo | null>(null)

  const [nomeCliente, setNomeCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno] = useState('')
  const [cor, setCor] = useState('Prata')

  const [queixa, setQueixa] = useState('')
  const [itens, setItens] = useState<ItemEscolhido[]>([])
  const [vagaId, setVagaId] = useState(vagaIdInicial ?? '')
  const [precisaElevador, setPrecisaElevador] = useState(false)
  const [elevadorId, setElevadorId] = useState('')
  const [elevadorInicio, setElevadorInicio] = useState('')
  const [elevadorHoras, setElevadorHoras] = useState(1)
  const [data, setData] = useState(dataInicial ?? '')
  const [erro, setErro] = useState<string>()

  useEffect(() => {
    const id = window.setTimeout(() => setBusca(termo.trim()), 300)
    return () => window.clearTimeout(id)
  }, [termo])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  const placaDigitada = busca.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const pareceplaca = placaDigitada.length >= 6 && /\d/.test(placaDigitada) && /[A-Z]/.test(placaDigitada)

  const porPlaca = useQuery({
    queryKey: ['agendar-placa', placaDigitada],
    queryFn: () =>
      api<VeiculoPorPlaca>(`/veiculos/placa/${encodeURIComponent(placaDigitada)}`).catch(() => null),
    enabled: pareceplaca && !alvo,
  })

  const porCliente = useQuery({
    queryKey: ['agendar-cliente', busca],
    queryFn: () => api<Cliente[]>(`/clientes/autocompletar?termo=${encodeURIComponent(busca)}`),
    enabled: busca.length >= 2 && !alvo,
  })

  const catalogo = useQuery({
    queryKey: ['catalogo', true],
    queryFn: () => api<ServicoCatalogo[]>('/catalogo-servicos?apenasAtivos=true'),
  })

  const funcionarios = useQuery({
    queryKey: ['funcionarios', true],
    queryFn: () => api<Funcionario[]>('/funcionarios?apenasAtivos=true'),
  })

  const horasTotais = useMemo(
    () => itens.reduce((soma, i) => soma + (Number(i.horas) || 0), 0),
    [itens],
  )

  const valorTotal = useMemo(
    () => itens.reduce((soma, i) => soma + (Number(i.valor) || 0), 0),
    [itens],
  )

  const elevadores = useMemo(() => vagas.filter((v) => v.tipo === 'ELEVADOR'), [vagas])

  /**
   * A frase que o dono le para o cliente no telefone, sem sair daqui:
   * "Patio 5 de 7 - proxima vaga qui 25/09 - elevador livre agora".
   *
   * Os numeros vem do proprio /patio, ja contados pelo servidor. Recontar
   * aqui criaria uma segunda verdade que um dia discordaria da chapa.
   */
  const resumoDoPatio = useMemo(() => {
    if (!resumo) return ''
    const partes = [`Pátio ${resumo.vagasLivres} de ${resumo.vagasTotal} livres`]
    if (resumo.vagasLivres === 0 && resumo.proximaVagaLivreRotulo) {
      partes.push(`próxima vaga ${resumo.proximaVagaLivreRotulo}`)
    }
    const elev = resumo.elevadores
    if (elev.total > 0) {
      partes.push(
        elev.livresAgora > 0
          ? `elevador livre agora (${elev.livresAgora} de ${elev.total})`
          : `elevador ${elev.proximoLivreRotulo || 'ocupado'}`,
      )
    }
    return partes.join(' · ')
  }, [resumo])

  /** Só consulta a fila quando o carro realmente vai subir. */
  const filaElevador = useQuery({
    queryKey: ['elevadores'],
    queryFn: () => api<FilaElevador>('/elevadores'),
    enabled: precisaElevador,
  })

  /**
   * As horas de elevador acompanham os serviços marcados como "exige elevador"
   * enquanto o usuário não digitar um valor próprio — quem sabe quanto tempo o
   * carro fica em cima é o mecânico, mas o padrão certo poupa um campo.
   */
  const horasDeElevadorSugeridas = useMemo(
    () =>
      itens
        .filter((i) => i.exigeElevador)
        .reduce((soma, i) => soma + (Number(i.horas) || 0), 0),
    [itens],
  )

  useEffect(() => {
    if (horasDeElevadorSugeridas > 0) {
      setPrecisaElevador(true)
      setElevadorHoras(horasDeElevadorSugeridas)
    }
  }, [horasDeElevadorSugeridas])

  const adicionarDoCatalogo = (s: ServicoCatalogo) =>
    setItens((atuais) => [
      ...atuais,
      {
        chave: `s${(sequencia += 1)}`,
        catalogoServicoId: s.id,
        descricao: s.descricao,
        horas: Number(s.horasPadrao) || 1,
        valor: Number(s.precoSugerido) || 0,
        funcionarioId: '',
        exigeElevador: s.exigeElevador,
      },
    ])

  const adicionarAvulso = () =>
    setItens((atuais) => [
      ...atuais,
      { chave: `s${(sequencia += 1)}`, descricao: '', horas: 1, valor: 0, funcionarioId: '' },
    ])

  const mudarItem = (chave: string, mudanca: Partial<ItemEscolhido>) =>
    setItens((atuais) => atuais.map((i) => (i.chave === chave ? { ...i, ...mudanca } : i)))

  const sugestoes = useQuery({
    queryKey: ['agendar-sugestao', horasTotais],
    queryFn: () => api<Sugestao[]>(`/capacidade/sugestao?horas=${horasTotais || 1}&quantidade=3`),
    enabled: Boolean(alvo),
  })

  useEffect(() => {
    if (!data && sugestoes.data && sugestoes.data.length > 0) {
      setData(sugestoes.data[0].data)
    }
  }, [sugestoes.data, data])

  const salvar = useMutation({
    mutationFn: () =>
      api<DetalheOs>('/os/check-in', {
        metodo: 'POST',
        corpo: {
          ...(alvo?.tipo === 'existente'
            ? { clienteId: alvo.clienteId, veiculoId: alvo.veiculoId }
            : {
                novoCliente: {
                  nome: nomeCliente,
                  telefone: telefone || undefined,
                  consentimentoContato: true,
                },
                novoVeiculo: {
                  placa: alvo?.placa,
                  marca: marca || undefined,
                  modelo: modelo || undefined,
                  ano: ano ? Number(ano) : undefined,
                  cor,
                },
              }),
          queixa,
          dataAgendada: data || undefined,
          boxId: vagaId || undefined,
          itens: itens
            .filter((i) => i.catalogoServicoId || i.descricao.trim().length > 1)
            .map((i) => ({
              catalogoServicoId: i.catalogoServicoId,
              descricao: i.descricao || undefined,
              horasEstimadas: Number(i.horas) || undefined,
              valor: Number(i.valor) || undefined,
              funcionarioId: i.funcionarioId || undefined,
            })),
          precisaElevador,
          elevadorBoxId: precisaElevador ? elevadorId || undefined : undefined,
          elevadorInicio:
            precisaElevador && elevadorId && elevadorInicio
              ? new Date(elevadorInicio).toISOString()
              : undefined,
          elevadorHoras: precisaElevador ? elevadorHoras : undefined,
        },
      }),
    onSuccess: (detalhe) => onAgendado(detalhe.resumo.placa),
    onError: (falha) =>
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível agendar.'),
  })

  /**
   * O cadastro do carro novo tem que fechar antes de agendar: placa curta o
   * servidor recusa, e descobrir isso depois de preencher serviço e dia seria
   * fazer a pessoa voltar do fim da tela.
   */
  const cadastroCompleto =
    alvo?.tipo === 'existente' ||
    (alvo?.tipo === 'novo' && alvo.placa.length >= 6 && nomeCliente.trim().length > 2)

  const prontoParaAgendar = Boolean(alvo) && cadastroCompleto && queixa.trim().length > 2

  const vagaEscolhida = vagas.find((v) => v.id === vagaId)

  /**
   * O aviso só aparece quando o dia escolhido realmente esbarra em outro carro.
   * Marcar para o dia em que a vaga libera é o uso normal — avisar ali seria
   * ruído, e ruído constante é aviso que ninguem le.
   */
  const avisoDaVaga = useMemo(() => {
    if (!vagaEscolhida?.ocupante || !vagaEscolhida.liberaEm || !data) return undefined
    const { nome, ocupante, liberaEm, liberaEmRotulo, situacao } = vagaEscolhida

    // Reservada = vazia hoje, com dono a partir de liberaEm. Ocupada = o contrario.
    if (situacao === 'RESERVADO') {
      return data >= liberaEm
        ? `O ${nome} já está reservado para o ${ocupante.placa}, que chega ${liberaEmRotulo}.`
        : undefined
    }
    return data < liberaEm
      ? `O ${nome} está com o ${ocupante.placa} e só libera ${liberaEmRotulo}.`
      : undefined
  }, [vagaEscolhida, data])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-aco-900/60" onClick={onFechar} aria-hidden />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Agendar carro"
        className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
      >
        <header className="chapa flex items-center gap-3 px-4 py-3">
          <h2 className="fonte-display text-base font-extrabold uppercase tracking-wider text-white">
            Agendar carro
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="ml-auto rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {/* A frase que o dono lê para o cliente no telefone, sem sair daqui. */}
        {resumoDoPatio && (
          <p className="bg-aco-900 px-4 py-1.5 text-[11px] text-zinc-300">{resumoDoPatio}</p>
        )}

        <div className="faixa-seguranca h-1" aria-hidden />

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* ---------------- 1. cliente e carro ---------------- */}
          <Etapa numero={1} titulo="Cliente e carro" pronta={cadastroCompleto} />

          {!alvo ? (
            <div className="space-y-3">
              <Campo rotulo="Placa ou nome do cliente" obrigatorio>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Entrada
                    autoFocus
                    className="pl-9 uppercase"
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                    placeholder="ABC1D23 ou João"
                  />
                </div>
              </Campo>

              {porPlaca.data && (
                <button
                  type="button"
                  onClick={() =>
                    setAlvo({
                      tipo: 'existente',
                      veiculoId: porPlaca.data!.id,
                      clienteId: porPlaca.data!.clienteId,
                      placa: porPlaca.data!.placa,
                      descricao: porPlaca.data!.descricao,
                      cor: porPlaca.data!.cor,
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-lg bg-marca-50 p-3 text-left ring-1 ring-marca-200 hover:bg-marca-100"
                >
                  <CarroTopo cor={porPlaca.data.cor} largura={24} />
                  <span className="min-w-0">
                    <Placa placa={porPlaca.data.placa} tamanho="sm" />
                    <span className="mt-0.5 block truncate text-xs text-slate-600">
                      {porPlaca.data.descricao} · {porPlaca.data.clienteNome}
                    </span>
                  </span>
                </button>
              )}

              {(porCliente.data ?? []).map((c) =>
                c.veiculos.map((v: VeiculoResumo) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() =>
                      setAlvo({
                        tipo: 'existente',
                        veiculoId: v.id,
                        clienteId: c.id,
                        placa: v.placa,
                        descricao: v.descricao,
                        cor: v.cor,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    <CarroTopo cor={v.cor} largura={22} />
                    <span className="min-w-0">
                      <Placa placa={v.placa} tamanho="sm" />
                      <span className="mt-0.5 block truncate text-xs text-slate-600">
                        {v.descricao} · {c.nome}
                      </span>
                    </span>
                  </button>
                )),
              )}

              {busca.length >= 2 &&
                !pareceplaca &&
                (porCliente.data ?? []).length === 0 &&
                !porCliente.isLoading && (
                  <p className="text-xs text-slate-500">
                    Ninguém com esse nome. Cadastre o cliente e o carro aqui embaixo.
                  </p>
                )}

              {/* Sempre visível, não só quando o que foi digitado parece placa:
                  na maioria das vezes o carro nasce neste momento, e quem
                  começa pelo nome do cliente novo precisa de porta também. */}
              {!(pareceplaca && porPlaca.data) && (
                <button
                  type="button"
                  onClick={() => setAlvo({ tipo: 'novo', placa: pareceplaca ? placaDigitada : '' })}
                  className="flex w-full items-center gap-3 rounded-lg bg-faixa/15 p-3 text-left ring-1 ring-faixa hover:bg-faixa/25"
                >
                  <Car className="size-5 flex-none text-aco-800" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">
                      {pareceplaca && !porPlaca.isLoading && !porPlaca.data
                        ? `Cadastrar ${placaDigitada} agora`
                        : 'Cliente e carro novos — cadastrar agora'}
                    </span>
                    <span className="block text-xs text-slate-600">
                      placa, nome e telefone. O resto dá para completar depois.
                    </span>
                  </span>
                </button>
              )}

              {/* A pergunta do cliente ao telefone é "quando dá?", e ela vem
                  antes da placa. O mês aparece já na abertura do painel; o dia
                  escolhido aqui segue para a etapa da vaga. */}
              <QuatroSemanas escolhido={data} onEscolher={setData} />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
              <CarroTopo cor={alvo.tipo === 'existente' ? alvo.cor : cor} largura={26} />
              <div className="min-w-0 flex-1">
                {/* Carro novo ainda sem placa digitada: a placa de verdade
                    está no campo logo abaixo, e mostrar uma vazia aqui só
                    daria a impressão de que algo se perdeu. */}
                {alvo.tipo === 'existente' || alvo.placa ? (
                  <Placa placa={alvo.placa || '—'} tamanho="sm" />
                ) : (
                  <p className="text-sm font-semibold text-slate-900">Cadastro novo</p>
                )}
                <p className="mt-0.5 truncate text-xs text-slate-600">
                  {alvo.tipo === 'existente'
                    ? alvo.descricao
                    : [nomeCliente, marca, modelo].filter(Boolean).join(' · ') ||
                      'preencha abaixo'}
                </p>
              </div>
              <Botao
                variante="fantasma"
                tamanho="sm"
                onClick={() => {
                  setAlvo(null)
                  setTermo('')
                }}
              >
                Trocar
              </Botao>
            </div>
          )}

          {/* ---------------- cadastro do cliente e do carro ---------------- */}
          {alvo?.tipo === 'novo' && (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo
                  rotulo="Placa"
                  obrigatorio
                  dica="Dá para corrigir aqui mesmo — não precisa voltar."
                >
                  <Entrada
                    autoFocus={!alvo.placa}
                    className="uppercase"
                    value={alvo.placa}
                    onChange={(e) =>
                      setAlvo({
                        tipo: 'novo',
                        placa: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      })
                    }
                    placeholder="ABC1D23"
                  />
                </Campo>
              </div>
              <div className="sm:col-span-2">
                <Campo rotulo="Nome do cliente" obrigatorio>
                  <Entrada
                    autoFocus={Boolean(alvo.placa)}
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                  />
                </Campo>
              </div>
              <Campo rotulo="Telefone" dica="É por onde o link de acompanhamento chega.">
                <Entrada value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </Campo>
              <Campo rotulo="Cor" dica="É ela que pinta o carro na planta">
                <Selecao value={cor} onChange={(e) => setCor(e.target.value)}>
                  {CORES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo rotulo="Marca">
                <CampoMarca valor={marca} onChange={setMarca} />
              </Campo>
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <Campo rotulo="Modelo">
                  <Entrada
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Civic"
                  />
                </Campo>
                {/* O ano é o que liga este carro às leituras do modelo. */}
                <Campo rotulo="Ano">
                  <Entrada
                    type="number"
                    min="1950"
                    max="2100"
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                  />
                </Campo>
              </div>
            </div>
          )}

          {/* ---------------- 2. serviço e dia ---------------- */}
          {alvo && (
            <>
              <div className="border-t border-slate-200 pt-4">
                <Etapa numero={2} titulo="Serviço e dia" pronta={prontoParaAgendar} />
              </div>

              <Campo rotulo="O que o cliente falou" obrigatorio>
                <AreaTexto
                  rows={2}
                  value={queixa}
                  onChange={(e) => setQueixa(e.target.value)}
                  placeholder="Ex.: barulho na suspensão ao passar em lombada"
                />
              </Campo>

              {/* ---------------- serviços: tempo e preço fechados aqui ---------------- */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-700">
                  Serviços a fazer
                  <span className="ml-1 font-normal text-slate-400">
                    (o valor daqui vira o orçamento da OS)
                  </span>
                </p>

                {itens.length > 0 && (
                  <div className="mb-2 space-y-2">
                    {itens.map((item) => (
                      <div
                        key={item.chave}
                        className="rounded-lg bg-white p-2 ring-1 ring-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <Entrada
                            className="h-8 flex-1 py-1 text-xs"
                            value={item.descricao}
                            placeholder="Descreva o serviço"
                            onChange={(e) => mudarItem(item.chave, { descricao: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItens((atuais) => atuais.filter((i) => i.chave !== item.chave))
                            }
                            aria-label={`Remover ${item.descricao || 'serviço'}`}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>

                        <div className="mt-1.5 grid grid-cols-[72px_96px_1fr] gap-2">
                          <label className="block">
                            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">
                              Horas
                            </span>
                            <Entrada
                              type="number"
                              step="0.25"
                              min="0"
                              className="h-8 py-1 text-xs"
                              value={item.horas}
                              onChange={(e) =>
                                mudarItem(item.chave, { horas: Number(e.target.value) })
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">
                              Valor R$
                            </span>
                            <Entrada
                              type="number"
                              step="10"
                              min="0"
                              className="h-8 py-1 text-xs"
                              value={item.valor}
                              onChange={(e) =>
                                mudarItem(item.chave, { valor: Number(e.target.value) })
                              }
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">
                              Mecânico
                            </span>
                            <Selecao
                              className="h-8 py-1 text-xs"
                              value={item.funcionarioId}
                              onChange={(e) =>
                                mudarItem(item.chave, { funcionarioId: e.target.value })
                              }
                            >
                              <option value="">Definir depois</option>
                              {(funcionarios.data ?? []).map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.nome}
                                </option>
                              ))}
                            </Selecao>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {(catalogo.data ?? []).slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => adicionarDoCatalogo(s)}
                      className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
                    >
                      + {s.descricao} · {s.horasPadrao}h
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={adicionarAvulso}
                    className="rounded-full bg-aco-800 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-aco-700"
                  >
                    + Serviço avulso
                  </button>
                </div>

                {itens.length > 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-aco-800 px-3 py-2">
                    <span className="text-[11px] uppercase tracking-widest text-zinc-400">
                      Orçamento
                    </span>
                    <span className="fonte-display text-right">
                      <span className="block text-lg font-extrabold leading-none text-faixa">
                        {moeda(valorTotal)}
                      </span>
                      <span className="block text-[11px] text-zinc-400">
                        {horas(horasTotais)} de serviço
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* ---------------- 3. vaga e dia ---------------- */}
              <div className="space-y-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                {/* Como está o mês inteiro. Clicar num dia já escolhe a data. */}
                <QuatroSemanas escolhido={data} onEscolher={setData} />

                {(sugestoes.data ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {/* Os chips respondem "onde cabe ESTE serviço"; a faixa
                        acima responde "como está o mês". São perguntas
                        diferentes, e por isso os dois continuam. */}
                    {sugestoes.data!.map((s) => (
                      <button
                        key={s.data}
                        type="button"
                        onClick={() => setData(s.data)}
                        className={cx(
                          'rounded-lg px-2.5 py-1.5 text-left text-[11px] ring-1 transition',
                          data === s.data
                            ? 'bg-marca-600 text-white ring-marca-600'
                            : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                        )}
                      >
                        <span className="flex items-center gap-1 font-semibold capitalize">
                          {data === s.data ? (
                            <Check className="size-3" aria-hidden />
                          ) : (
                            <Sparkles className="size-3" aria-hidden />
                          )}
                          {s.rotulo}
                        </span>
                        <span
                          className={cx(
                            'block',
                            data === s.data ? 'text-marca-100' : 'text-slate-500',
                          )}
                        >
                          {horas(s.horasLivres)} livres
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Dia">
                    <Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </Campo>
                  <Campo rotulo="Vaga">
                    <Selecao value={vagaId} onChange={(e) => setVagaId(e.target.value)}>
                      <option value="">Definir depois</option>
                      {vagas.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome} ({rotuloDaVaga(v)})
                        </option>
                      ))}
                    </Selecao>
                  </Campo>
                </div>

                {avisoDaVaga && <p className="text-[11px] text-amber-700">{avisoDaVaga}</p>}

                {/* ---------------------------------------------- elevador */}
                <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
                  <Interruptor
                    ativo={precisaElevador}
                    onChange={setPrecisaElevador}
                    rotulo="Precisa de elevador"
                    descricao="Um carro por elevador de cada vez. Marque para já reservar o horário."
                  />

                  {precisaElevador && (
                    <div className="space-y-2 border-t border-slate-200 pb-3 pt-2">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Campo rotulo="Elevador">
                          <Selecao
                            value={elevadorId}
                            onChange={(e) => setElevadorId(e.target.value)}
                          >
                            <option value="">Definir depois</option>
                            {elevadores.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.nome}
                              </option>
                            ))}
                          </Selecao>
                        </Campo>
                        <Campo rotulo="Sobe às">
                          <Entrada
                            type="datetime-local"
                            value={elevadorInicio}
                            onChange={(e) => setElevadorInicio(e.target.value)}
                          />
                        </Campo>
                        <Campo rotulo="Horas em cima">
                          <Entrada
                            type="number"
                            min="0.25"
                            step="0.25"
                            value={elevadorHoras}
                            onChange={(e) => setElevadorHoras(Number(e.target.value))}
                          />
                        </Campo>
                      </div>

                      {elevadores.length === 0 ? (
                        <p className="text-[11px] text-amber-700">
                          Nenhum elevador cadastrado. Ajuste em Configurações › Capacidade.
                        </p>
                      ) : filaElevador.data && filaElevador.data.itens.length > 0 ? (
                        <div className="rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-200">
                          <p className="text-[11px] font-semibold text-slate-700">
                            {filaElevador.data.itens.length} carro(s) na frente ·{' '}
                            <span className="capitalize">
                              {filaElevador.data.proximoLivreRotulo}
                            </span>
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {filaElevador.data.itens.slice(0, 4).map((i) => (
                              <li
                                key={i.os.id}
                                className="flex items-center gap-1.5 text-[11px] text-slate-500"
                              >
                                <span className="font-bold text-slate-400">{i.posicao}º</span>
                                <span className="font-mono font-semibold text-slate-700">
                                  {i.os.placa}
                                </span>
                                <span className="capitalize">{i.rotulo}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-[11px] text-emerald-700">
                          Nenhum carro na fila do elevador — sobe assim que chegar.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <AvisoErro mensagem={erro} />
            </>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white p-3">
          <button
            type="button"
            disabled={!prontoParaAgendar || salvar.isPending}
            onClick={() => {
              setErro(undefined)
              salvar.mutate()
            }}
            className="fonte-display h-12 w-full rounded-md bg-faixa text-sm font-extrabold uppercase tracking-wider sobre-destaque shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {salvar.isPending
              ? 'Agendando...'
              : /* Botão apagado sem dizer por quê faz a pessoa caçar o campo
                   que falta. Aqui ele mesmo diz qual é. */
                !alvo
                ? 'Escolha ou cadastre o carro'
                : !cadastroCompleto
                  ? 'Falta a placa e o nome do cliente'
                  : queixa.trim().length <= 2
                    ? 'Falta o que o cliente falou'
                    : 'Agendar'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

/**
 * O rotulo do backend ja traz o verbo ("chega qui 24/09", "amanha", "atrasado"),
 * entao concatenar "livre" na frente produzia "livre chega qui 24/09". Aqui cada
 * situacao ganha a frase certa — o dono le a lista sem traduzir nada.
 */
function rotuloDaVaga(v: Vaga): string {
  if (!v.ocupante) return 'livre'
  if (v.situacao === 'RESERVADO') return `livre hoje, ${v.liberaEmRotulo}`
  if (v.liberaEmRotulo === 'atrasado') return `ocupada, previsão vencida`
  return `livre ${v.liberaEmRotulo}`
}
