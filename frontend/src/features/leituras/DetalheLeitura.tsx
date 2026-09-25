import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, FileText, GitCompareArrows } from 'lucide-react'
import { api } from '../../api/client'
import type { DetalheLeitura as DetalheTipo, ResumoLeitura } from '../../types'
import {
  Botao,
  Carregando,
  Cartao,
  CartaoTitulo,
  Etiqueta,
  Vazio,
  useAviso,
  cx,
} from '../../components/ui'
import { Placa } from '../../components/oficina'
import { dataHora } from '../../lib/format'
import { TabelaScanner } from './TabelaScanner'

export default function DetalheLeitura() {
  const { id = '' } = useParams()
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [comparando, setComparando] = useState(false)

  const consulta = useQuery({
    queryKey: ['leitura', id],
    queryFn: () => api<DetalheTipo>(`/leituras/${id}`),
  })

  const leitura = consulta.data

  /** As leituras do mesmo carro: é daqui que sai a oficial para comparar. */
  const doCarro = useQuery({
    queryKey: ['leituras-veiculo', leitura?.resumo.veiculoId],
    queryFn: () => api<ResumoLeitura[]>(`/leituras/veiculo/${leitura!.resumo.veiculoId}`),
    enabled: Boolean(leitura?.resumo.veiculoId),
  })

  const oficialId = (doCarro.data ?? []).find(
    (l) => l.tipo === 'OFICIAL' && l.id !== id,
  )?.id

  const oficial = useQuery({
    queryKey: ['leitura', oficialId],
    queryFn: () => api<DetalheTipo>(`/leituras/${oficialId}`),
    enabled: comparando && Boolean(oficialId),
  })

  const oficializar = useMutation({
    mutationFn: () => api<DetalheTipo>(`/leituras/${id}/oficializar`, { metodo: 'POST' }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['leitura', id], dados)
      void queryClient.invalidateQueries({ queryKey: ['leituras'] })
      void queryClient.invalidateQueries({ queryKey: ['leituras-veiculo'] })
      avisar('Agora esta é a leitura oficial do carro.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  if (consulta.isLoading) return <Carregando texto="Abrindo a leitura..." />
  if (consulta.isError || !leitura) {
    return (
      <div className="p-4">
        <Vazio titulo="Leitura não encontrada" descricao={(consulta.error as Error)?.message} />
      </div>
    )
  }

  const r = leitura.resumo

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Link
        to="/leituras"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Leituras
      </Link>

      <Cartao>
        <div className="flex flex-wrap items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {r.placa && <Placa placa={r.placa} tamanho="md" />}
              {/* O tipo é a informação mais pesada desta tela: uma leitura
                  OFICIAL é a régua contra a qual todas as outras do mesmo
                  modelo são comparadas. Como etiqueta pequena ao lado da
                  placa ela sumia, e confundir a régua com um caso qualquer
                  estraga todas as comparações seguintes. */}
              <span
                className={cx(
                  'fonte-display inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-extrabold uppercase tracking-wider ring-1',
                  r.tipo === 'OFICIAL'
                    ? 'bg-emerald-500 text-white ring-emerald-600'
                    : 'bg-amber-100 text-amber-900 ring-amber-300',
                )}
              >
                {r.tipo === 'OFICIAL' && <BadgeCheck className="size-4" aria-hidden />}
                {r.tipo === 'OFICIAL' ? 'Leitura oficial' : r.tipoDescricao}
              </span>
              <Etiqueta>{r.motorLigado ? 'motor ligado' : 'motor desligado'}</Etiqueta>
              <Etiqueta>{r.ignicaoLigada ? 'ignição ligada' : 'ignição desligada'}</Etiqueta>
            </div>

            <h1 className="mt-2 text-lg font-semibold text-slate-900">{r.modeloDescricao}</h1>
            {r.motor && <p className="text-sm text-slate-500">motor {r.motor}</p>}

            {r.condicao && (
              <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                {r.condicao}
              </p>
            )}
            {leitura.descricao && (
              <p className="mt-1.5 text-sm text-slate-600">{leitura.descricao}</p>
            )}

            <p className="mt-2 text-xs text-slate-500">
              {r.modulos} módulo(s) · {r.itens} itens
              {r.km ? ` · ${r.km.toLocaleString('pt-BR')} km` : ''}
              {r.momentoTeste ? ` · ${dataHora(r.momentoTeste)}` : ''}
            </p>
            {leitura.ferramenta && (
              <p className="text-xs text-slate-400">
                {leitura.ferramenta} {leitura.ferramentaVersao ?? ''}
                {leitura.numeroRelatorio ? ` · relatório ${leitura.numeroRelatorio}` : ''}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {r.tipo !== 'OFICIAL' && r.veiculoId && (
              <Botao onClick={() => oficializar.mutate()} carregando={oficializar.isPending}>
                Marcar como oficial
              </Botao>
            )}
            {oficialId && (
              <Botao variante="secundario" onClick={() => setComparando((v) => !v)}>
                <GitCompareArrows className="size-4" aria-hidden />
                {comparando ? 'Parar de comparar' : 'Comparar com a oficial'}
              </Botao>
            )}
            {leitura.arquivoId && (
              <a
                href={`/api/leituras/${id}/arquivo`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-50"
              >
                <FileText className="size-4" aria-hidden />
                PDF original
              </a>
            )}
          </div>
        </div>
      </Cartao>

      {comparando && oficial.data && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800 ring-1 ring-blue-200">
          A coluna <strong>Oficial</strong> mostra o valor da leitura boa do mesmo carro. Diferença
          em âmbar; valor fora da faixa do próprio relatório em vermelho.
        </p>
      )}

      <TabelaScanner
        modulos={leitura.modulos}
        comparar={comparando ? oficial.data?.modulos : undefined}
      />

      {(doCarro.data ?? []).length > 1 && (
        <Cartao>
          <CartaoTitulo
            titulo="Outras leituras deste carro"
            descricao="A oficial mostra como ele lê bom; as anomalias, como ele leu com defeito"
          />
          <div className="divide-y divide-slate-100">
            {doCarro.data!
              .filter((l) => l.id !== id)
              .map((l) => (
                <Link
                  key={l.id}
                  to={`/leituras/${l.id}`}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50"
                >
                  <Etiqueta
                    className={
                      l.tipo === 'OFICIAL'
                        ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                        : 'bg-amber-100 text-amber-800 ring-amber-200'
                    }
                  >
                    {l.tipoDescricao}
                  </Etiqueta>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {l.condicao ?? l.modeloDescricao}
                  </span>
                  <span className="text-xs text-slate-400">{l.itens} itens</span>
                </Link>
              ))}
          </div>
        </Cartao>
      )}
    </div>
  )
}
