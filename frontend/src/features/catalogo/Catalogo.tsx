import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronsUp, Clock, Pencil, Plus, Trash2, Wrench } from 'lucide-react'

import { api } from '../../api/client'
import type { Especialidade, ServicoCatalogo } from '../../types'
import {
  Botao,
  Campo,
  Cartao,
  CartaoTitulo,
  Carregando,
  Entrada,
  Etiqueta,
  Interruptor,
  Modal,
  Selecao,
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import { horas, moeda, plural } from '../../lib/format'

/**
 * Catálogo de serviços e mão de obra.
 *
 * Um lugar só para a pergunta "o que esta oficina faz, quanto tempo leva e
 * quanto custa". Antes isto morava escondido em Configurações → Cadastros →
 * Catálogo de serviços, numa aba entre marcas de veículo e motivos de
 * parada — e era onde nasciam o "Do catálogo" do check-in e o tempo que o
 * sistema usa para calcular a capacidade do dia. Coisa que alimenta o
 * orçamento inteiro não mora dentro de um submenu de configuração.
 *
 * **Serviço e mão de obra são a mesma ficha, de propósito.** O dono pediu
 * para "centralizar esse conceito", e está certo: o que a oficina vende é o
 * trabalho. Cada linha diz as duas coisas — quantas horas o serviço leva
 * (a mão de obra) e por quanto ele sai (o valor) —, e é dessa ficha que o
 * check-in puxa o tempo e o preço sugerido.
 */
export default function Catalogo() {
  const queryClient = useQueryClient()
  const avisar = useAviso()
  const [editando, setEditando] = useState<ServicoCatalogo | null>(null)
  const [criando, setCriando] = useState(false)
  const [apagando, setApagando] = useState<ServicoCatalogo | null>(null)
  const [verInativos, setVerInativos] = useState(false)

  const consulta = useQuery({
    queryKey: ['catalogo', false],
    queryFn: () => api<ServicoCatalogo[]>('/catalogo-servicos'),
  })

  const apagar = useMutation({
    mutationFn: (id: string) => api(`/catalogo-servicos/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => {
      setApagando(null)
      void queryClient.invalidateQueries({ queryKey: ['catalogo'] })
      avisar('Serviço apagado.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const todos = useMemo(() => consulta.data ?? [], [consulta.data])
  const ativos = useMemo(() => todos.filter((s) => s.ativo), [todos])
  const naTela = verInativos ? todos : ativos

  /**
   * As contas da faixa de cima.
   *
   * Média só sobre quem TEM o número: um serviço sem preço cadastrado não é
   * um serviço de graça, e entrar como zero puxaria a média para baixo e
   * faria o dono achar que cobra menos do que cobra.
   */
  const resumo = useMemo(() => {
    const comPreco = ativos.filter((s) => (s.precoSugerido ?? 0) > 0)
    const comMargem = ativos.filter((s) => s.margemPercentual != null)
    const somaHoras = ativos.reduce((t, s) => t + (s.horasPadrao ?? 0), 0)
    const somaPreco = comPreco.reduce((t, s) => t + (s.precoSugerido ?? 0), 0)
    return {
      ativos: ativos.length,
      inativos: todos.length - ativos.length,
      semPreco: ativos.length - comPreco.length,
      horaMedia: ativos.length > 0 ? somaHoras / ativos.length : null,
      precoMedio: comPreco.length > 0 ? somaPreco / comPreco.length : null,
      margemMedia:
        comMargem.length > 0
          ? Math.round(
              comMargem.reduce((t, s) => t + (s.margemPercentual ?? 0), 0) / comMargem.length,
            )
          : null,
      /** Quanto custa a hora, em média: o número que o balcão usa para orçar fora do catálogo. */
      valorDaHora:
        somaHoras > 0 && comPreco.length > 0
          ? somaPreco / comPreco.reduce((t, s) => t + (s.horasPadrao || 1), 0)
          : null,
    }
  }, [ativos, todos])

  if (consulta.isLoading) return <Carregando texto="Abrindo o catálogo..." />

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Serviços e mão de obra</h1>
          <p className="mt-1 text-sm text-slate-600">
            O que a oficina faz, quanto tempo leva e por quanto sai. É daqui que o check-in puxa o
            tempo e o preço sugerido de cada serviço.
          </p>
        </div>
        <Botao tamanho="toque" onClick={() => setCriando(true)}>
          <Plus className="size-4" aria-hidden />
          Novo serviço
        </Botao>
      </header>

      {/* ---------------------------------------------------- o painelzinho */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          Icone={Wrench}
          valor={String(resumo.ativos)}
          rotulo={resumo.ativos === 1 ? 'serviço no catálogo' : 'serviços no catálogo'}
          detalhe={
            resumo.inativos > 0
              ? `${resumo.inativos} desativado${resumo.inativos > 1 ? 's' : ''}, fora das listas`
              : 'todos ativos'
          }
        />
        <Numero
          Icone={Clock}
          valor={resumo.horaMedia != null ? horas(resumo.horaMedia) : '—'}
          rotulo="de mão de obra, em média"
          detalhe={`${horas(ativos.reduce((t, s) => t + (s.horasPadrao ?? 0), 0))} somando o catálogo`}
        />
        <Numero
          Icone={Wrench}
          valor={resumo.precoMedio != null ? moeda(resumo.precoMedio) : '—'}
          rotulo="de preço médio"
          detalhe={
            resumo.semPreco > 0
              ? `${plural(resumo.semPreco, 'serviço')} ainda sem preço`
              : 'todos com preço'
          }
          alerta={resumo.semPreco > 0}
        />
        <Numero
          Icone={Clock}
          valor={resumo.valorDaHora != null ? moeda(resumo.valorDaHora) : '—'}
          rotulo="por hora de trabalho"
          detalhe={
            resumo.margemMedia != null
              ? `margem média de ${resumo.margemMedia}%`
              : 'sem lucro cadastrado para calcular a margem'
          }
        />
      </div>

      {/* ---------------------------------------------------- a lista */}
      <Cartao>
        <CartaoTitulo
          titulo="O catálogo"
          descricao="Toque para editar. Serviço que já foi usado em alguma OS não pode ser apagado — desative."
          acao={
            resumo.inativos > 0 && (
              <Botao
                tamanho="toque"
                variante="secundario"
                onClick={() => setVerInativos((v) => !v)}
              >
                {verInativos ? 'Esconder desativados' : `Ver os ${resumo.inativos} desativados`}
              </Botao>
            )
          }
        />

        {naTela.length === 0 ? (
          <Vazio
            icone={<Wrench className="size-8" />}
            titulo="Nenhum serviço no catálogo"
            descricao="Sem catálogo, todo serviço na OS é digitado à mão e o sistema não tem tempo padrão para calcular a capacidade do dia."
            acao={
              <Botao tamanho="toque" onClick={() => setCriando(true)}>
                <Plus className="size-4" aria-hidden />
                Cadastrar o primeiro
              </Botao>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {naTela.map((s) => (
              <li
                key={s.id}
                className={cx(
                  'flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5',
                  !s.ativo && 'bg-slate-50',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-800">
                    {s.descricao}
                    {!s.ativo && (
                      <Etiqueta className="bg-slate-200 text-slate-600 ring-slate-300">
                        desativado
                      </Etiqueta>
                    )}
                    {s.exigeElevador && (
                      <Etiqueta
                        className="bg-slate-100 text-slate-600 ring-slate-200"
                        titulo="Este serviço sobe o carro"
                      >
                        <ChevronsUp className="size-3" aria-hidden />
                        elevador
                      </Etiqueta>
                    )}
                  </p>
                  {s.especialidadeNome && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: s.especialidadeCor ?? '#64748b' }}
                        aria-hidden
                      />
                      {s.especialidadeNome}
                    </p>
                  )}
                </div>

                {/* Mão de obra e valor lado a lado: é a ficha inteira numa
                    linha, que é o que o dono pediu ao juntar os dois. */}
                <span className="w-20 text-right text-sm tabular-nums text-slate-700">
                  {horas(s.horasPadrao)}
                </span>
                <span className="w-28 text-right text-sm tabular-nums">
                  {s.precoSugerido != null && s.precoSugerido > 0 ? (
                    <span className="font-medium text-slate-900">{moeda(s.precoSugerido)}</span>
                  ) : (
                    <span className="text-amber-700">sem preço</span>
                  )}
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-slate-500">
                  {s.margemPercentual != null ? `${s.margemPercentual}%` : '—'}
                </span>

                <div className="flex flex-none gap-1">
                  <button
                    type="button"
                    onClick={() => setEditando(s)}
                    aria-label={`Editar ${s.descricao}`}
                    className="grid size-11 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setApagando(s)}
                    aria-label={`Apagar ${s.descricao}`}
                    className="grid size-11 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <FormularioServico
        aberto={criando || editando !== null}
        servico={editando}
        onFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        onSalvo={() => {
          setCriando(false)
          setEditando(null)
          void queryClient.invalidateQueries({ queryKey: ['catalogo'] })
        }}
      />

      <Modal
        aberto={apagando !== null}
        titulo="Apagar do catálogo"
        onFechar={() => setApagando(null)}
        rodape={
          <>
            <Botao variante="secundario" tamanho="toque" onClick={() => setApagando(null)}>
              Voltar
            </Botao>
            <Botao
              variante="perigo"
              tamanho="toque"
              carregando={apagar.isPending}
              onClick={() => apagando && apagar.mutate(apagando.id)}
            >
              Apagar
            </Botao>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Apagar <strong>{apagando?.descricao}</strong> do catálogo?
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Isto não mexe em OS nenhuma — e por isso mesmo o sistema recusa apagar um serviço que já
          foi usado em algum carro. Nesse caso, desative: ele some das listas e o histórico
          continua de pé.
        </p>
      </Modal>
    </div>
  )
}

function Numero({
  Icone,
  valor,
  rotulo,
  detalhe,
  alerta,
}: {
  Icone: typeof Wrench
  valor: string
  rotulo: string
  detalhe: string
  alerta?: boolean
}) {
  return (
    <div
      className={cx(
        'flex items-start gap-3 rounded-xl bg-white p-3.5 ring-1',
        alerta ? 'ring-amber-300' : 'ring-slate-200',
      )}
    >
      <span
        className={cx(
          'grid size-9 flex-none place-items-center rounded-lg',
          alerta ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500',
        )}
      >
        <Icone className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight tabular-nums text-slate-900">{valor}</p>
        <p className="text-xs font-medium text-slate-600">{rotulo}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{detalhe}</p>
      </div>
    </div>
  )
}

/**
 * A ficha do serviço.
 *
 * Mesmo formulário para criar e editar: são a mesma coisa, e duas telas
 * quase iguais é onde nasce a divergência ("no criar tem elevador, no
 * editar não").
 */
function FormularioServico({
  aberto,
  servico,
  onFechar,
  onSalvo,
}: {
  aberto: boolean
  servico: ServicoCatalogo | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const avisar = useAviso()
  const [descricao, setDescricao] = useState('')
  const [especialidadeId, setEspecialidadeId] = useState('')
  const [horasPadrao, setHorasPadrao] = useState('1')
  const [preco, setPreco] = useState('')
  const [lucro, setLucro] = useState('')
  const [exigeElevador, setExigeElevador] = useState(false)
  const [ativo, setAtivo] = useState(true)
  /**
   * De qual ficha os campos foram carregados.
   *
   * Em vez de um efeito com `[servico]` nas dependências: o objeto é novo a
   * cada render do pai, e o efeito limparia o campo embaixo do dedo de quem
   * está digitando. Este projeto já pagou por esse defeito uma vez, no
   * Painel do Mecânico.
   */
  const [carregadoDe, setCarregadoDe] = useState<string | null>(null)
  const chave = aberto ? (servico?.id ?? 'novo') : null

  if (chave !== carregadoDe) {
    setCarregadoDe(chave)
    setDescricao(servico?.descricao ?? '')
    setEspecialidadeId(servico?.especialidadeId ?? '')
    setHorasPadrao(String(servico?.horasPadrao ?? 1))
    setPreco(servico?.precoSugerido ? String(servico.precoSugerido) : '')
    setLucro(servico?.valorLucro ? String(servico.valorLucro) : '')
    setExigeElevador(servico?.exigeElevador ?? false)
    setAtivo(servico?.ativo ?? true)
  }

  const especialidades = useQuery({
    queryKey: ['especialidades', true],
    queryFn: () => api<Especialidade[]>('/especialidades?apenasAtivas=true'),
    enabled: aberto,
  })

  const margemViva = useMemo(() => {
    const p = Number(preco)
    const l = Number(lucro)
    if (!preco || !lucro || !Number.isFinite(p) || !Number.isFinite(l) || p <= 0) return null
    return Math.round((l * 100) / p)
  }, [preco, lucro])

  const valorDaHora = useMemo(() => {
    const p = Number(preco)
    const h = Number(horasPadrao)
    if (!preco || !h || !Number.isFinite(p) || !Number.isFinite(h) || h <= 0) return null
    return p / h
  }, [preco, horasPadrao])

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        descricao,
        especialidadeId: especialidadeId || undefined,
        horasPadrao: Number(horasPadrao),
        precoSugerido: preco ? Number(preco) : undefined,
        valorLucro: lucro ? Number(lucro) : undefined,
        exigeElevador,
        ativo,
      }
      return servico
        ? api(`/catalogo-servicos/${servico.id}`, { metodo: 'PUT', corpo })
        : api('/catalogo-servicos', { metodo: 'POST', corpo })
    },
    onSuccess: () => {
      avisar('Serviço salvo.')
      onSalvo()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const pronto = descricao.trim().length > 1 && Number(horasPadrao) > 0

  return (
    <Modal
      aberto={aberto}
      titulo={servico ? 'Editar serviço' : 'Novo serviço'}
      onFechar={onFechar}
      rodape={
        <>
          <Botao variante="secundario" tamanho="toque" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            tamanho="toque"
            disabled={!pronto}
            carregando={salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <Campo rotulo="O que é o serviço" obrigatorio>
          <Entrada
            autoFocus
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Troca de correia dentada"
          />
        </Campo>

        <Campo rotulo="Especialidade" dica="Quem sabe fazer. Usada para sugerir o mecânico.">
          <Selecao value={especialidadeId} onChange={(e) => setEspecialidadeId(e.target.value)}>
            <option value="">Qualquer mecânico</option>
            {(especialidades.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Selecao>
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            rotulo="Mão de obra (horas)"
            obrigatorio
            dica="O tempo padrão. É ele que calcula a capacidade do dia."
          >
            <Entrada
              type="number"
              step="0.25"
              min="0.25"
              inputMode="decimal"
              value={horasPadrao}
              onChange={(e) => setHorasPadrao(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Preço sugerido (R$)" dica="O que a oficina cobra por este serviço.">
            <Entrada
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="deixe vazio para orçar caso a caso"
            />
          </Campo>
        </div>

        <Campo
          rotulo="Quanto sobra (R$)"
          dica="O lucro depois de tirar peça e custo. Só serve para a margem; não vai para o orçamento do cliente."
        >
          <Entrada
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={lucro}
            onChange={(e) => setLucro(e.target.value)}
          />
        </Campo>

        {(margemViva != null || valorDaHora != null) && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
            {valorDaHora != null && (
              <>
                Dá <strong className="text-slate-900">{moeda(valorDaHora)}</strong> por hora de
                trabalho
              </>
            )}
            {valorDaHora != null && margemViva != null && ' · '}
            {margemViva != null && (
              <>
                margem de <strong className="text-slate-900">{margemViva}%</strong>
              </>
            )}
          </p>
        )}

        <Interruptor
          ativo={exigeElevador}
          onChange={setExigeElevador}
          rotulo="Este serviço sobe o carro"
          descricao="Entra na fila do elevador quando for lançado numa OS."
        />
        <Interruptor
          ativo={ativo}
          onChange={setAtivo}
          rotulo="Ativo"
          descricao="Desativado some das listas de escolha, mas continua no histórico de quem já usou."
        />
      </div>
    </Modal>
  )
}
