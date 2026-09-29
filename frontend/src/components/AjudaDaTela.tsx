import { useState } from 'react'
import { Lightbulb, X } from 'lucide-react'

/**
 * O que esta tela serve, na primeira vez que alguém a abre.
 *
 * Um cartão que fecha e não volta, e não um tour guiado passo a passo. O tour
 * ensina mais na primeira vez e atrapalha em todas as outras: ele quebra a
 * cada mudança de tela, e o sistema tem mais de trinta contando as abas de
 * Configurações. Este cartão envelhece junto com a tela — quando ela muda, o
 * texto dela muda no mesmo arquivo.
 *
 * Quem já sabe fecha uma vez e nunca mais vê. Quem quiser de volta usa
 * "Como funciona" no menu.
 */

const PREFIXO = 'delander.ajuda.'

/** Fechou, não volta. Modo privado derruba o storage: o cartão só reaparece. */
function jaFechou(chave: string): boolean {
  try {
    return localStorage.getItem(PREFIXO + chave) === 'fechado'
  } catch {
    return false
  }
}

function marcarFechado(chave: string) {
  try {
    localStorage.setItem(PREFIXO + chave, 'fechado')
  } catch {
    /* modo privado: fica só nesta sessão */
  }
}

/** Traz todos de volta — o botão "Como funciona" do menu. */
export function reabrirAjudas() {
  try {
    for (const chave of Object.keys(localStorage)) {
      if (chave.startsWith(PREFIXO)) {
        localStorage.removeItem(chave)
      }
    }
  } catch {
    /* sem storage, nada a limpar */
  }
}

export function AjudaDaTela({
  chave,
  titulo,
  children,
}: {
  /** Identifica a tela. Não mude depois de publicada: quem já fechou veria de novo. */
  chave: string
  titulo: string
  children: React.ReactNode
}) {
  const [fechado, setFechado] = useState(() => jaFechou(chave))
  if (fechado) return null

  return (
    <div className="relative rounded-xl bg-marca-50 p-3 pr-10 text-sm text-slate-700 ring-1 ring-marca-200">
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 size-4 flex-none text-marca-600" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-marca-900">{titulo}</p>
          <div className="mt-0.5 leading-snug text-slate-600">{children}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          marcarFechado(chave)
          setFechado(true)
        }}
        aria-label="Entendi, não mostrar de novo"
        title="Entendi, não mostrar de novo"
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-marca-700 transition hover:bg-marca-100"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
