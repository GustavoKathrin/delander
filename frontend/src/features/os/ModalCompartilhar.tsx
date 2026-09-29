import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, MessageCircle, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'
import type { CompartilhamentoOs, DetalheOs } from '../../types'
import { Botao, Interruptor, Modal, cx, useAviso } from '../../components/ui'
import { dataCompleta, telefoneWhatsapp } from '../../lib/format'

/** Rotulos amigaveis para as chaves de escopo do link publico. */
/**
 * O que o link pode mostrar.
 *
 * `basico` é o preset que a maioria das oficinas quer: o cliente acompanha o
 * carro sem ver preço nem quem está com ele. `confirmaAoLigar` marca o que
 * pede uma confirmação antes de ir para a rua.
 */
const ESCOPO: {
  chave: string
  rotulo: string
  descricao: string
  basico: boolean
  confirmaAoLigar?: boolean
}[] = [
  {
    chave: 'compartilhamento.mostrar_itens',
    rotulo: 'Lista de serviços',
    descricao: 'O cliente vê cada serviço e se já foi concluído',
    basico: true,
  },
  {
    chave: 'compartilhamento.mostrar_previsao_entrega',
    rotulo: 'Previsão de entrega',
    descricao: 'Mostra a data prometida',
    basico: true,
  },
  {
    chave: 'compartilhamento.mostrar_paradas',
    rotulo: 'Avisar quando estiver parado',
    descricao: 'Mostra que o serviço está aguardando algo',
    basico: true,
  },
  {
    chave: 'compartilhamento.mostrar_motivo_parada',
    rotulo: 'Motivo da parada',
    descricao: 'Ex.: "falta de peça". Se desligado, aparece apenas "aguardando etapa externa"',
    basico: true,
  },
  {
    chave: 'compartilhamento.mostrar_tempo_trabalhado',
    rotulo: 'Horas trabalhadas',
    descricao: 'Mostra o tempo de mão de obra já aplicado',
    basico: true,
  },
  {
    chave: 'compartilhamento.mostrar_nome_mecanico',
    rotulo: 'Nome do mecânico',
    descricao: 'Quem está executando cada serviço',
    basico: false,
  },
  {
    chave: 'compartilhamento.mostrar_valores',
    rotulo: 'Valores',
    descricao: 'Mostra o total da OS para o cliente',
    basico: false,
    confirmaAoLigar: true,
  },
  {
    chave: 'compartilhamento.mostrar_fotos',
    rotulo: 'Fotos liberadas',
    descricao: 'Somente as fotos marcadas como visíveis para o cliente',
    basico: true,
  },
]

interface Props {
  aberto: boolean
  onFechar: () => void
  os: DetalheOs
}

