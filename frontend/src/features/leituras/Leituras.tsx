import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, FileUp, ScanLine, Search } from 'lucide-react'
import { api } from '../../api/client'
import type { ResumoLeitura, TipoLeitura } from '../../types'
import {
  Botao,
  Carregando,
  Entrada,
  Etiqueta,
  Vazio,
  useAviso,
} from '../../components/ui'
import { Placa } from '../../components/oficina'
import { dataHora } from '../../lib/format'
import PainelImportar from './PainelImportar'

interface Pagina {
  content: ResumoLeitura[]
  totalElements: number
}

/**
 * Um modelo de carro e tudo que a oficina ja leu dele.
 *
 * O dono pensa por carro, nao por arquivo: "Honda Civic 2014" primeiro, a
 * leitura de referencia dentro, e embaixo as outras — as com anomalia.
 */
interface GrupoModelo {
  chave: string
  titulo: string
  motores: string[]
  oficiais: ResumoLeitura[]
  outras: ResumoLeitura[]
}

/**
 * Agrupa por marca + modelo + ano, que e como o mecanico procura.
 *
 * Leitura sem modelo identificado (vem assim do e-mail antes de alguem
 * completar) cai num grupo proprio em vez de sumir: ela existe e precisa
 * ser vista para ser completada.
 */
