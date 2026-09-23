import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Settings2, Sliders } from 'lucide-react'
import { api } from '../../api/client'
import type { Box, ConfiguracaoItem, Especialidade, MotivoParada, ServicoCatalogo } from '../../types'
import {
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
  cx,
  useAviso,
} from '../../components/ui'
import { CHAVES, useConfig } from '../../lib/config'
import { claro } from '../../components/oficina'
import { GRUPOS, ROTULOS } from './rotulos'

// Toda aba daqui precisa da entrada correspondente em GRUPOS (rotulos.ts):
// o render usa GRUPOS.find(...)! e quebraria em tela branca sem ela.
type Aba =
  | 'CAPACIDADE'
  | 'FLUXO'
  | 'COMPARTILHAMENTO'
  | 'ALERTAS'
  | 'INTEGRACAO'
  | 'APARENCIA'
  | 'CADASTROS'

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'CAPACIDADE', rotulo: 'Capacidade' },
  { chave: 'FLUXO', rotulo: 'Fluxo' },
  { chave: 'COMPARTILHAMENTO', rotulo: 'Cliente' },
  { chave: 'ALERTAS', rotulo: 'Alertas' },
  { chave: 'INTEGRACAO', rotulo: 'E-mail' },
  { chave: 'CADASTROS', rotulo: 'Cadastros' },
  { chave: 'APARENCIA', rotulo: 'Aparência' },
]

