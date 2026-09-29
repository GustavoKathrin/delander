import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Eye, EyeOff, Images, Send, X } from 'lucide-react'
import { api, ErroApi } from '../../api/client'
import { AreaTexto, Botao, Cartao, CartaoTitulo, cx, useAviso } from '../../components/ui'
import type { DetalheOs } from '../../types'

/**
 * O mecânico conta o que está fazendo.
 *
 * Três decisões que valem explicação:
 *
 * A visibilidade é escolhida **a cada registro**, e não uma vez na
 * configuração da oficina. "Troquei a correia e achei a bomba vazando" o
 * cliente quer ler; "cliente enrolou três dias para aprovar, perdi a manhã"
 * é conversa interna. Com um interruptor único, a oficina pararia de
 * registrar o segundo tipo — e é justamente ele que explica onde o tempo
 * foi embora.
 *
 * A foto sobe com a **mesma** visibilidade do texto. Foto pública com
 * texto interno deixaria o cliente vendo a imagem de algo que ninguém
 * explicou para ele.
 *
 * São **dois botões** para imagem, e não um. O atributo `capture` abre a
 * câmera direto — é o que o mecânico quer com o carro na frente — mas ele
 * próprio limita a escolha a uma foto por vez. Quem já fotografou tudo e
 * quer mandar as seis de uma vez precisa do seletor sem `capture`. Um botão
 * só serviria mal aos dois.
 */
export function RegistrarTrabalho({ os }: { os: DetalheOs }) {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galeriaRef = useRef<HTMLInputElement>(null)

  const [texto, setTexto] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(false)
  const [fotos, setFotos] = useState<File[]>([])

  function juntar(lista: FileList | null) {
    if (!lista || lista.length === 0) return
    // Acumula em vez de substituir: quem escolhe da galeria e depois bate uma
    // foto nova esperaria ficar com as duas, e não perder a primeira.
    setFotos((atuais) => [...atuais, ...Array.from(lista)])
  }

  function limparInputs() {
    if (cameraRef.current) cameraRef.current.value = ''
    if (galeriaRef.current) galeriaRef.current.value = ''
  }

  const registrar = useMutation({
    mutationFn: async () => {
      await api(`/os/${os.resumo.id}/trabalho`, {
        metodo: 'POST',
        corpo: { texto: texto.trim(), visivelCliente },
      })

      // Uma por requisição: o endpoint recebe um arquivo só. Em sequência e
      // não em paralelo — são fotos de celular na rede da oficina, e seis
      // uploads simultâneos competem entre si em vez de somar.
      let enviadas = 0
      for (const foto of fotos) {
        const dados = new FormData()
        dados.append('arquivo', foto)
        dados.append('momento', 'EXECUCAO')
        dados.append('visivelCliente', String(visivelCliente))
        try {
          await api(`/os/${os.resumo.id}/arquivos`, { metodo: 'POST', formData: dados })
          enviadas++
        } catch (erro) {
          // O texto já foi gravado; dizer "não foi possível registrar" seria
          // mentira. O que a pessoa precisa saber é quantas fotos faltaram.
          const motivo = erro instanceof ErroApi ? erro.message : 'falha no envio'
          throw new Error(
            `Trabalho registrado, mas ${fotos.length - enviadas} de ${fotos.length} foto(s) não subiram: ${motivo}`,
          )
        }
      }
    },
    onSuccess: () => {
      const quantas = fotos.length
      setTexto('')
      setFotos([])
      limparInputs()
      void queryClient.invalidateQueries({ queryKey: ['os', os.resumo.id] })
      avisar(quantas > 0 ? `Trabalho registrado com ${quantas} foto(s).` : 'Trabalho registrado.')
    },
    onError: (erro: Error) => {
      // O texto pode ter entrado mesmo com a foto falhando; recarrega para a
      // tela mostrar o que de fato ficou gravado.
      void queryClient.invalidateQueries({ queryKey: ['os', os.resumo.id] })
      avisar(erro.message, 'erro')
    },
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

        {/* Câmera: um toque, sem tela intermediária. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => juntar(e.target.files)}
        />
        {/* Galeria: sem `capture`, com `multiple` — várias de uma vez. */}
        <input
          ref={galeriaRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => juntar(e.target.files)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Botao variante="secundario" tamanho="sm" onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" aria-hidden />
            Câmera
          </Botao>
          <Botao variante="secundario" tamanho="sm" onClick={() => galeriaRef.current?.click()}>
            <Images className="size-4" aria-hidden />
            Escolher fotos
          </Botao>

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

        {fotos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {fotos.map((foto, indice) => (
              <span
                key={`${foto.name}-${indice}`}
                className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs text-slate-700"
              >
                {foto.name.length > 22 ? foto.name.slice(0, 22) + '…' : foto.name}
                <button
                  type="button"
                  onClick={() => {
                    setFotos((atuais) => atuais.filter((_, i) => i !== indice))
                    limparInputs()
                  }}
                  className="grid size-5 place-items-center rounded-full text-slate-400 hover:bg-slate-300 hover:text-slate-700"
                  aria-label={`Tirar ${foto.name} do registro`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <span className="text-xs font-medium text-slate-500">{fotos.length} foto(s)</span>
          </div>
        )}

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