function agruparPorModelo(leituras: ResumoLeitura[]): GrupoModelo[] {
  const grupos = new Map<string, GrupoModelo>()

  for (const l of leituras) {
    const partes = [l.marca, l.modelo, l.ano].filter(Boolean)
    const chave = partes.length > 0 ? partes.join('|').toLowerCase() : 'sem-modelo'
    const titulo = partes.length > 0 ? partes.join(' ') : 'Sem modelo identificado'

    let grupo = grupos.get(chave)
    if (!grupo) {
      grupo = { chave, titulo, motores: [], oficiais: [], outras: [] }
      grupos.set(chave, grupo)
    }
    if (l.motor && !grupo.motores.includes(l.motor)) grupo.motores.push(l.motor)
    // OFICIAL ainda pendente nao e referencia de nada: entra como as outras.
    if (l.tipo === 'OFICIAL' && l.situacao === 'COMPLETA') grupo.oficiais.push(l)
    else grupo.outras.push(l)
  }

  return [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
}

export default function Leituras() {
  const avisar = useAviso()
  const navegar = useNavigate()
  const queryClient = useQueryClient()

  const [termo, setTermo] = useState('')
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<TipoLeitura | ''>('')
  const [importando, setImportando] = useState(false)
  /** Leitura que chegou por e-mail e está esperando alguém dizer de que carro é. */
  const [completando, setCompletando] = useState<string>()

  useEffect(() => {
    const id = window.setTimeout(() => setBusca(termo.trim()), 300)
    return () => window.clearTimeout(id)
  }, [termo])

  const consulta = useQuery({
    queryKey: ['leituras', busca, tipo],
    queryFn: () =>
      api<Pagina>(
        `/leituras?busca=${encodeURIComponent(busca)}${tipo ? `&tipo=${tipo}` : ''}&tamanho=100`,
      ),
  })

  // O agrupamento e sempre do que veio: filtrar por Oficiais deixa grupos so
  // com a referencia, e e exatamente o que a pessoa pediu ao filtrar.
  const grupos = useMemo(() => agruparPorModelo(consulta.data?.content ?? []), [consulta.data])

  const pendentes = useMemo(
    () => (consulta.data?.content ?? []).filter((l) => l.situacao === 'PENDENTE'),
    [consulta.data],
  )

  return (
    <div className="space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Leituras do scanner</h1>
          <p className="mt-1 text-sm text-slate-500">
            Os dados dos módulos guardados por carro e por modelo. Achar o MAP de um Civic 2014
            deixa de exigir plugar o scanner de novo.
          </p>
        </div>
        <Botao onClick={() => setImportando(true)}>
          <FileUp className="size-4" aria-hidden />
          Importar PDF
        </Botao>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Entrada
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Placa, marca, modelo, motor ou ano — ex.: Civic 2014"
            className="pl-8"
          />
        </div>
        <div className="flex gap-1">
          {(['', 'OFICIAL', 'ANOMALIA'] as const).map((opcao) => (
            <Botao
              key={opcao || 'todas'}
              tamanho="sm"
              variante={tipo === opcao ? 'primario' : 'secundario'}
              onClick={() => setTipo(opcao)}
            >
              {opcao === '' ? 'Todas' : opcao === 'OFICIAL' ? 'Oficiais' : 'Anomalias'}
            </Botao>
          ))}
        </div>
      </div>

      {/* Chegou sozinho por e-mail e está esperando alguém dizer de que carro
          é. Fica no topo porque uma leitura pendente não serve para nada. */}
      {pendentes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 ring-1 ring-violet-200">
          <Clock3 className="size-4 shrink-0 text-violet-600" aria-hidden />
          <p className="text-sm text-violet-900">
            <strong className="font-semibold">
              {pendentes.length} leitura(s) chegaram por e-mail
            </strong>{' '}
            e faltam completar: diga de que carro é e se o motor estava ligado.
          </p>
          <Botao
            tamanho="sm"
            variante="secundario"
            className="ml-auto"
            onClick={() => setCompletando(pendentes[0].id)}
          >
            Completar a primeira
          </Botao>
        </div>
      )}

      {consulta.isLoading ? (
        <Carregando texto="Buscando leituras..." />
      ) : (consulta.data?.content ?? []).length === 0 ? (
        <Vazio
          icone={<ScanLine className="size-8" />}
          titulo={busca ? 'Nenhuma leitura para essa busca' : 'Nenhuma leitura ainda'}
          descricao={
            busca
              ? 'Tente a placa, a marca ou só o modelo.'
              : 'Importe o PDF do relatório do scanner para começar o acervo da oficina.'
          }
          acao={<Botao onClick={() => setImportando(true)}>Importar PDF</Botao>}
        />
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
          {grupos.map((g) => (
            <section
              key={g.chave}
              className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200"
            >
              <header className="flex flex-wrap items-baseline gap-x-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <h2 className="fonte-display text-sm font-bold uppercase tracking-wide text-slate-900">
                  {g.titulo}
                </h2>
                {g.motores.length > 0 && (
                  <span className="text-xs text-slate-500">{g.motores.join(' · ')}</span>
                )}
                <span className="ml-auto text-[11px] text-slate-400">
                  {g.oficiais.length + g.outras.length} leitura(s)
                </span>
              </header>

              {/* A referencia do modelo, em destaque: e ela que o mecanico
                  compara com o carro que esta na frente dele. */}
              {g.oficiais.map((l) => (
                <Link
                  key={l.id}
                  to={`/leituras/${l.id}`}
                  className="flex items-center gap-2 border-l-4 border-emerald-400 bg-emerald-50/60 px-3 py-2 transition hover:bg-emerald-50"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-emerald-900">
                      Oficial — valores de referência
                    </p>
                    <p className="truncate text-[11px] text-emerald-800/80">
                      {l.modulos} módulo(s) · {l.itens} itens ·{' '}
                      {l.motorLigado ? 'motor ligado' : 'motor desligado'}
                      {l.momentoTeste ? ` · ${dataHora(l.momentoTeste)}` : ''}
                    </p>
                  </div>
                  {l.placa && <Placa placa={l.placa} tamanho="sm" />}
                </Link>
              ))}

              {/* Nao dizer "sem referencia" quando foi o filtro que a
                  escondeu — seria o sistema mentindo sobre o proprio acervo. */}
              {g.oficiais.length === 0 && tipo !== 'ANOMALIA' && (
                <p className="border-l-4 border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500">
                  Sem leitura de referência deste modelo ainda. Marque uma como oficial para
                  ter com o que comparar.
                </p>
              )}

              {/* As outras: anomalia com a condicao do carro, ou pendente. */}
              {g.outras.map((l) => {
                const linha = (
                  <>
                    {l.situacao === 'PENDENTE' ? (
                      <Clock3 className="size-4 shrink-0 text-violet-500" aria-hidden />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm text-slate-800">
                        {l.condicao || l.tipoDescricao}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {l.itens} itens · {l.motorLigado ? 'motor ligado' : 'motor desligado'}
                        {l.momentoTeste ? ` · ${dataHora(l.momentoTeste)}` : ''}
                      </p>
                    </div>
                    {l.situacao === 'PENDENTE' && (
                      <Etiqueta className="shrink-0 bg-violet-100 text-violet-800 ring-violet-200">
                        Falta completar
                      </Etiqueta>
                    )}
                    {l.placa && <Placa placa={l.placa} tamanho="sm" />}
                  </>
                )
                const estilo =
                  'flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 transition hover:bg-slate-50'

                // Pendente vai direto para o painel de completar: abrir o
                // detalhe primeiro so gastaria um clique para descobrir que
                // falta exatamente o que ja se sabe que falta.
                return l.situacao === 'PENDENTE' ? (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setCompletando(l.id)}
                    className={estilo}
                  >
                    {linha}
                  </button>
                ) : (
                  <Link key={l.id} to={`/leituras/${l.id}`} className={estilo}>
                    {linha}
                  </Link>
                )
              })}
            </section>
          ))}
        </div>
      )}

      {completando && (
        <PainelImportar
          completarId={completando}
          onFechar={() => setCompletando(undefined)}
          onSalvo={(id) => {
            setCompletando(undefined)
            void queryClient.invalidateQueries({ queryKey: ['leituras'] })
            avisar('Leitura completada.')
            navegar(`/leituras/${id}`)
          }}
        />
      )}

      {importando && (
        <PainelImportar
          onFechar={() => setImportando(false)}
          onSalvo={(id) => {
            setImportando(false)
            void queryClient.invalidateQueries({ queryKey: ['leituras'] })
            avisar('Leitura salva.')
            navegar(`/leituras/${id}`)
          }}
        />
      )}
    </div>
  )
}