export default function Configuracoes() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const { recarregar } = useConfig()

  const [aba, setAba] = useState<Aba>('CAPACIDADE')
  const [alterados, setAlterados] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string>()

  const consulta = useQuery({
    queryKey: ['configuracoes-lista'],
    queryFn: () => api<ConfiguracaoItem[]>('/configuracoes'),
  })

  const valores = useMemo(() => {
    const mapa: Record<string, string> = {}
    consulta.data?.forEach((item) => {
      mapa[item.chave] = item.valor ?? ''
    })
    return { ...mapa, ...alterados }
  }, [consulta.data, alterados])

  const salvar = useMutation({
    mutationFn: () => api('/configuracoes', { metodo: 'PUT', corpo: { valores: alterados } }),
    onSuccess: () => {
      setAlterados({})
      setErro(undefined)
      void queryClient.invalidateQueries({ queryKey: ['configuracoes-lista'] })
      void queryClient.invalidateQueries({ queryKey: ['configuracoes'] })
      void queryClient.invalidateQueries({ queryKey: ['quadro'] })
      // mudar a quantidade de elevadores cria ou desativa vagas: a planta e o
      // cadastro de boxes ficariam mostrando o mundo de antes
      void queryClient.invalidateQueries({ queryKey: ['boxes'] })
      void queryClient.invalidateQueries({ queryKey: ['patio'] })
      void queryClient.invalidateQueries({ queryKey: ['elevadores'] })
      recarregar()
      avisar('Configurações salvas.')
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  const mudar = (chave: string, valor: string) =>
    setAlterados((atuais) => ({ ...atuais, [chave]: valor }))

  if (consulta.isLoading) return <Carregando texto="Carregando configurações..." />

  // O servidor devolve por chave, em ordem alfabética. Quando o rótulo diz
  // em que ordem a pessoa lê (a chave geral antes do que ela controla), é
  // essa que vale — chave ligada no meio da lista não parece chave geral.
  const itensDoGrupo = (grupo: string) =>
    (consulta.data ?? [])
      .filter((item) => item.grupo === grupo)
      .sort((a, b) => (ROTULOS[a.chave]?.ordem ?? 99) - (ROTULOS[b.chave]?.ordem ?? 99))

  const pendentes = Object.keys(alterados).length

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-24">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Settings2 className="size-5 text-slate-400" aria-hidden />
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Quase tudo no sistema é "vai ou não vai". O que você desligar aqui desaparece das telas —
          sem opção morta na interface.
        </p>
      </header>

      <div className="flex gap-1 overflow-x-auto rolagem-suave border-b border-slate-200">
        {ABAS.map((item) => (
          <button
            key={item.chave}
            type="button"
            onClick={() => setAba(item.chave)}
            className={cx(
              'flex-none border-b-2 px-3 py-2 text-sm transition',
              aba === item.chave
                ? 'border-marca-600 font-medium text-marca-700'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {aba === 'CADASTROS' ? (
        <Cadastros />
      ) : (
        (() => {
          const grupo = GRUPOS.find((g) => g.chave === aba)!
          const itens = itensDoGrupo(aba)
          return (
            <Cartao>
              <CartaoTitulo titulo={grupo.titulo} descricao={grupo.descricao} />
              <div className="divide-y divide-slate-100 px-4">
                {itens.map((item) => {
                  const rotulo = ROTULOS[item.chave] ?? { rotulo: item.chave }
                  const valor = valores[item.chave] ?? ''

                  if (item.tipo === 'BOOLEAN') {
                    return (
                      <Interruptor
                        key={item.chave}
                        ativo={valor === 'true'}
                        rotulo={rotulo.rotulo}
                        descricao={rotulo.descricao}
                        onChange={(ligado) => mudar(item.chave, String(ligado))}
                      />
                    )
                  }

                  // Cor não é um tipo no banco (o check só aceita seis): quem
                  // sabe que esta chave guarda uma cor é o rótulo, aqui na tela.
                  if (rotulo.cor) {
                    const hex = /^#[0-9a-f]{6}$/i.test(valor) ? valor : '#000000'
                    return (
                      <div key={item.chave} className="py-3">
                        <Campo rotulo={rotulo.rotulo} dica={rotulo.descricao}>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={hex}
                              onChange={(e) => mudar(item.chave, e.target.value)}
                              className="size-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                              aria-label={rotulo.rotulo}
                            />
                            <Entrada
                              className="w-32 font-mono"
                              value={valor}
                              onChange={(e) => mudar(item.chave, e.target.value)}
                            />
                            {/* mostra como vai ficar, já com o texto que o
                                contraste escolher — é o que evita botão ilegível */}
                            <span
                              className="fonte-display rounded px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider"
                              style={{ backgroundColor: hex, color: claro(hex) ? '#18181b' : '#ffffff' }}
                            >
                              exemplo
                            </span>
                          </div>
                        </Campo>
                      </div>
                    )
                  }

                  return (
                    <div key={item.chave} className="py-3">
                      <Campo rotulo={rotulo.rotulo} dica={rotulo.descricao}>
                        <div className="flex items-center gap-2">
                          <Entrada
                            // Texto pode ser uma lista de e-mails; número e
                            // hora cabem folgados num campo curto.
                            className={item.tipo === 'TEXTO' ? 'max-w-md' : 'max-w-xs'}
                            type={
                              item.tipo === 'INTEIRO' || item.tipo === 'DECIMAL'
                                ? 'number'
                                : item.tipo === 'HORA'
                                  ? 'time'
                                  : 'text'
                            }
                            step={item.tipo === 'DECIMAL' ? '0.5' : undefined}
                            min={item.tipo === 'INTEIRO' || item.tipo === 'DECIMAL' ? '0' : undefined}
                            value={valor}
                            onChange={(e) => mudar(item.chave, e.target.value)}
                          />
                          {rotulo.unidade && (
                            <span className="text-xs text-slate-500">{rotulo.unidade}</span>
                          )}
                        </div>
                      </Campo>
                    </div>
                  )
                })}
              </div>
            </Cartao>
          )
        })()
      )}

      <AvisoErro mensagem={erro} />

      {pendentes > 0 && (
        <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <p className="flex-1 text-xs text-slate-500">
            {pendentes} alteração(ões) não salva(s).
          </p>
          <Botao variante="secundario" onClick={() => setAlterados({})}>
            Descartar
          </Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            <Save className="size-4" aria-hidden />
            Salvar
          </Botao>
        </div>
      )}
    </div>
  )
}

// ================================================================ cadastros

type TipoCadastro = 'especialidades' | 'boxes' | 'motivos' | 'catalogo' | 'marcas'

function Cadastros() {
  const [tipo, setTipo] = useState<TipoCadastro>('especialidades')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['especialidades', 'Especialidades'],
            ['boxes', 'Boxes e vagas'],
            ['motivos', 'Motivos de parada'],
            ['catalogo', 'Catálogo de serviços'],
            ['marcas', 'Marcas de veículo'],
          ] as [TipoCadastro, string][]
        ).map(([chave, rotulo]) => (
          <Botao
            key={chave}
            tamanho="sm"
            variante={tipo === chave ? 'primario' : 'secundario'}
            onClick={() => setTipo(chave)}
          >
            {rotulo}
          </Botao>
        ))}
      </div>

      {tipo === 'especialidades' && <Especialidades />}
      {tipo === 'boxes' && <Boxes />}
      {tipo === 'motivos' && <Motivos />}
      {tipo === 'catalogo' && <Catalogo />}
      {tipo === 'marcas' && <Marcas />}
    </div>
  )
}

/**
 * As marcas que aparecem no combo ao cadastrar um carro.
 *
 * Guardadas numa configuração de texto, separadas por vírgula — marca não
 * tem atributo nenhum além do nome. Mas editar uma lista assim num campo de
 * texto cru é péssimo, então aqui ela vira ficha: some com o X, entra pelo
 * Enter. O que vai para o banco continua sendo a linha de texto.
 */
function Marcas() {
  const avisar = useAviso()
  const { lista, recarregar } = useConfig()
  const salvas = lista(CHAVES.marcasVeiculo)

  const [marcas, setMarcas] = useState<string[]>(salvas)
  const [nova, setNova] = useState('')

  // A lista do servidor chega depois do primeiro render; sem isto a tela
  // abriria vazia e salvar apagaria tudo.
  useEffect(() => setMarcas(salvas), [salvas.join(',')])

  const mudou = marcas.join(',') !== salvas.join(',')

  const salvar = useMutation({
    mutationFn: () =>
      api('/configuracoes', {
        metodo: 'PUT',
        corpo: { valores: { [CHAVES.marcasVeiculo]: marcas.join(',') } },
      }),
    onSuccess: () => {
      recarregar()
      avisar('Marcas salvas.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const adicionar = () => {
    const limpa = nova.trim().replace(/,/g, ' ')
    if (limpa.length < 2) return
    // Repetida não entra: duas "Honda" no combo só confundem.
    if (marcas.some((m) => m.toLowerCase() === limpa.toLowerCase())) {
      avisar(`${limpa} já está na lista.`, 'erro')
      setNova('')
      return
    }
    setMarcas((atuais) => [...atuais, limpa])
    setNova('')
  }

  return (
    <Cartao>
      <CartaoTitulo
        titulo="Marcas de veículo"
        descricao="O que aparece no combo ao cadastrar um carro. Quem cadastra ainda pode digitar uma marca fora da lista — nenhum carro fica de fora por causa disto."
      />

      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <Entrada
            className="max-w-xs"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                adicionar()
              }
            }}
            placeholder="Nova marca e Enter"
          />
          <Botao variante="secundario" onClick={adicionar}>
            Incluir
          </Botao>
        </div>

        {marcas.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma marca na lista. Enquanto estiver assim, o campo de marca volta a ser
            digitado à mão.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {marcas.map((m) => (
              <li
                key={m}
                className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700"
              >
                {m}
                <button
                  type="button"
                  onClick={() => setMarcas((atuais) => atuais.filter((x) => x !== m))}
                  className="grid size-5 place-items-center rounded-full text-slate-400 hover:bg-slate-300 hover:text-slate-700"
                  aria-label={`Tirar ${m} da lista`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {mudou && (
          <div className="flex items-center gap-3 border-t border-slate-200 pt-3">
            <p className="flex-1 text-xs text-slate-500">{marcas.length} marca(s) na lista.</p>
            <Botao variante="secundario" onClick={() => setMarcas(salvas)}>
              Descartar
            </Botao>
            <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
              <Save className="size-4" aria-hidden />
              Salvar
            </Botao>
          </div>
        )}
      </div>
    </Cartao>
  )
}

function Especialidades() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<Especialidade | null>(null)
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#64748b')
  const [ativo, setAtivo] = useState(true)

  const lista = useQuery({
    queryKey: ['especialidades', false],
    queryFn: () => api<Especialidade[]>('/especialidades'),
  })

  useEffect(() => {
    setNome(editando?.nome ?? '')
    setCor(editando?.cor ?? '#64748b')
    setAtivo(editando?.ativo ?? true)
  }, [editando, criando])

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { nome, cor, ativo }
      return editando
        ? api(`/especialidades/${editando.id}`, { metodo: 'PUT', corpo })
        : api('/especialidades', { metodo: 'POST', corpo })
    },
    onSuccess: () => {
      setEditando(null)
      setCriando(false)
      void queryClient.invalidateQueries({ queryKey: ['especialidades'] })
      avisar('Especialidade salva.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  return (
    <Cartao>
      <CartaoTitulo
        titulo="Especialidades"
        descricao="Áreas técnicas da oficina. Definem quem pode assumir cada serviço."
        acao={
          <Botao tamanho="sm" onClick={() => setCriando(true)}>
            Nova
          </Botao>
        }
      />
      <ul className="divide-y divide-slate-100">
        {(lista.data ?? []).map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className="size-4 flex-none rounded-full ring-1 ring-slate-200"
              style={{ backgroundColor: e.cor }}
              aria-hidden
            />
            <span className={cx('flex-1 text-sm', e.ativo ? 'text-slate-800' : 'text-slate-400')}>
              {e.nome}
            </span>
            {!e.ativo && <Etiqueta className="bg-slate-100 text-slate-500 ring-slate-200">Inativa</Etiqueta>}
            <Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(e)}>
              Editar
            </Botao>
          </li>
        ))}
      </ul>

      <Modal
        aberto={criando || editando !== null}
        onFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        titulo={editando ? 'Editar especialidade' : 'Nova especialidade'}
        rodape={
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Botao>
        }
      >
        <div className="space-y-3">
          <Campo rotulo="Nome" obrigatorio>
            <Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo rotulo="Cor" dica="Usada nas etiquetas do quadro">
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="h-10 w-20 cursor-pointer rounded-lg ring-1 ring-slate-300"
              aria-label="Cor da especialidade"
            />
          </Campo>
          <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
            <Interruptor ativo={ativo} rotulo="Ativa" onChange={setAtivo} />
          </div>
        </div>
      </Modal>
    </Cartao>
  )
}

function Boxes() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<Box | null>(null)
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('BOX')
  const [ativo, setAtivo] = useState(true)

  const lista = useQuery({ queryKey: ['boxes', false], queryFn: () => api<Box[]>('/boxes') })

  useEffect(() => {
    setNome(editando?.nome ?? '')
    setTipo(editando?.tipo ?? 'BOX')
    setAtivo(editando?.ativo ?? true)
  }, [editando, criando])

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { nome, tipo, ativo }
      return editando
        ? api(`/boxes/${editando.id}`, { metodo: 'PUT', corpo })
        : api('/boxes', { metodo: 'POST', corpo })
    },
    onSuccess: () => {
      setEditando(null)
      setCriando(false)
      void queryClient.invalidateQueries({ queryKey: ['boxes'] })
      void queryClient.invalidateQueries({ queryKey: ['quadro'] })
      avisar('Box salvo.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const ativos = (lista.data ?? []).filter((b) => b.ativo).length

  return (
    <Cartao>
      <CartaoTitulo
        titulo="Boxes e vagas"
        descricao={`${ativos} vaga(s) ativa(s). É a capacidade física que o quadro usa no semáforo.`}
        acao={
          <Botao tamanho="sm" onClick={() => setCriando(true)}>
            Nova
          </Botao>
        }
      />
      <ul className="divide-y divide-slate-100">
        {(lista.data ?? []).map((b) => (
          <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={cx('flex-1 text-sm', b.ativo ? 'text-slate-800' : 'text-slate-400')}>
              {b.nome}
            </span>
            <Etiqueta>{b.tipo}</Etiqueta>
            {!b.ativo && <Etiqueta className="bg-slate-100 text-slate-500 ring-slate-200">Inativo</Etiqueta>}
            <Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(b)}>
              Editar
            </Botao>
          </li>
        ))}
      </ul>

      <Modal
        aberto={criando || editando !== null}
        onFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        titulo={editando ? 'Editar box' : 'Novo box'}
        rodape={
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Botao>
        }
      >
        <div className="space-y-3">
          <Campo rotulo="Nome" obrigatorio>
            <Entrada
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Elevador 3"
            />
          </Campo>
          <Campo rotulo="Tipo">
            <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="ELEVADOR">Elevador</option>
              <option value="BOX">Box</option>
              <option value="PATIO">Pátio</option>
            </Selecao>
          </Campo>
          <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
            <Interruptor
              ativo={ativo}
              rotulo="Vaga ativa"
              descricao="Inativa não conta na capacidade do dia"
              onChange={setAtivo}
            />
          </div>
        </div>
      </Modal>
    </Cartao>
  )
}

function Motivos() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<MotivoParada | null>(null)
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('PECA')
  const [bloqueia, setBloqueia] = useState(true)
  const [visivel, setVisivel] = useState(false)
  const [ativo, setAtivo] = useState(true)

  const lista = useQuery({
    queryKey: ['motivos', false],
    queryFn: () => api<MotivoParada[]>('/motivos-parada'),
  })

  useEffect(() => {
    setNome(editando?.nome ?? '')
    setCategoria(editando?.categoria ?? 'PECA')
    setBloqueia(editando?.bloqueiaExecucao ?? true)
    setVisivel(editando?.visivelClientePadrao ?? false)
    setAtivo(editando?.ativo ?? true)
  }, [editando, criando])

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        nome,
        categoria,
        bloqueiaExecucao: bloqueia,
        visivelClientePadrao: visivel,
        ativo,
      }
      return editando
        ? api(`/motivos-parada/${editando.id}`, { metodo: 'PUT', corpo })
        : api('/motivos-parada', { metodo: 'POST', corpo })
    },
    onSuccess: () => {
      setEditando(null)
      setCriando(false)
      void queryClient.invalidateQueries({ queryKey: ['motivos'] })
      avisar('Motivo salvo.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  return (
    <Cartao>
      <CartaoTitulo
        titulo="Motivos de parada"
        descricao="São eles que formam o gráfico de onde o tempo se perde."
        acao={
          <Botao tamanho="sm" onClick={() => setCriando(true)}>
            Novo
          </Botao>
        }
      />
      <ul className="divide-y divide-slate-100">
        {(lista.data ?? []).map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <span className={cx('flex-1 text-sm', m.ativo ? 'text-slate-800' : 'text-slate-400')}>
              {m.nome}
            </span>
            <Etiqueta>{m.categoriaDescricao}</Etiqueta>
            {m.visivelClientePadrao && (
              <Etiqueta className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                cliente vê
              </Etiqueta>
            )}
            {!m.ativo && <Etiqueta className="bg-slate-100 text-slate-500 ring-slate-200">Inativo</Etiqueta>}
            <Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(m)}>
              Editar
            </Botao>
          </li>
        ))}
      </ul>

      <Modal
        aberto={criando || editando !== null}
        onFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        titulo={editando ? 'Editar motivo' : 'Novo motivo de parada'}
        rodape={
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Botao>
        }
      >
        <div className="space-y-3">
          <Campo rotulo="Nome" obrigatorio>
            <Entrada
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Aguardando retífica"
            />
          </Campo>
          <Campo rotulo="Categoria" dica="Agrupa os motivos no painel do dono">
            <Selecao value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="PECA">Peça</option>
              <option value="APROVACAO">Aprovação</option>
              <option value="TERCEIRO">Terceiro</option>
              <option value="CLIENTE">Cliente</option>
              <option value="INTERNO">Interno</option>
              <option value="PAGAMENTO">Pagamento</option>
            </Selecao>
          </Campo>
          <div className="divide-y divide-slate-100 rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
            <Interruptor
              ativo={bloqueia}
              rotulo="Trava a execução"
              descricao="O serviço não pode continuar enquanto esta parada estiver aberta"
              onChange={setBloqueia}
            />
            <Interruptor
              ativo={visivel}
              rotulo="Cliente vê este motivo por padrão"
              onChange={setVisivel}
            />
            <Interruptor ativo={ativo} rotulo="Ativo" onChange={setAtivo} />
          </div>
        </div>
      </Modal>
    </Cartao>
  )
}

