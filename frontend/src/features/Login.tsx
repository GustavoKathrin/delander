import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { AvisoErro, Botao, Campo, Cartao, Entrada } from '../components/ui'
import { ErroApi } from '../api/client'
import { LogoDelander } from '../components/LogoDelander'

export default function Login() {
  const { autenticado, entrarComSenha } = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  if (autenticado) return <Navigate to="/" replace />

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(undefined)
    setEnviando(true)
    try {
      await entrarComSenha(email.trim(), senha)
      navegar('/', { replace: true })
    } catch (falha) {
      setErro(
        falha instanceof ErroApi ? falha.message : 'Não foi possível entrar. Tente novamente.',
      )
    } finally {
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
            <Campo rotulo="E-mail" obrigatorio>
              <Entrada
                type="email"
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@oficina.com.br"
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

            <Botao type="submit" bloco tamanho="lg" carregando={enviando}>
              Entrar
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
