import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { api } from '../../api/client'
import { Botao, Carregando, Vazio } from '../../components/ui'
import { LogoDelander } from '../../components/LogoDelander'
import { useConfig, CHAVES } from '../../lib/config'
import { dataCompleta, dataHora, horas, moeda } from '../../lib/format'
import type { DetalheOs } from '../../types'

/**
 * A ficha do carro, para imprimir ou entregar ao cliente.
 *
 * Existe porque o botão "Ficha" era `window.print()` da tela de trabalho:
 * saía o menu de aço, os botões de ação, a linha do tempo inteira e nenhum
 * cabeçalho. Era o print de um sistema, não um documento da oficina — e
 * ninguém entrega isso para o cliente.
 *
 * Aqui é o contrário: uma página que **só** existe para virar papel. Nada
 * de interação, nada de navegação no que sai impresso, e a informação na
 * ordem em que alguém lê uma ficha — quem é o carro, o que foi feito,
 * quanto custou.
 *
 * Não é PDF gerado no servidor de propósito. O navegador já imprime e já
 * salva em PDF; gerar no servidor custaria uma dependência nova (iText é
 * AGPL e não serve aqui) para entregar o mesmo papel.
 */
export default function FichaOs() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const { texto } = useConfig()

  const consulta = useQuery({
    queryKey: ['os', id],
    queryFn: () => api<DetalheOs>(`/os/${id}`),
    enabled: Boolean(id),
  })

  // O título da janela vira o nome do arquivo quando o navegador salva em
  // PDF. "Delander · Auto Car" não ajuda ninguém a achar depois.
  useEffect(() => {
    const anterior = document.title
    if (consulta.data) {
      const r = consulta.data.resumo
      document.title = `Ficha OS ${r.numero} - ${r.placa}`
    }
    return () => {
      document.title = anterior
    }
  }, [consulta.data])

  if (consulta.isLoading) return <Carregando texto="Montando a ficha..." />
  if (consulta.isError || !consulta.data) {
    return (
      <div className="p-4">
        <Vazio
          titulo="Não foi possível abrir a ficha"
          descricao={(consulta.error as Error)?.message}
          acao={<Botao onClick={() => navegar(-1)}>Voltar</Botao>}
        />
      </div>
    )
  }

  const os = consulta.data
  const r = os.resumo
  const nomeOficina = texto(CHAVES.nomeOficina, 'Delander')

  const pecasCobradas = os.pecas.filter((p) => p.status !== 'CANCELADA')

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-slate-900 print:max-w-none print:p-0">
      {/* Barra de ações — não sai no papel. */}
      <div className="mb-6 flex items-center gap-2 sem-impressao">
        <Botao variante="secundario" tamanho="sm" onClick={() => navegar(`/os/${id}`)}>
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar para a OS
        </Botao>
        <Botao tamanho="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden />
          Imprimir ou salvar em PDF
        </Botao>
      </div>

      {/* ---------------- cabeçalho ---------------- */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
        <div>
          <LogoDelander altura={34} variante="claro" />
          <p className="mt-1 text-xs text-slate-500">{nomeOficina}</p>
        </div>
        <div className="text-right">
          <h1 className="text-lg font-bold uppercase tracking-wide">Ficha de serviço</h1>
          <p className="text-sm text-slate-600">
            OS nº <span className="font-semibold text-slate-900">{r.numero}</span>
          </p>
          <p className="text-xs text-slate-500">Emitida em {dataHora(new Date().toISOString())}</p>
        </div>
      </header>

      {/* ---------------- identificação ----------------
          Placa em destaque porque é por ela que a oficina e o cliente
          reconhecem o carro; o nome do modelo vem depois. */}
      <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <Linha rotulo="Placa">
          <span className="font-mono text-base font-bold tracking-wider">{r.placa}</span>
        </Linha>
        <Linha rotulo="Veículo">
          {r.veiculo}
          {r.cor && ` · ${r.cor}`}
        </Linha>
        <Linha rotulo="Cliente">{r.clienteNome}</Linha>
        <Linha rotulo="Telefone">{r.clienteTelefone ?? '—'}</Linha>
        <Linha rotulo="Entrada">{dataCompleta(os.entradaEm)}</Linha>
        <Linha rotulo="Entrega prometida">
          {r.previsaoEntrega ? dataCompleta(r.previsaoEntrega) : 'a combinar'}
        </Linha>
        <Linha rotulo="KM de entrada">
          {os.kmEntrada ? `${os.kmEntrada.toLocaleString('pt-BR')} km` : '—'}
        </Linha>
        <Linha rotulo="Situação">{r.statusDescricao}</Linha>
      </section>

      {r.queixa && (
        <section className="mt-5">
          <Titulo>Relato do cliente</Titulo>
          <p className="mt-1 text-sm text-slate-700">{r.queixa}</p>
        </section>
      )}

      {os.diagnostico && (
        <section className="mt-5">
          <Titulo>Diagnóstico da oficina</Titulo>
          <p className="mt-1 text-sm text-slate-700">{os.diagnostico}</p>
        </section>
      )}

      {/* ---------------- serviços ---------------- */}
      <section className="mt-5">
        <Titulo>Serviços</Titulo>
        {os.itens.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">Nenhum serviço lançado.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="py-1.5 font-medium">Descrição</th>
                <th className="py-1.5 font-medium">Responsável</th>
                <th className="py-1.5 text-right font-medium">Horas</th>
                <th className="py-1.5 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {os.itens.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-3">{item.descricao}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{item.funcionarioNome ?? '—'}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">
                    {horas(item.horasTrabalhadas)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {item.valor != null ? moeda(item.valor) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------------- peças ----------------
          Peça cancelada fica de fora: ela não entra no valor, e listar um
          item que não se paga é o tipo de linha que gera discussão no balcão. */}
      {pecasCobradas.length > 0 && (
        <section className="mt-5">
          <Titulo>Peças</Titulo>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="py-1.5 font-medium">Peça</th>
                <th className="py-1.5 font-medium">Origem</th>
                <th className="py-1.5 text-right font-medium">Qtd.</th>
                <th className="py-1.5 text-right font-medium">Unitário</th>
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {pecasCobradas.map((peca) => (
                <tr key={peca.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">{peca.descricao}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{peca.origemDescricao}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">
                    {peca.quantidade}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">
                    {peca.valorUnitario != null ? moeda(peca.valorUnitario) : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{moeda(peca.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ---------------- valores ---------------- */}
      <section className="mt-6 flex justify-end break-inside-avoid">
        <div className="w-full max-w-xs space-y-1 text-sm">
          <ValorLinha rotulo="Peças" valor={os.valorPecas} />
          <ValorLinha rotulo="Mão de obra" valor={os.valorMaoObra} />
          {os.desconto > 0 && <ValorLinha rotulo="Desconto" valor={-os.desconto} />}
          <div className="flex items-baseline justify-between border-t-2 border-slate-900 pt-1.5">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold tabular-nums">{moeda(os.valorTotal)}</span>
          </div>
        </div>
      </section>

      {/* ---------------- assinaturas ----------------
          A ficha impressa costuma virar o comprovante de retirada. Sem as
          duas linhas, alguém escreve por cima na diagonal. */}
      <section className="mt-12 grid grid-cols-2 gap-10 break-inside-avoid text-center text-xs text-slate-600">
        <div>
          <div className="border-t border-slate-400 pt-1.5">Responsável pela oficina</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1.5">
            {r.clienteNome}
            <div className="text-[10px] text-slate-400">Cliente — retirada do veículo</div>
          </div>
        </div>
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">
        {nomeOficina} · Ficha da OS nº {r.numero} · placa {r.placa}
      </footer>
    </div>
  )
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-slate-300 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{rotulo}</div>
      <div className="text-slate-900">{children}</div>
    </div>
  )
}

function ValorLinha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-slate-600">{rotulo}</span>
      <span className="tabular-nums">{moeda(valor)}</span>
    </div>
  )
}