function Catalogo() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<ServicoCatalogo | null>(null)
  const [criando, setCriando] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [especialidadeId, setEspecialidadeId] = useState('')
  const [horasPadrao, setHorasPadrao] = useState('1')
  const [preco, setPreco] = useState('')
  const [ativo, setAtivo] = useState(true)

  const lista = useQuery({
    queryKey: ['catalogo', false],
    queryFn: () => api<ServicoCatalogo[]>('/catalogo-servicos'),
  })

  const especialidades = useQuery({
    queryKey: ['especialidades', true],
    queryFn: () => api<Especialidade[]>('/especialidades?apenasAtivas=true'),
  })

  useEffect(() => {
    setDescricao(editando?.descricao ?? '')
    setEspecialidadeId(editando?.especialidadeId ?? '')
    setHorasPadrao(String(editando?.horasPadrao ?? 1))
    setPreco(editando?.precoSugerido ? String(editando.precoSugerido) : '')
    setAtivo(editando?.ativo ?? true)
  }, [editando, criando])

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        descricao,
        especialidadeId: especialidadeId || undefined,
        horasPadrao: Number(horasPadrao),
        precoSugerido: preco ? Number(preco) : undefined,
        ativo,
      }
      return editando
        ? api(`/catalogo-servicos/${editando.id}`, { metodo: 'PUT', corpo })
        : api('/catalogo-servicos', { metodo: 'POST', corpo })
    },
    onSuccess: () => {
      setEditando(null)
      setCriando(false)
      void queryClient.invalidateQueries({ queryKey: ['catalogo'] })
      avisar('Serviço salvo.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  return (
    <Cartao>
      <CartaoTitulo
        titulo="Catálogo de serviços"
        descricao="O tempo padrão daqui alimenta a estimativa no check-in."
        acao={
          <Botao tamanho="sm" onClick={() => setCriando(true)}>
            Novo
          </Botao>
        }
      />
      <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto rolagem-suave">
        {(lista.data ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <span className={cx('flex-1 text-sm', s.ativo ? 'text-slate-800' : 'text-slate-400')}>
              {s.descricao}
            </span>
            {s.especialidadeNome && (
              <Etiqueta className="bg-slate-50 text-slate-600 ring-slate-200">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: s.especialidadeCor ?? '#64748b' }}
                  aria-hidden
                />
                {s.especialidadeNome}
              </Etiqueta>
            )}
            <span className="w-16 text-right text-xs text-slate-500">{s.horasPadrao}h</span>
            <Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(s)}>
              Editar
            </Botao>
          </li>
        ))}
      </ul>

      <Modal
        aberto={criando || editando !== null}
        onFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        titulo={editando ? 'Editar serviço' : 'Novo serviço do catálogo'}
        rodape={
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Botao>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo rotulo="Descrição" obrigatorio>
              <Entrada
                autoFocus
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Troca de bomba d'água"
              />
            </Campo>
          </div>
          <Campo rotulo="Especialidade">
            <Selecao
              value={especialidadeId}
              onChange={(e) => setEspecialidadeId(e.target.value)}
            >
              <option value="">Sem especialidade</option>
              {(especialidades.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Tempo padrão (h)" obrigatorio>
            <Entrada
              type="number"
              step="0.25"
              min="0.25"
              value={horasPadrao}
              onChange={(e) => setHorasPadrao(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Preço sugerido (R$)">
            <Entrada
              type="number"
              step="0.01"
              min="0"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </Campo>
          <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200 sm:col-span-2">
            <Interruptor ativo={ativo} rotulo="Serviço ativo" onChange={setAtivo} />
          </div>
        </div>
      </Modal>
    </Cartao>
  )
}
