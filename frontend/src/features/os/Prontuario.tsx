import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Package, Wrench } from 'lucide-react'

import { api } from '../../api/client'
import { Carregando, Cartao, Etiqueta, Vazio, cx } from '../../components/ui'
import { Placa } from '../../components/oficina'
import { CORES_STATUS, dataCompleta, moeda, plural } from '../../lib/format'
import type { PassagemProntuario } from '../../types'

/**
 * O prontuário do carro.
 *
 * O histórico que existia devolvia o cartão do pátio — horas apontadas, dias
 * sem movimentação, alertas, selo de peça. Isso serve para decidir o que
 * fazer **hoje** com um carro que está aqui; para "o que já fizemos neste
 * carro" é ruído: ninguém quer saber que em março a OS passou três dias sem
 * apontamento.
 *
 * O que importa num prontuário é o que ficou: que serviço foi feito, que
 * peça entrou e o que o mecânico escreveu. Cada passagem é um bloco fechado,
 * e o bloco abre com um toque — a lista precisa caber na tela antes de
 * alguém procurar nela.
 */
export default function Prontuario() {
  const { id = '' } = useParams()
  const [aberto, setAberto] = useState<string | null>(null)

  const consulta = useQuery({
    queryKey: ['prontuario', id],
    queryFn: () => api<PassagemProntuario[]>(`/veiculos/${id}/prontuario`),
  })

  if (consulta.isLoading) return <Carregando texto="Abrindo o prontuário..." />

  const passagens = consulta.data ?? []
  const primeira = passagens[passagens.length - 1]
  const placa = passagens[0]?.placa

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
      <div>
        <Link
          to="/clientes"
          className="-my-2 inline-flex items-center gap-1 py-3 text-xs text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar
        </Link>
      </div>

      <header>
        <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900">
          <FileText className="size-5 text-slate-400" aria-hidden />
          Prontuário do carro
          {placa && <Placa placa={placa} tamanho="md" />}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tudo que esta oficina já fez neste carro. Toque numa passagem para ver as peças, os
          serviços e o que o mecânico anotou.
        </p>
      </header>

      {passagens.length === 0 ? (
        <Cartao>
          <Vazio
            icone={<FileText className="size-10" />}
            titulo="Este carro ainda não tem histórico aqui"
            descricao="A primeira passagem aparece assim que a OS for aberta."
          />
        </Cartao>
      ) : (
        <>
          <p className="text-xs text-slate-600">
            {plural(passagens.length, 'passagem', 'ns')} pela oficina
            {primeira?.entradaEm && ` · a primeira em ${dataCompleta(primeira.entradaEm)}`}
          </p>

          <div className="space-y-2">
            {passagens.map((p) => {
              const expandido = aberto === p.osId
              const cores = CORES_STATUS[p.status]
              const nada =
                p.servicos.length === 0 && p.pecas.length === 0 && p.anotacoes.length === 0

              return (
                <Cartao key={p.osId} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAberto(expandido ? null : p.osId)}
                    aria-expanded={expandido}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                  >
                    {expandido ? (
                      <ChevronDown className="size-4 flex-none text-slate-400" aria-hidden />
                    ) : (
                      <ChevronRight className="size-4 flex-none text-slate-400" aria-hidden />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {dataCompleta(p.entregueEm ?? p.entradaEm)}
                        </span>
                        <Etiqueta className={cores.chip}>{p.statusDescricao}</Etiqueta>
                        <span className="text-xs text-slate-500">OS #{p.numero}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-600">
                        {p.servicos.length > 0
                          ? p.servicos.join(' · ')
                          : 'Nenhum serviço registrado'}
                      </span>
                    </span>

                    {p.valorTotal != null && (
                      <span className="flex-none text-sm font-semibold tabular-nums text-slate-800">
                        {moeda(p.valorTotal)}
                      </span>
                    )}
                  </button>

                  {expandido && (
                    <div className="space-y-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
                      {p.queixa && (
                        <Secao titulo="O que o cliente relatou">
                          <p className="text-sm text-slate-700">"{p.queixa}"</p>
                        </Secao>
                      )}

                      {p.servicos.length > 0 && (
                        <Secao titulo="Serviços feitos" Icone={Wrench}>
                          <ul className="space-y-0.5">
                            {p.servicos.map((nome, i) => (
                              <li key={i} className="text-sm text-slate-700">
                                • {nome}
                              </li>
                            ))}
                          </ul>
                        </Secao>
                      )}

                      {p.pecas.length > 0 && (
                        <Secao titulo="Peças que entraram" Icone={Package}>
                          <ul className="space-y-0.5">
                            {p.pecas.map((nome, i) => (
                              <li key={i} className="text-sm text-slate-700">
                                • {nome}
                              </li>
                            ))}
                          </ul>
                        </Secao>
                      )}

                      {/* O pedaco que nenhum relatorio tem: o que a pessoa
                          que mexeu no carro observou. E o que faz um
                          prontuario valer mais que uma nota fiscal. */}
                      {p.anotacoes.length > 0 && (
                        <Secao titulo="O que o mecânico anotou">
                          <ul className="space-y-1.5">
                            {p.anotacoes.map((texto, i) => (
                              <li
                                key={i}
                                className="rounded-lg bg-white p-2.5 text-sm leading-snug text-slate-700 ring-1 ring-slate-200"
                              >
                                {texto}
                              </li>
                            ))}
                          </ul>
                        </Secao>
                      )}

                      {nada && (
                        <p className="text-sm text-slate-500">
                          Esta passagem não tem serviço, peça nem anotação registrados.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                        {p.kmEntrada != null && <span>{p.kmEntrada.toLocaleString('pt-BR')} km</span>}
                        {p.mecanicos.length > 0 && <span>· {p.mecanicos.join(', ')}</span>}
                        <Link
                          to={`/os/${p.osId}`}
                          className="ml-auto -my-2 inline-flex items-center py-2 font-medium text-marca-700 hover:underline"
                        >
                          Abrir a OS
                        </Link>
                      </div>
                    </div>
                  )}
                </Cartao>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Secao({
  titulo,
  Icone,
  children,
}: {
  titulo: string
  Icone?: typeof Wrench
  children: React.ReactNode
}) {
  return (
    <div>
      <p className={cx('mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600')}>
        {Icone && <Icone className="size-3.5" aria-hidden />}
        {titulo}
      </p>
      {children}
    </div>
  )
}
