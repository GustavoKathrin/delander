import { useEffect, useMemo, useState } from 'react'
import { Copy, MessageCircle } from 'lucide-react'

import { AreaTexto, Botao, Campo, Modal, cx, useAviso } from '../../components/ui'
import { moeda } from '../../lib/format'
import { copiar, linkWhatsapp, textoDoOrcamento } from '../../lib/whatsapp'
import { useConfig } from '../../lib/config'
import type { DetalheOs } from '../../types'

/**
 * Mandar o orçamento para o cliente.
 *
 * A oficina já tinha o conteúdo — a Ficha monta tabela de serviços, tabela
 * de peças e o bloco de totais — mas a Ficha é papel: existe para imprimir e
 * assinar. O que faltava era o caminho curto, que é o que acontece de
 * verdade: a pessoa pega o celular e manda no WhatsApp.
 *
 * Três decisões que não são óbvias:
 *
 * 1. O texto vai na mensagem, não um link. Cliente que recebe link precisa
 *    abrir, e boa parte não abre. O número que ele quer saber tem de estar
 *    na própria conversa.
 * 2. O cabeçalho é livre e fica salvo enquanto o modal está aberto. Cada
 *    oficina cumprimenta do seu jeito, e obrigar a digitar "bom dia" toda
 *    vez é o tipo de atrito que faz a pessoa parar de usar o botão.
 * 3. Valor por item não vai. O cliente aprova um total; lista com preço de
 *    cada peça vira negociação item a item no WhatsApp, que é exatamente a
 *    conversa que ninguém quer ter por escrito.
 */
export function ModalOrcamento({
  aberto,
  onFechar,
  os,
}: {
  aberto: boolean
  onFechar: () => void
  os: DetalheOs
}) {
  const avisar = useAviso()
  const { texto: config } = useConfig()
  const [cabecalho, setCabecalho] = useState('')

  const r = os.resumo
  const nomeOficina = config('app.nome_oficina', 'Oficina')

  useEffect(() => {
    if (!aberto) return
    const primeiroNome = r.clienteNome.split(' ')[0]
    setCabecalho(`Olá, ${primeiroNome}! O orçamento do seu carro ficou pronto.`)
  }, [aberto, r.clienteNome])

  const servicos = useMemo(
    () => os.itens.filter((i) => i.status !== 'CANCELADO'),
    [os.itens],
  )
  const pecas = useMemo(
    () => os.pecas.filter((p) => p.status !== 'CANCELADA'),
    [os.pecas],
  )

  const mensagem = useMemo(
    () =>
      textoDoOrcamento({
        cabecalho,
        oficina: nomeOficina,
        placa: r.placa,
        veiculo: r.veiculo,
        servicos: servicos.map((i) => ({ descricao: i.descricao })),
        pecas: pecas.map((p) => ({ descricao: p.descricao, quantidade: p.quantidade })),
        valorPecas: os.valorPecas,
        valorMaoObra: os.valorMaoObra,
        desconto: os.desconto,
        total: os.valorTotal,
      }),
    [cabecalho, nomeOficina, r.placa, r.veiculo, servicos, pecas, os],
  )

  const link = linkWhatsapp(r.clienteTelefone, mensagem)

  // Peça sem preço faz o total mentir: ela entra no orçamento valendo zero,
  // e o cliente aprova um número que a oficina não vai conseguir cobrar.
  const semPreco = pecas.filter((p) => p.valorUnitario == null)

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Mandar o orçamento"
      descricao={`${r.placa} — ${r.clienteNome}`}
      largura="max-w-2xl"
      rodape={
        <>
          <Botao
            variante="secundario"
            tamanho="toque"
            onClick={async () => {
              const deu = await copiar(mensagem)
              avisar(
                deu ? 'Texto copiado.' : 'Não consegui copiar. Selecione o texto e copie à mão.',
                deu ? 'sucesso' : 'erro',
              )
            }}
          >
            <Copy className="size-4" aria-hidden />
            Copiar texto
          </Botao>
          {link ? (
            <a href={link} target="_blank" rel="noreferrer">
              <Botao variante="sucesso" tamanho="toque">
                <MessageCircle className="size-4" aria-hidden />
                Abrir no WhatsApp
              </Botao>
            </a>
          ) : (
            <span className="self-center text-xs text-slate-500">
              Sem telefone no cadastro do cliente
            </span>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {semPreco.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
            <strong>
              {semPreco.length === 1 ? '1 peça sem preço' : `${semPreco.length} peças sem preço`}
            </strong>{' '}
            — ela entra no total valendo zero. O cliente vai aprovar um número que a oficina não
            consegue cobrar. Cote antes de mandar.
          </p>
        )}

        <Campo
          rotulo="Como começar a mensagem"
          dica="Escreva do seu jeito. Vai antes do orçamento."
        >
          <AreaTexto
            rows={2}
            value={cabecalho}
            onChange={(e) => setCabecalho(e.target.value)}
          />
        </Campo>

        {/* O resumo bonito, do jeito que a oficina olha. A mensagem de texto
            abaixo e o que o cliente recebe -- as duas lado a lado para
            ninguem mandar algo que nao conferiu. */}
        <div className="rounded-xl ring-1 ring-slate-200">
          <p className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            O que vai no orçamento
          </p>
          <dl className="divide-y divide-slate-100 px-4 py-1 text-sm">
            <LinhaResumo rotulo={`Serviços (${servicos.length})`} valor={moeda(os.valorMaoObra)} />
            <LinhaResumo rotulo={`Peças (${pecas.length})`} valor={moeda(os.valorPecas)} />
            {(os.desconto ?? 0) > 0 && (
              <LinhaResumo rotulo="Desconto" valor={`- ${moeda(os.desconto)}`} />
            )}
            <LinhaResumo rotulo="Total" valor={moeda(os.valorTotal)} destaque />
          </dl>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">
            A mensagem que o cliente vai receber
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
            {mensagem}
          </pre>
        </div>
      </div>
    </Modal>
  )
}

function LinhaResumo({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className={cx('text-slate-600', destaque && 'font-semibold text-slate-900')}>{rotulo}</dt>
      <dd
        className={cx(
          'tabular-nums text-slate-800',
          destaque && 'text-base font-bold text-slate-900',
        )}
      >
        {valor}
      </dd>
    </div>
  )
}
