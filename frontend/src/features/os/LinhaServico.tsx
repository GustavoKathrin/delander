import { AlertTriangle, Check, Clock, MessageSquarePlus, PauseCircle, Play, Trash2, User } from 'lucide-react'
import { Botao, Etiqueta, Selecao, cx } from '../../components/ui'
import { CORES_ITEM, horaMinuto, horas, moeda } from '../../lib/format'
import type { Funcionario, ItemOs, StatusItem } from '../../types'
import type { AcaoServico } from './ModalMotivoServico'

/**
 * Um serviço da OS, com o que dá para fazer com ele agora.
 *
 * Antes daqui a linha era quase inerte: dava para trocar o mecânico e apagar,
 * e mais nada. Concluir, pausar e retomar moravam em outra tela e eram
 * endereçados pelo apontamento — o mecânico com o carro na frente tinha que
 * sair da OS para dizer que acabou um serviço de dois minutos.
 *
 * Os botões ficam **sempre visíveis**, e não atrás de um "…": o pedido foi
 * literalmente "botões rápidos ali". Quais aparecem vem do servidor, em
 * `item.proximosStatus` — a tela não decide o que é possível, ela desenha.
 */
export function LinhaServico({
  item,
  gerencia,
  mostraValores,
  funcionarios,
  salvando,
  onAtribuir,
  onAcao,
  onIniciar,
  onRegistrarTrabalho,
  onRemover,
}: {
  item: ItemOs
  gerencia: boolean
  mostraValores: boolean
  funcionarios: Funcionario[]
  salvando: boolean
  onAtribuir: (funcionarioId: string) => void
  /** Abre o modal que pergunta o motivo antes de mudar o estado. */
  onAcao: (acao: AcaoServico) => void
  /** Iniciar não passa por modal: é um toque só, com o carro na frente. */
  onIniciar: () => void
  onRegistrarTrabalho: () => void
  onRemover: () => void
}) {
  const pode = (status: StatusItem) => item.proximosStatus.includes(status)
  const cancelado = item.status === 'CANCELADO'
  const concluido = item.status === 'CONCLUIDO'

  return (
    <li className={cx('px-4 py-3', cancelado && 'bg-slate-50/70')}>
      {/* linha de cima: o que é o serviço */}
      <div className="flex flex-wrap items-center gap-2">
        <p
          className={cx(
            'text-sm font-medium',
            cancelado ? 'text-slate-400 line-through' : 'text-slate-800',
          )}
        >
          {item.descricao}
        </p>
        <Etiqueta className={CORES_ITEM[item.status]}>{item.statusDescricao}</Etiqueta>
        {item.especialidadeNome && (
          <Etiqueta className="text-white ring-transparent" titulo="Especialidade exigida">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: item.especialidadeCor ?? '#64748b' }}
              aria-hidden
            />
            <span className="text-slate-600">{item.especialidadeNome}</span>
          </Etiqueta>
        )}
        {item.apontamentoAberto && (
          <Etiqueta className="bg-blue-100 text-blue-700 ring-blue-200">
            <Clock className="size-2.5 pulsando" aria-hidden />
            rodando desde {horaMinuto(item.apontamentoInicio)}
          </Etiqueta>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {horas(item.horasTrabalhadas)} de {horas(item.horasEstimadas)}
          {mostraValores && item.valor !== undefined && ` · ${moeda(item.valor)}`}
        </span>
      </div>

      {/* O motivo do cancelamento fica na linha, e não escondido na linha do
          tempo: quem abre a OS um mês depois precisa entender sem caçar. */}
      {cancelado && item.motivoCancelamento && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
          <AlertTriangle className="mt-0.5 size-3 flex-none" aria-hidden />
          Cancelado: {item.motivoCancelamento}
        </p>
      )}

      {/* linha de baixo: quem faz e o que fazer */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {gerencia && !cancelado ? (
          <Selecao
            aria-label={`Mecânico de ${item.descricao}`}
            className="h-8 w-40 py-1 text-xs"
            value={item.funcionarioId ?? ''}
            onChange={(e) => e.target.value && onAtribuir(e.target.value)}
          >
            <option value="">Sem mecânico</option>
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Selecao>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <User className="size-3" aria-hidden />
            {item.funcionarioNome ?? 'sem mecânico'}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {pode('EM_EXECUCAO') && (
            <Botao variante="primario" tamanho="sm" carregando={salvando} onClick={onIniciar}>
              <Play className="size-3.5" aria-hidden />
              {item.status === 'PAUSADO' ? 'Retomar' : 'Iniciar'}
            </Botao>
          )}
          {pode('PAUSADO') && (
            <Botao
              variante="secundario"
              tamanho="sm"
              carregando={salvando}
              onClick={() => onAcao('PAUSAR')}
            >
              <PauseCircle className="size-3.5" aria-hidden />
              Pausar
            </Botao>
          )}
          {pode('CONCLUIDO') && (
            <Botao
              variante="sucesso"
              tamanho="sm"
              carregando={salvando}
              onClick={() => onAcao('CONCLUIR')}
            >
              <Check className="size-3.5" aria-hidden />
              Concluir
            </Botao>
          )}

          {/* Registrar trabalho é por serviço, e não solto no rodapé da OS:
              tudo no carro é um serviço, então todo trabalho é em cima de um. */}
          {!cancelado && (
            <button
              type="button"
              onClick={onRegistrarTrabalho}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <MessageSquarePlus className="size-3.5" aria-hidden />
              Anotar
            </button>
          )}

          {/* Cancelar em vermelho, como o dono pediu, mas em texto e não em
              botão sólido: ele é terminal, e o modal de motivo é a última
              chance de desistir. */}
          {pode('CANCELADO') && gerencia && (
            <button
              type="button"
              onClick={() => onAcao('CANCELAR')}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
            >
              <AlertTriangle className="size-3.5" aria-hidden />
              Cancelar
            </button>
          )}

          {/* A lixeira agora quer dizer só uma coisa: "lancei errado, tira
              daqui". O que era para ser feito e não vai ser usa Cancelar, que
              guarda o motivo. */}
          {gerencia && !cancelado && !concluido && (
            <button
              type="button"
              onClick={onRemover}
              title="Lancei errado — tirar da lista"
              className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label={`Remover ${item.descricao}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
