import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, Send } from 'lucide-react'
import { api } from '../../api/client'
import { AreaTexto, AvisoErro, Botao, Campo, Modal, cx } from '../../components/ui'
import type { DetalheOs } from '../../types'

/**
 * Anotar o que foi feito **neste serviço**.
 *
 * O registro de trabalho existia solto no rodapé da OS, sem ligação com
 * serviço nenhum. Na linha do tempo ele aparecia misturado com mudança de
 * status e atribuição, e com três serviços no mesmo carro "desmontei a
 * suspensão" não dizia qual deles andou.
 *
 * Aqui ele nasce colado no serviço, que é o que o dono descreveu: tudo no
 * carro é um serviço, então todo trabalho é em cima de um.
 */
export function ModalAnotarServico({
  servico,
  osId,
  onFechar,
  onSalvo,
}: {
  /**
   * Só o id e o nome do serviço.
   *
   * Era `ItemOs`, o item inteiro da tela da OS — e isso trancava a anotação
   * dentro daquela tela. O painel do mecânico tem o mesmo serviço com outro
   * formato (`MeuServico`), e anotar é justamente o que ele quer fazer dali,
   * de dentro do box, sem abrir a OS.
   */
  servico: { id: string; descricao: string } | null
  osId: string
  onFechar: () => void
  onSalvo: (dados: DetalheOs) => void
}) {
  const [texto, setTexto] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(false)
  const [erro, setErro] = useState<string>()

  useEffect(() => {
    if (!servico) return
    setTexto('')
    setVisivelCliente(false)
    setErro(undefined)
  }, [servico])

  const salvar = useMutation({
    mutationFn: () =>
      api<DetalheOs>(`/os/${osId}/trabalho`, {
        metodo: 'POST',
        corpo: { texto: texto.trim(), visivelCliente, osItemId: servico?.id },
      }),
    onSuccess: onSalvo,
    onError: (falha: Error) => setErro(falha.message),
  })

  if (!servico) return null

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Anotar o trabalho"
      descricao={servico.descricao}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Voltar
          </Botao>
          <Botao
            carregando={salvar.isPending}
            disabled={texto.trim().length < 3}
            onClick={() => salvar.mutate()}
          >
            <Send className="size-4" aria-hidden />
            Anotar
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <Campo rotulo="O que você fez">
          <AreaTexto
            autoFocus
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: desmontei a suspensão dianteira, o amortecedor direito está vazando"
          />
        </Campo>

        {/* A visibilidade é por registro e não uma regra da oficina: "achei a
            bomba vazando" o cliente quer ler; "cliente enrolou três dias" é
            conversa interna — e é justamente ela que explica onde o tempo foi. */}
        <button
          type="button"
          onClick={() => setVisivelCliente((v) => !v)}
          className={cx(
            'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium ring-1 transition',
            visivelCliente
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-300'
              : 'bg-slate-100 text-slate-600 ring-slate-300',
          )}
        >
          {visivelCliente ? (
            <Eye className="size-3.5" aria-hidden />
          ) : (
            <EyeOff className="size-3.5" aria-hidden />
          )}
          {visivelCliente ? 'O cliente vê' : 'Só a oficina'}
        </button>

        <AvisoErro mensagem={erro} />
      </div>
    </Modal>
  )
}
