import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { AvisoErro, Botao, Campo, Cartao, Entrada } from '../components/ui'
import { ErroApi } from '../api/client'
import { LogoDelander } from '../components/LogoDelander'

/**
 * Depois de quantos segundos parar de fingir que esta quase e avisar que o
 * servidor esta acordando. Entrada normal leva menos de 1 s; passando disso,
 * quase sempre e o servidor saindo do sono do plano gratuito.
 */
const SEGUNDOS_ATE_AVISAR = 4

export default function Login() {
  const { autenticado, entrarComSenha } = useAuth()
  const navegar = useNavigate()
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string>()
  const [enviando, setEnviando] = useState(false)
  const [acordandoServidor, setAcordandoServidor] = useState(false)
  const temporizador = useRef<number>()

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  if (autenticado) return <Navigate to="/" replace />

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(undefined)
    setEnviando(true)
    temporizador.current = window.setTimeout(
      () => setAcordandoServidor(true),
      SEGUNDOS_ATE_AVISAR * 1000,
    )
    try {
      await entrarComSenha(identificador.trim(), senha)
      navegar('/', { replace: true })
    } catch (falha) {
      setErro(
        falha instanceof ErroApi ? falha.message : 'Não foi possível entrar. Tente novamente.',
      )
    } finally {
      window.clearTimeout(temporizador.current)
      setAcordandoServidor(false)
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoDelander altura={46} variante="escuro" />
          <p className="text-sm text-slate-400">
            Controle do pátio, da agenda e do tempo de serviço
          </p>
        </div>

        <Cartao className="p-5">
          <form onSubmit={enviar} className="space-y-4">
            {/* type="text", nao "email": o mecanico entra como "tonny", e o
                navegador recusaria isso sozinho num campo de e-mail, antes de
                a requisicao sair. */}
            <Campo rotulo="Usuário ou e-mail" obrigatorio>
              <Entrada
                type="text"
                inputMode="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="tonny"
              />
            </Campo>

            <Campo rotulo="Senha" obrigatorio>
              <Entrada
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
            </Campo>

            <AvisoErro mensagem={erro} />

            {/* Spinner mudo por um minuto parece sistema quebrado, e a pessoa
                recarrega a pagina -- o que recomeca a espera do zero. Dizer o
                que esta acontecendo e quanto falta e o que segura o dedo. */}
            {acordandoServidor && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                O servidor estava dormindo e está acordando agora. Isso leva até um
                minuto na primeira entrada do dia. <strong>Não recarregue a página</strong> —
                recarregar recomeça a espera.
              </p>
            )}

            <Botao type="submit" bloco tamanho="lg" carregando={enviando}>
              {enviando ? 'Entrando...' : 'Entrar'}
            </Botao>
          </form>
        </Cartao>

        <p className="mt-4 text-center text-xs text-slate-500">
          Esqueceu a senha? Peça ao dono da oficina para redefinir no cadastro de funcionários.
        </p>
      </div>
    </div>
  )
}
