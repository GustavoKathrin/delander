import { cx } from '../../components/ui'
import type { ModuloLeitura } from '../../types'

/**
 * A tabela com a cara do scanner: NO. / Nome / Valor / MIN / MÁX / Unidade.
 *
 * De propósito igual à tela do aparelho — o mecânico já sabe ler essa tabela,
 * e reaprender layout para o mesmo dado é custo sem ganho.
 *
 * `comparar` liga a coluna de diferença contra a leitura oficial. Isso é o que
 * responde "como fica quando o carro está com problema no frio": as duas
 * leituras já estão no cliente, então o delta sai sem ida ao servidor.
 */
export function TabelaScanner({
  modulos,
  comparar,
  editavel,
  onMudarItem,
  onMudarModulo,
}: {
  modulos: ModuloLeitura[]
  comparar?: ModuloLeitura[]
  editavel?: boolean
  onMudarItem?: (modulo: number, item: number, campo: 'nome' | 'valor' | 'unidade', valor: string) => void
  onMudarModulo?: (modulo: number, nome: string) => void
}) {
  const oficialDoItem = (nomeModulo: string, nomeItem: string) =>
    comparar
      ?.find((m) => m.nome === nomeModulo)
      ?.itens.find((i) => i.nome === nomeItem)

  return (
    <div className="space-y-4">
      {modulos.map((modulo, im) => (
        <section key={modulo.id ?? `${modulo.nome}-${im}`} className="overflow-hidden rounded-lg ring-1 ring-slate-200">
          <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 bg-aco-800 px-3 py-2">
            {editavel && onMudarModulo ? (
              <input
                value={modulo.nome}
                onChange={(e) => onMudarModulo(im, e.target.value)}
                className="fonte-display rounded bg-white/10 px-2 py-0.5 text-sm font-bold uppercase tracking-widest text-white outline-none ring-1 ring-white/20 focus:ring-faixa"
                aria-label="Nome do módulo"
              />
            ) : (
              <h3 className="fonte-display text-sm font-bold uppercase tracking-widest text-white">
                {modulo.nome}
              </h3>
            )}
            <span className="text-[11px] text-zinc-400">{modulo.itens.length} itens</span>
            {modulo.caminho && (
              <span className="ml-auto truncate text-[10px] text-zinc-500" title={modulo.caminho}>
                {modulo.caminho}
              </span>
            )}
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="w-12 px-2 py-1.5 font-semibold">Nº</th>
                  <th className="px-2 py-1.5 font-semibold">Nome</th>
                  <th className="w-24 px-2 py-1.5 text-right font-semibold">Valor</th>
                  {comparar && <th className="w-24 px-2 py-1.5 text-right font-semibold">Oficial</th>}
                  <th className="w-20 px-2 py-1.5 text-right font-semibold">Mín</th>
                  <th className="w-20 px-2 py-1.5 text-right font-semibold">Máx</th>
                  <th className="w-20 px-2 py-1.5 font-semibold">Un.</th>
                </tr>
              </thead>
              <tbody>
                {modulo.itens.map((item, ii) => {
                  const oficial = oficialDoItem(modulo.nome, item.nome)
                  const diferente =
                    oficial?.valorNumerico != null &&
                    item.valorNumerico != null &&
                    oficial.valorNumerico !== item.valorNumerico

                  return (
                    <tr
                      key={item.id ?? `${item.nome}-${ii}`}
                      className={cx(
                        'border-b border-slate-100 last:border-0',
                        item.foraDaFaixa && 'bg-red-50',
                      )}
                    >
                      <td className="px-2 py-1 tabular-nums text-slate-400">{item.numero ?? '—'}</td>
                      <td className="px-2 py-1">
                        {editavel && onMudarItem ? (
                          <input
                            value={item.nome}
                            onChange={(e) => onMudarItem(im, ii, 'nome', e.target.value)}
                            className="w-full rounded border border-slate-200 px-1 py-0.5 text-sm outline-none focus:border-marca-500"
                          />
                        ) : (
                          item.nome
                        )}
                      </td>
                      <td
                        className={cx(
                          'px-2 py-1 text-right font-mono tabular-nums',
                          item.foraDaFaixa ? 'font-bold text-red-700' : 'text-slate-900',
                        )}
                      >
                        {editavel && onMudarItem ? (
                          <input
                            value={item.valor ?? ''}
                            onChange={(e) => onMudarItem(im, ii, 'valor', e.target.value)}
                            className="w-full rounded border border-slate-200 px-1 py-0.5 text-right font-mono text-sm outline-none focus:border-marca-500"
                          />
                        ) : (
                          (item.valor ?? '—')
                        )}
                      </td>
                      {comparar && (
                        <td
                          className={cx(
                            'px-2 py-1 text-right font-mono tabular-nums',
                            diferente ? 'font-semibold text-amber-700' : 'text-slate-400',
                          )}
                        >
                          {oficial?.valor ?? '—'}
                        </td>
                      )}
                      <td className="px-2 py-1 text-right font-mono tabular-nums text-slate-400">
                        {item.minimo ?? '—'}
                      </td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums text-slate-400">
                        {item.maximo ?? '—'}
                      </td>
                      <td className="px-2 py-1 text-[11px] text-slate-500">
                        {editavel && onMudarItem ? (
                          <input
                            value={item.unidade ?? ''}
                            onChange={(e) => onMudarItem(im, ii, 'unidade', e.target.value)}
                            className="w-full rounded border border-slate-200 px-1 py-0.5 text-[11px] outline-none focus:border-marca-500"
                          />
                        ) : (
                          (item.unidade ?? '')
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
