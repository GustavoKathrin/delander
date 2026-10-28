/**
 * Falar com o cliente pelo WhatsApp, de um lugar só.
 *
 * Isto existia em duas cópias que foram divergindo: o modal de
 * compartilhamento montava o link com um template inline e sem acento, e o
 * radar de carros parados tinha a própria função, com acento e quatro
 * mensagens por motivo. A terceira cópia ia nascer na tela de orçamento.
 *
 * Quando a mesma coisa mora em três arquivos, o que acontece não é que ela
 * fica igual: é que alguém corrige o texto em um e não nos outros, e a
 * oficina passa a falar de dois jeitos com o mesmo cliente.
 */

import { telefoneWhatsapp } from './format'

/**
 * O link que abre a conversa com a mensagem pronta.
 *
 * Devolve null quando não há telefone utilizável — quem chama decide se
 * esconde o botão ou mostra "sem telefone cadastrado". Devolver um link
 * quebrado seria pior: o botão existe, a pessoa toca, e abre o WhatsApp em
 * branco sem explicar por quê.
 */
export function linkWhatsapp(telefone: string | undefined | null, texto: string): string | null {
  const numero = telefoneWhatsapp(telefone)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

/**
 * Copiar para a área de transferência, dizendo se deu certo.
 *
 * `navigator.clipboard` não existe fora de HTTPS (ou localhost) e pode ser
 * recusado pelo navegador. Quem chama precisa saber disso para avisar, em
 * vez de o usuário achar que copiou e colar o que tinha antes.
 */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

interface LinhaDoResumo {
  descricao: string
  quantidade?: number
  valor?: number
}

/**
 * O orçamento em texto, do jeito que se manda no WhatsApp.
 *
 * Texto puro e não link: o cliente que recebe um link precisa abrir, e boa
 * parte não abre. O número que ele quer saber tem de estar na própria
 * mensagem. O link de acompanhamento continua existindo e é outro botão.
 */
export function textoDoOrcamento(dados: {
  cabecalho?: string
  oficina: string
  placa: string
  veiculo?: string
  servicos: LinhaDoResumo[]
  pecas: LinhaDoResumo[]
  valorPecas?: number
  valorMaoObra?: number
  desconto?: number
  total?: number
}): string {
  const dinheiro = (v?: number) =>
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const partes: string[] = []

  if (dados.cabecalho?.trim()) {
    partes.push(dados.cabecalho.trim(), '')
  }

  const carro = dados.veiculo && dados.veiculo !== dados.placa
    ? `${dados.veiculo} (${dados.placa})`
    : dados.placa
  partes.push(`*Orçamento — ${carro}*`, '')

  if (dados.servicos.length > 0) {
    partes.push('*Serviços*')
    dados.servicos.forEach((s) => partes.push(`• ${s.descricao}`))
    partes.push('')
  }

  if (dados.pecas.length > 0) {
    partes.push('*Peças*')
    dados.pecas.forEach((p) =>
      partes.push(`• ${p.quantidade && p.quantidade > 1 ? `${p.quantidade}x ` : ''}${p.descricao}`),
    )
    partes.push('')
  }

  partes.push(`Peças: ${dinheiro(dados.valorPecas)}`)
  partes.push(`Mão de obra: ${dinheiro(dados.valorMaoObra)}`)
  if ((dados.desconto ?? 0) > 0) {
    partes.push(`Desconto: -${dinheiro(dados.desconto)}`)
  }
  partes.push(`*Total: ${dinheiro(dados.total)}*`)
  partes.push('', dados.oficina)

  return partes.join('\n')
}
