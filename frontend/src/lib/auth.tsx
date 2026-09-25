import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { assinarSessao, entrar, lerSessao, sair, type Sessao } from '../api/client'
import type { Usuario } from '../types'

interface ContextoAuth {
  usuario: Usuario | null
  autenticado: boolean
  gerencia: boolean
  ehMecanico: boolean
  /** Quem registra a resposta do cliente ao orcamento: atendente, gerente ou dono. */
  podeAtender: boolean
  entrarComSenha: (email: string, senha: string) => Promise<void>
  encerrar: () => Promise<void>
}

const Contexto = createContext<ContextoAuth>({
  usuario: null,
  autenticado: false,
  gerencia: false,
  ehMecanico: false,
  podeAtender: false,
  entrarComSenha: async () => {},
  encerrar: async () => {},
})

export function useAuth() {
  return useContext(Contexto)
}

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessao())

  useEffect(() => assinarSessao(setSessao) as unknown as () => void, [])

  const valor = useMemo<ContextoAuth>(
    () => ({
      usuario: sessao?.usuario ?? null,
      autenticado: Boolean(sessao?.accessToken),
      gerencia: sessao?.usuario?.gerencia ?? false,
      ehMecanico: sessao?.usuario?.papel === 'MECANICO',
      podeAtender:
        (sessao?.usuario?.gerencia ?? false) || sessao?.usuario?.papel === 'RECEPCAO',
      entrarComSenha: async (email, senha) => {
        const nova = await entrar(email, senha)
        setSessao(nova)
      },
      encerrar: async () => {
        await sair()
        setSessao(null)
      },
    }),
    [sessao],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}