export default function ModalCompartilhar({ aberto, onFechar, os }: Props) {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [link, setLink] = useState<CompartilhamentoOs | undefined>(os.compartilhamento)
  const [confirmandoValores, setConfirmandoValores] = useState(false)
  const [confirmandoTudo, setConfirmandoTudo] = useState(false)

  const gerar = useMutation({
    mutationFn: () =>
      api<CompartilhamentoOs>(`/os/${os.resumo.id}/compartilhamento`, { metodo: 'POST', corpo: {} }),
    onSuccess: (dados) => {
      setLink(dados)
      avisar('Link de acompanhamento pronto.')
      void queryClient.invalidateQueries({ queryKey: ['os', os.resumo.id] })
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const rotacionar = useMutation({
    mutationFn: () =>
      api<CompartilhamentoOs>(`/os/${os.resumo.id}/compartilhamento/rotacionar`, { metodo: 'POST' }),
    onSuccess: (dados) => {
      setLink(dados)
      avisar('Link novo gerado. O anterior deixou de funcionar.')
      void queryClient.invalidateQueries({ queryKey: ['os', os.resumo.id] })
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const atualizar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) =>
      api<CompartilhamentoOs>(`/compartilhamentos/${link!.id}`, { metodo: 'PATCH', corpo }),
    onSuccess: (dados) => {
      setLink(dados)
      void queryClient.invalidateQueries({ queryKey: ['os', os.resumo.id] })
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const copiar = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      avisar('Link copiado.')
    } catch {
      avisar('Copie o link manualmente do campo acima.', 'erro')
    }
  }

  const whatsapp = telefoneWhatsapp(os.resumo.clienteTelefone)
  const textoWhatsapp = link
    ? encodeURIComponent(
        `Ola, ${os.resumo.clienteNome.split(' ')[0]}! Acompanhe o servico do seu ${os.resumo.veiculo} (${os.resumo.placa}) por aqui: ${link.url}`,
      )
    : ''

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Acompanhamento do cliente"
      descricao="Link somente leitura. Você escolhe o que ele mostra."
      largura="max-w-xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Fechar
          </Botao>
          {link && (
            <Botao
              variante="secundario"
              carregando={rotacionar.isPending}
              onClick={() => rotacionar.mutate()}
            >
              <RefreshCw className="size-4" aria-hidden />
              Gerar link novo
            </Botao>
          )}
        </>
      }
    >
      {!link ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-600">
            Esta OS ainda não tem link de acompanhamento. O cliente poderá ver a situação do carro
            sem precisar ligar para a oficina.
          </p>
          <Botao tamanho="lg" carregando={gerar.isPending} onClick={() => gerar.mutate()}>
            Gerar link de acompanhamento
          </Botao>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 sm:flex-row sm:items-start">
            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <QRCodeSVG value={link.url} size={112} level="M" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link.url}
                  aria-label="Link de acompanhamento"
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border-0 bg-white px-2.5 py-2 text-xs text-slate-700 ring-1 ring-slate-300"
                />
                <Botao tamanho="sm" onClick={copiar}>
                  <Copy className="size-3.5" aria-hidden />
                  Copiar
                </Botao>
              </div>

              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}?text=${textoWhatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="size-3.5" aria-hidden />
                  Enviar pelo WhatsApp
                </a>
              )}

              <p className="text-[11px] text-slate-500">
                {link.expiraEm ? `Expira em ${dataCompleta(link.expiraEm)}` : 'Sem data de expiração'}
                {' · '}
                {link.totalAcessos} acesso(s)
                {link.pin && ` · código de acesso: ${link.pin}`}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-700">O que este link mostra</p>
            <p className="mb-2 text-[11px] text-slate-500">
              Vale só para esta OS. O padrão de toda a oficina fica em Configurações, e cada cliente
              pode ter a própria preferência.
            </p>
            {/* Dois presets, porque mudar quatro coisas eram quatro toques e
                quatro idas ao servidor. "Só o básico" é o que a maioria das
                oficinas quer: o cliente acompanha sem ver preço nem nome de
                quem está com o carro. */}
            <div className="mb-2 flex gap-2">
              <Botao
                variante="secundario"
                tamanho="sm"
                disabled={atualizar.isPending}
                onClick={() =>
                  atualizar.mutate({
                    escopo: Object.fromEntries(ESCOPO.map((i) => [i.chave, i.basico])),
                  })
                }
              >
                Só o básico
              </Botao>
              <Botao
                variante="secundario"
                tamanho="sm"
                disabled={atualizar.isPending}
                onClick={() => setConfirmandoTudo(true)}
              >
                Mostrar tudo
              </Botao>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {ESCOPO.map((item) => (
                <div key={item.chave} className="px-3">
                  <Interruptor
                    ativo={Boolean(link.escopo[item.chave])}
                    rotulo={item.rotulo}
                    descricao={item.descricao}
                    desabilitado={atualizar.isPending}
                    onChange={(valor) => {
                      // Valor é o único que pede confirmação: os outros o
                      // cliente já podia perguntar por telefone; o preço é o
                      // que vira discussão se aparecer antes da hora.
                      if (item.confirmaAoLigar && valor) {
                        setConfirmandoValores(true)
                        return
                      }
                      atualizar.mutate({ escopo: { ...link.escopo, [item.chave]: valor } })
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
            <Interruptor
              ativo={link.ativo}
              rotulo="Link ativo"
              descricao="Desligue para cortar o acesso do cliente imediatamente"
              desabilitado={atualizar.isPending}
              onChange={(valor) => atualizar.mutate({ ativo: valor })}
            />
          </div>

          <p className={cx('text-[11px] text-slate-400')}>
            O endereço contém um código aleatório de 32 bytes. Quem tiver o link vê a situação
            desta OS — por isso o acesso é somente leitura, expira e pode ser desligado a qualquer
            momento.
          </p>
        </div>
      )}

      {/* Valor pede confirmação porque é o único que muda uma conversa.
          Serviço, foto e previsão o cliente já podia perguntar por telefone;
          o preço, aparecendo antes de alguém explicar, vira discussão. */}
      <Modal
        aberto={confirmandoValores}
        onFechar={() => setConfirmandoValores(false)}
        titulo="Mostrar os valores para o cliente?"
        descricao="Ele vai ver o preço de cada serviço e o total desta OS, a qualquer hora, pelo link."
        largura="max-w-md"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmandoValores(false)}>
              Não mostrar
            </Botao>
            <Botao
              carregando={atualizar.isPending}
              onClick={() => {
                atualizar.mutate({
                  escopo: { ...(link?.escopo ?? {}), 'compartilhamento.mostrar_valores': true },
                })
                setConfirmandoValores(false)
              }}
            >
              Mostrar valores
            </Botao>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Dá para desligar depois — o link é o mesmo e o cliente não precisa de outro.
        </p>
      </Modal>

      <Modal
        aberto={confirmandoTudo}
        onFechar={() => setConfirmandoTudo(false)}
        titulo="Mostrar tudo para o cliente?"
        descricao="Inclui os valores, o nome do mecânico e as fotos liberadas."
        largura="max-w-md"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmandoTudo(false)}>
              Voltar
            </Botao>
            <Botao
              carregando={atualizar.isPending}
              onClick={() => {
                atualizar.mutate({
                  escopo: Object.fromEntries(ESCOPO.map((i) => [i.chave, true])),
                })
                setConfirmandoTudo(false)
              }}
            >
              Mostrar tudo
            </Botao>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Cada item continua podendo ser desligado um a um depois.
        </p>
      </Modal>
    </Modal>
  )
}
