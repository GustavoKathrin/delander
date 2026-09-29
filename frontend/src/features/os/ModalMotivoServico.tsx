import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, PauseCircle } from 'lucide-react'
import { api } from '../../api/client'
import {
  AreaTexto,
  AvisoErro,
  Botao,
  Campo,
  Etiqueta,
  Interruptor,
  Modal,
  cx,
} from '../../components/ui'
import { CHAVES, useConfig } from '../../lib/config'
import type { MotivoParada, StatusItem } from '../../types'

export type AcaoServico = 'PAUSAR' | 'CANCELAR' | 'CONCLUIR'

/**
 * A pergunta que acompanha mudar o estado de um serviço.
 *
 * Um componente para as três ações, e não três modais: pausar já tinha o
 * dele no Painel do mecânico, e copiá-lo era a maneira certa de, em três
 * meses, a tela da OS e o painel pedirem coisas diferentes para a mesma
 * coisa. O que muda entre as ações é o título, quais campos aparecem e o
 * rótulo do botão — o resto é igual porque é igual mesmo.
 *
 * Cancelar **não** usa a lista de motivos de parada. Aquela taxonomia mede
 * por que o carro está parado e alimenta o relatório de horas perdidas;
 * "cliente desistiu" não é uma parada, e jogá-la lá contaminaria o único
 * gráfico que o dono usa para achar o gargalo.
 */
export function ModalMotivoServico({
  acao,
  descricaoDoServico,
  semCronometro,
  salvando,
  erro,
  onFechar,
  onConfirmar,
}: {
  acao: AcaoServico | null
  descricaoDoServico: string
  /** Concluir sem nunca ter rodado o cronômetro: a tela avisa antes. */
  semCronometro?: boolean
  salvando: boolean
  erro?: string
  onFechar: () => void
  onConfirmar: (corpo: {
    status: StatusItem
    motivoParadaId?: string
    descricao?: string
    visivelCliente?: boolean
  }) => void
}) {
  const { flag } = useConfig()
  const [motivoId, setMotivoId] = useState('')
  const [texto, setTexto] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(false)

  const motivos = useQuery({
    queryKey: ['motivos-parada'],
    queryFn: () => api<MotivoParada[]>('/motivos-parada?apenasAtivos=true'),
    enabled: acao === 'PAUSAR',
  })

  useEffect(() => {
    if (!acao) return
    setMotivoId('')
    setTexto('')
    setVisivelCliente(false)
  }, [acao])

  if (!acao) return null

  const config = {
    PAUSAR: {
      titulo: 'Pausar o serviço',
      descricao:
        'Diga o que travou. Isso não é cobrança — é o que mostra ao dono onde está o gargalo.',
      rotulo: 'Pausar',
      status: 'PAUSADO' as StatusItem,
      variante: 'secundario' as const,
      icone: <PauseCircle className="size-4" aria-hidden />,
    },
    CANCELAR: {
      titulo: 'Cancelar o serviço',
      descricao:
        'Ele sai do orçamento e deixa de ser cobrado. Fica na OS com o motivo, para quem abrir depois entender.',
      rotulo: 'Cancelar serviço',
      status: 'CANCELADO' as StatusItem,
      variante: 'perigo' as const,
      icone: <AlertTriangle className="size-4" aria-hidden />,
    },
    CONCLUIR: {
      titulo: 'Concluir o serviço',
      descricao: 'O que foi feito. Entra no histórico do carro.',
      rotulo: 'Concluir',
      status: 'CONCLUIDO' as StatusItem,
      variante: 'sucesso' as const,
      icone: <Check className="size-4" aria-hidden />,
    },
  }[acao]

  const exigeMotivo = acao === 'PAUSAR' && flag(CHAVES.exigirMotivoPausa)
  const pronto = !exigeMotivo || Boolean(motivoId)

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={config.titulo}
      descricao={`${descricaoDoServico} · ${config.descricao}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Voltar
          </Botao>
          <Botao
            variante={config.variante}
            carregando={salvando}
            disabled={!pronto}
            onClick={() =>
              onConfirmar({
                status: config.status,
                motivoParadaId: motivoId || undefined,
                descricao: texto.trim() || undefined,
                visivelCliente,
              })
            }
          >
            {config.icone}
            {config.rotulo}
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {acao === 'PAUSAR' && (
          <Campo rotulo="O que travou?" obrigatorio={exigeMotivo}>
            <div className="grid gap-2">
              {(motivos.data ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMotivoId(m.id)
                    setVisivelCliente(m.visivelClientePadrao)
                  }}
                  className={cx(
                    'flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm ring-1 transition',
                    motivoId === m.id
                      ? 'bg-marca-50 text-marca-900 ring-marca-400'
                      : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  <span>{m.nome}</span>
                  <Etiqueta className="bg-slate-100 text-slate-500 ring-slate-200">
                    {m.categoriaDescricao}
                  </Etiqueta>
                </button>
              ))}
            </div>
          </Campo>
        )}

        {/* Concluir sem cronômetro entra com zero hora, e isso precisa ser
            dito antes e não depois: hora só vem do relógio, e um serviço
            concluído sem relógio puxa o aproveitamento da oficina para baixo. */}
        {acao === 'CONCLUIR' && semCronometro && (
          <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 ring-1 ring-amber-200">
            Este serviço não teve cronômetro — vai entrar com <strong>0h trabalhadas</strong>.
          </p>
        )}

        <Campo
          rotulo={
            acao === 'CANCELAR'
              ? 'Por que não vai ser feito?'
              : acao === 'CONCLUIR'
                ? 'O que foi feito (opcional)'
                : 'Detalhe (opcional)'
          }
          dica={
            acao === 'CANCELAR'
              ? 'Fica salvo na linha do serviço — quem abrir a OS daqui a um mês entende sem perguntar.'
              : undefined
          }
        >
          <AreaTexto
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              acao === 'CANCELAR'
                ? 'Ex.: cliente pediu para tirar, vai fazer depois.'
                : acao === 'CONCLUIR'
                  ? 'Ex.: trocado e testado, sem folga.'
                  : 'Ex.: falta o retentor do lado direito.'
            }
          />
        </Campo>

        <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
          <Interruptor
            ativo={visivelCliente}
            rotulo="O cliente pode ver isto"
            onChange={setVisivelCliente}
          />
        </div>

        <AvisoErro mensagem={erro} />
      </div>
    </Modal>
  )
}
