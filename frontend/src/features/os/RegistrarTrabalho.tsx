import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Eye, EyeOff, Send, X } from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import { AreaTexto, Botao, Cartao, CartaoTitulo, cx, useAviso } from '../../components/ui'
import type { DetalheOs } from '../../types'

/**
 * O mecânico conta o que está fazendo.
 *
 * Duas decisões que valem explicação:
 *
 * A visibilidade é escolhida **a cada registro**, e não uma vez na
 * configuração da oficina. "Troquei a correia e achei a bomba d'água
 * vazando" o cliente quer ler; "cliente enrolou três dias para aprovar,
 * perdi a manhã" é conversa interna. Com um interruptor único, a oficina
 * pararia de registrar o segundo tipo — e é justamente ele que explica
 * onde o tempo foi embora.
 *
 * A foto sobe com a **mesma** visibilidade do texto. Foto pública com
 * texto interno deixaria o cliente vendo a imagem de algo que ninguém
 * explicou para ele.
 */
export function RegistrarTrabalho({ os }: { os: DetalheOs }) {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const arquivoRef = useRef<HTMLInputElement>(null)

  const [texto, setTexto] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(false)
  const [foto, setFoto] = useState<File | null>(null)

  const registrar = useMutation({
    mutationFn: async () => {
      await api(`/os/${os.resumo.id}/trabalho`, {
        metodo: 'POST',
        corpo: { texto: texto.trim(), visivelCliente },
      })
      if (foto) {
        const dados = new FormData()
        dados.append('arquivo', foto)
        dados.append('momento', 'EXECUCAO')
        dados.append('visivelCliente', String(visivelCliente))
        await api(`/os/${os.resumo.id}/arquivos`, { metodo: 'POST', formData: dados })
      }
    },
    onSuccess: () => {
      setTexto('')
      setFoto(null)
      if (arquivoRef.current) arquivoRef.current.value = ''
      void queryClient.invalidateQueries({ queryKey: ['os', os.resumo.id] })
      avisar('Trabalho registrado.')
    },
    onError: (erro: Error) =>
      avisar(erro instanceof ErroApi ? erro.message : 'Não foi possível registrar.', 'erro'),
  })

  const pronto = texto.trim().length > 2

  return (
    <Cartao>
      <CartaoTitulo
        titulo="Registrar trabalho"
        descricao="O que você está fazendo agora. Entra no histórico do carro."
      />
      <div className="space-y-3 p-4">
        <AreaTexto
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: desmontei a suspensão dianteira, o amortecedor direito está vazando"
        />

        {/* Foto: um toque, sem tela intermediária — no celular, capture
            abre a câmera direto em vez do seletor de arquivos. */}
        <input
          ref={arquivoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Botao
            variante="secundario"
            tamanho="sm"
            onClick={() => arquivoRef.current?.click()}
          >
            <Camera className="size-4" aria-hidden />
            {foto ? 'Trocar foto' : 'Foto'}
          </Botao>

          {foto && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs text-slate-700">
              {foto.name.length > 22 ? foto.name.slice(0, 22) + '…' : foto.name}
              <button
                type="button"
                onClick={() => {
                  setFoto(null)
                  if (arquivoRef.current) arquivoRef.current.value = ''
                }}
                className="grid size-5 place-items-center rounded-full text-slate-400 hover:bg-slate-300 hover:text-slate-700"
                aria-label="Tirar a foto do registro"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {/* O alvo do registro, dito por inteiro: quem escolhe "o cliente vê"
              precisa saber que aquilo vai parar no link que ele abre no
              celular — e quem escolhe "só a oficina" precisa saber que não. */}
          <button
            type="button"
            onClick={() => setVisivelCliente((v) => !v)}
            className={cx(
              'ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition',
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
        </div>

        <Botao
          className="w-full"
          disabled={!pronto}
          carregando={registrar.isPending}
          onClick={() => registrar.mutate()}
        >
          <Send className="size-4" aria-hidden />
          Registrar
        </Botao>
      </div>
    </Cartao>
  )
}
