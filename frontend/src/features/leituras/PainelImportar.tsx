import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, BadgeCheck, FileUp, Search, X } from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import type {
  DetalheLeitura,
  ModuloLeitura,
  PreviaLeitura,
  ResumoLeitura,
  TipoLeitura,
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
import { Placa } from '../../components/oficina'
import { TabelaScanner } from './TabelaScanner'

interface VeiculoPorPlaca {
  id: string
  clienteNome: string
  placa: string
  descricao: string
}

/**
 * Importar → conferir → salvar.
 *
 * O parse não grava nada. O que vem do PDF fica editável aqui, e o que o PDF
 * *não* diz — motor ligado, ignição, se é a leitura boa ou uma anomalia e em
 * que condição — é preenchido por quem estava no carro. Inventar esses campos
 * envenenaria justamente o dado que a ferramenta existe para guardar.
 */
export default function PainelImportar({
  completarId,
  onFechar,
  onSalvo,
}: {
  /**
   * Leitura que entrou por e-mail e esta esperando alguem dizer de que carro
   * e. Com isto, o painel pula o upload: o PDF ja foi lido e os modulos ja
   * estao gravados — falta so o que o PDF nao diz.
   */
  completarId?: string
  onFechar: () => void
  onSalvo: (id: string) => void
}) {
  const [previa, setPrevia] = useState<PreviaLeitura | null>(null)
  const [modulos, setModulos] = useState<ModuloLeitura[]>([])
  const [erro, setErro] = useState<string>()

  const [veiculoId, setVeiculoId] = useState('')
  const [termo, setTermo] = useState('')
  const [busca, setBusca] = useState('')
  const [motor, setMotor] = useState('')

  // Quem completa uma pendente costuma estar rotulando uma anomalia que
  // chegou do tablet; quem importa na mao normalmente esta cadastrando a
  // referencia do carro. O padrao segue quem esta usando.
  const [tipo, setTipo] = useState<TipoLeitura>(completarId ? 'ANOMALIA' : 'OFICIAL')
  const [condicao, setCondicao] = useState('')
  const [descricao, setDescricao] = useState('')
  const [motorLigado, setMotorLigado] = useState(true)
  const [ignicaoLigada, setIgnicaoLigada] = useState(true)
  const [anexarEm, setAnexarEm] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setBusca(termo.trim()), 300)
    return () => window.clearTimeout(id)
  }, [termo])

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  /**
   * A leitura pendente vira o mesmo rascunho que a importacao produz.
   *
   * O painel inteiro ja sabe trabalhar com `previa`; traduzir aqui evita uma
   * segunda tela quase igual — e duas telas quase iguais divergem.
   */
  const pendente = useQuery({
    queryKey: ['leitura', completarId],
    queryFn: () => api<DetalheLeitura>(`/leituras/${completarId}`),
    enabled: Boolean(completarId),
  })

  useEffect(() => {
    const dados = pendente.data
    if (!dados || previa) return
    setPrevia({
      arquivoId: dados.arquivoId ?? '',
      marca: dados.resumo.marca,
      modelo: dados.resumo.modelo,
      ano: dados.resumo.ano,
      km: dados.resumo.km,
      ferramenta: dados.ferramenta,
      ferramentaVersao: dados.ferramentaVersao,
      numeroRelatorio: dados.numeroRelatorio,
      momentoTeste: dados.resumo.momentoTeste,
      modulos: dados.modulos,
      avisos: [],
      qualidade: { lidos: 0, esperados: 0, percentual: 100, faltando: [], estrategia: '', confiavel: true },
    })
    setModulos(dados.modulos)
    if (dados.resumo.motor) setMotor(dados.resumo.motor)
    if (dados.resumo.veiculoId) setVeiculoId(dados.resumo.veiculoId)
  }, [pendente.data, previa])

  const placaDigitada = busca.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const pareceplaca = placaDigitada.length >= 6

  const porPlaca = useQuery({
    queryKey: ['leitura-placa', placaDigitada],
    queryFn: () =>
      api<VeiculoPorPlaca>(`/veiculos/placa/${encodeURIComponent(placaDigitada)}`).catch(() => null),
    enabled: pareceplaca && !veiculoId,
  })

  /** Leituras que já existem do carro: dá para anexar módulo em vez de criar outra. */
  const existentes = useQuery({
    queryKey: ['leituras-veiculo', veiculoId],
    queryFn: () => api<ResumoLeitura[]>(`/leituras/veiculo/${veiculoId}`),
    enabled: Boolean(veiculoId),
  })

  const importar = useMutation({
    mutationFn: (arquivo: File) => {
      const dados = new FormData()
      dados.append('arquivo', arquivo)
      return api<PreviaLeitura>('/leituras/importar', { metodo: 'POST', formData: dados })
    },
    onSuccess: (dados) => {
      setPrevia(dados)
      setModulos(dados.modulos)
      setErro(undefined)
      if (dados.veiculoSugeridoId) setVeiculoId(dados.veiculoSugeridoId)
    },
    onError: (falha) =>
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível ler o PDF.'),
  })

  const salvar = useMutation({
    mutationFn: () => {
      const oQuePdfNaoDiz = {
        veiculoId: veiculoId || undefined,
        motor: motor || undefined,
        tipo,
        condicao: tipo === 'ANOMALIA' ? condicao : undefined,
        descricao: descricao || undefined,
        motorLigado,
        ignicaoLigada,
      }

      // Completar NAO reenvia os modulos: eles foram gravados quando o
      // e-mail chegou, e mandar de novo duplicaria cada item.
      if (completarId) {
        return api<DetalheLeitura>(`/leituras/${completarId}/completar`, {
          metodo: 'POST',
          corpo: oQuePdfNaoDiz,
        })
      }

      return api<DetalheLeitura>('/leituras', {
        metodo: 'POST',
        corpo: {
          ...oQuePdfNaoDiz,
          marca: previa?.marca,
          modelo: previa?.modelo,
          ano: previa?.ano,
          km: previa?.km,
          arquivoId: previa?.arquivoId,
          ferramenta: previa?.ferramenta,
          ferramentaVersao: previa?.ferramentaVersao,
          numeroRelatorio: previa?.numeroRelatorio,
          momentoTeste: previa?.momentoTeste,
          anexarEm: anexarEm || undefined,
          modulos: modulos.map((m) => ({
            nome: m.nome,
            caminho: m.caminho,
            itens: m.itens.map((i) => ({
              numero: i.numero,
              nome: i.nome,
              valor: i.valor,
              valorNumerico: i.valorNumerico,
              minimo: i.minimo,
              maximo: i.maximo,
              unidade: i.unidade,
            })),
          })),
        },
      })
    },
    onSuccess: (dados) => onSalvo(dados.resumo.id),
    onError: (falha) =>
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível salvar a leitura.'),
  })

  const totalDeItens = useMemo(
    () => modulos.reduce((s, m) => s + m.itens.length, 0),
    [modulos],
  )

  // O carro deixou de ser obrigatório: leitura e agendamento são coisas
  // diferentes, e o scanner é plugado em carro que nunca vira OS — orçamento,
  // favor, carro do vizinho. Exigir cadastro para guardar um PDF enchia o
  // cadastro de carros que a oficina nunca atendeu.
  //
  // A exceção é a leitura OFICIAL: ela é a régua de um carro, então precisa
  // dizer de qual. Sem carro, salva como anomalia e oficializa depois.
  const pronto =
    Boolean(previa) &&
    totalDeItens > 0 &&
    (tipo !== 'OFICIAL' || Boolean(veiculoId)) &&
    (tipo === 'OFICIAL' || condicao.trim().length > 2)

  const mudarItem = (
    im: number,
    ii: number,
    campo: 'nome' | 'valor' | 'unidade',
    valor: string,
  ) =>
    setModulos((atuais) =>
      atuais.map((m, i) =>
        i !== im
          ? m
          : {
              ...m,
              itens: m.itens.map((item, j) => {
                if (j !== ii) return item
                if (campo !== 'valor') return { ...item, [campo]: valor }
                // Editar o valor tem que refazer o número, senão a comparação
                // futura usaria o número velho com o texto novo.
                const numero = Number(valor.replace(',', '.'))
                return {
                  ...item,
                  valor,
                  valorNumerico: Number.isFinite(numero) && valor.trim() !== '' ? numero : undefined,
                }
              }),
            },
      ),
    )

  const mudarModulo = (im: number, nome: string) =>
    setModulos((atuais) => atuais.map((m, i) => (i === im ? { ...m, nome } : m)))

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-aco-900/60" onClick={onFechar} aria-hidden />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={completarId ? 'Completar leitura' : 'Importar leitura do scanner'}
        className="relative flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl"
      >
        <header className="chapa flex items-center gap-2 px-4 py-3">
          <h2 className="fonte-display text-sm font-extrabold uppercase tracking-widest text-white">
            {completarId ? 'Completar leitura recebida' : 'Importar leitura do scanner'}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="ml-auto rounded p-1 text-zinc-400 hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto rolagem-suave p-4">
          {!previa && completarId ? (
            <p className="py-10 text-center text-sm text-slate-500">Abrindo a leitura...</p>
          ) : !previa ? (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center transition hover:border-marca-500 hover:bg-marca-50">
                <FileUp className="size-8 text-stone-400" aria-hidden />
                <span className="fonte-display text-sm font-bold uppercase tracking-wide text-stone-700">
                  Escolher o PDF do relatório
                </span>
                <span className="text-xs text-stone-500">
                  O relatório de "Dados actuais" que o scanner exporta. Até 8 MB.
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0]
                    if (arquivo) importar.mutate(arquivo)
                  }}
                />
              </label>
              {importar.isPending && (
                <p className="text-center text-sm text-slate-500">Lendo o PDF...</p>
              )}
              <AvisoErro mensagem={erro} />
            </div>
          ) : (
            <>
              {/* ------------------------------------------- o que veio do PDF */}
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="fonte-display text-xs font-bold uppercase tracking-widest text-slate-500">
                  {completarId ? 'Chegou por e-mail' : 'Veio do relatório'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {[previa.marca, previa.modelo, previa.ano].filter(Boolean).join(' ') ||
                    'Modelo não identificado'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {totalDeItens} itens em {modulos.length} módulo(s)
                  {previa.km ? ` · ${previa.km.toLocaleString('pt-BR')} km` : ''}
                  {previa.ferramenta ? ` · ${previa.ferramenta}` : ''}
                  {previa.ferramentaVersao ? ` ${previa.ferramentaVersao}` : ''}
                </p>
                <p className="mt-1 text-[11px] text-emerald-700">
                  VIN, nome e telefone do cliente não são guardados.
                </p>
              </div>

              {/* A nota de leitura, antes dos avisos.
                  Sem isto, uma importação que pegou 95 de 133 linhas aparece
                  como "95 itens" — com cara de sucesso. Foi exatamente assim
                  que 38 linhas sumiram sem ninguém ver. O relatório numera as
                  próprias linhas, então o buraco é fato, não suspeita. */}
              {previa.qualidade &&
                (previa.qualidade.confiavel ? (
                  <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-emerald-200">
                    <BadgeCheck className="size-4 flex-none" aria-hidden />
                    Leitura completa: as {previa.qualidade.lidos} linhas da tabela foram lidas.
                  </p>
                ) : (
                  <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 ring-1 ring-red-300">
                    <p className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="size-4 flex-none" aria-hidden />
                      Leitura incompleta: {previa.qualidade.lidos} de{' '}
                      {previa.qualidade.esperados} linhas ({previa.qualidade.percentual}%)
                    </p>
                    <p className="mt-1">
                      Faltaram os itens {previa.qualidade.faltando.slice(0, 12).join(', ')}
                      {previa.qualidade.faltando.length > 12 &&
                        ` e mais ${previa.qualidade.faltando.length - 12}`}
                      . Dá para salvar assim, mas a comparação com a leitura oficial vai
                      ficar cega nesses pontos.
                    </p>
                  </div>
                ))}

              {previa.avisos.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
                  {previa.avisos.map((a) => (
                    <li key={a}>· {a}</li>
                  ))}
                </ul>
              )}

              {/* ------------------------------------------- o carro */}
              <Campo
                rotulo="Carro desta leitura"
                obrigatorio={tipo === 'OFICIAL'}
                dica={
                  tipo === 'OFICIAL'
                    ? 'Leitura oficial é a referência de um carro, então precisa dizer de qual.'
                    : 'Opcional. Sem carro, a leitura fica guardada como "falta completar" e você vincula quando quiser.'
                }
              >
                {veiculoId ? (
                  <div className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-300">
                    <Placa placa={porPlaca.data?.placa ?? previa.placaSugerida ?? '—'} tamanho="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {porPlaca.data?.descricao ?? previa.veiculoSugeridoDescricao ?? 'carro escolhido'}
                    </span>
                    <Botao tamanho="sm" variante="secundario" onClick={() => setVeiculoId('')}>
                      Trocar
                    </Botao>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                      <Entrada
                        autoFocus
                        value={termo}
                        onChange={(e) => setTermo(e.target.value)}
                        placeholder="Digite a placa do carro"
                        className="pl-8"
                      />
                    </div>
                    {porPlaca.data && (
                      <button
                        type="button"
                        onClick={() => setVeiculoId(porPlaca.data!.id)}
                        className="mt-1 flex w-full items-center gap-2 rounded-md bg-white px-2 py-1.5 text-left ring-1 ring-slate-300 hover:ring-marca-500"
                      >
                        <Placa placa={porPlaca.data.placa} tamanho="sm" />
                        <span className="truncate text-sm text-slate-700">
                          {porPlaca.data.descricao} · {porPlaca.data.clienteNome}
                        </span>
                      </button>
                    )}
                    {pareceplaca && !porPlaca.isFetching && !porPlaca.data && (
                      <p className="mt-1 text-xs text-amber-700">
                        Placa não cadastrada. Cadastre o carro em Clientes e veículos primeiro.
                      </p>
                    )}
                  </>
                )}
              </Campo>

              {/* Anexar so faz sentido na importacao: aqui a leitura ja existe. */}
              {!completarId && veiculoId && (existentes.data ?? []).length > 0 && (
                <Campo
                  rotulo="Anexar a uma leitura existente"
                  dica="Cada PDF do Autel traz um módulo. Anexe para empilhar PGM-FI e ABS na mesma leitura."
                >
                  <Selecao value={anexarEm} onChange={(e) => setAnexarEm(e.target.value)}>
                    <option value="">Criar uma leitura nova</option>
                    {existentes.data!.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.tipoDescricao}
                        {l.condicao ? ` · ${l.condicao}` : ''} ({l.modulos} módulo(s))
                      </option>
                    ))}
                  </Selecao>
                </Campo>
              )}

              {/* --------------------------- o que o PDF não diz */}
              {!anexarEm && (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                  <p className="fonte-display text-xs font-bold uppercase tracking-widest text-slate-500">
                    O que o PDF não diz
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo rotulo="Esta leitura é">
                      <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as TipoLeitura)}>
                        <option value="OFICIAL">A leitura boa do carro (oficial)</option>
                        <option value="ANOMALIA">Uma leitura com anomalia</option>
                      </Selecao>
                    </Campo>
                    <Campo rotulo="Motor (opcional)" dica="Ex.: 2.0 flex">
                      <Entrada value={motor} onChange={(e) => setMotor(e.target.value)} />
                    </Campo>
                  </div>

                  {tipo === 'ANOMALIA' && (
                    <Campo rotulo="Em que condição" obrigatorio>
                      <Entrada
                        value={condicao}
                        onChange={(e) => setCondicao(e.target.value)}
                        placeholder="Ex.: carro com problema no frio"
                      />
                    </Campo>
                  )}

                  {tipo === 'OFICIAL' && (existentes.data ?? []).some((l) => l.tipo === 'OFICIAL') && (
                    <p className="text-[11px] text-amber-700">
                      Este carro já tem uma leitura oficial. Salvar esta rebaixa a anterior para
                      anomalia — um carro tem uma oficial só.
                    </p>
                  )}

                  <div className="rounded-md bg-white px-3 ring-1 ring-slate-200">
                    <Interruptor
                      ativo={motorLigado}
                      onChange={setMotorLigado}
                      rotulo="Motor ligado"
                      descricao="Os valores mudam muito entre motor ligado e desligado."
                    />
                    <div className="border-t border-slate-100">
                      <Interruptor
                        ativo={ignicaoLigada}
                        onChange={setIgnicaoLigada}
                        rotulo="Ignição ligada"
                      />
                    </div>
                  </div>

                  <Campo rotulo="Observação (opcional)">
                    <AreaTexto
                      rows={2}
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="O que estava acontecendo com o carro nesta leitura"
                    />
                  </Campo>
                </div>
              )}

              {/* ------------------------------------------- confira a tabela */}
              <div>
                <p className="mb-2 fonte-display text-xs font-bold uppercase tracking-widest text-slate-500">
                  {completarId
                    ? 'O que veio no relatório'
                    : 'Confira antes de salvar — dá para corrigir nome, valor e unidade'}
                </p>
                {/* Ao completar, a tabela é só leitura: estes itens já estão
                    gravados, e um campo editável aqui prometeria uma edição
                    que este endpoint não faz. */}
                <TabelaScanner
                  modulos={modulos}
                  editavel={!completarId}
                  onMudarItem={mudarItem}
                  onMudarModulo={mudarModulo}
                />
              </div>

              <AvisoErro mensagem={erro} />
            </>
          )}
        </div>

        {previa && (
          <footer className="border-t border-slate-200 bg-white p-3">
            <button
              type="button"
              disabled={!pronto || salvar.isPending}
              onClick={() => salvar.mutate()}
              className={cx(
                'fonte-display h-12 w-full rounded-md text-sm font-extrabold uppercase tracking-wider transition',
                pronto && !salvar.isPending
                  ? 'bg-faixa sobre-destaque hover:brightness-110'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400',
              )}
            >
              {salvar.isPending
                ? 'Salvando...'
                : completarId
                  ? 'Completar leitura'
                  : anexarEm
                    ? 'Anexar módulos'
                    : 'Salvar leitura'}
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}
