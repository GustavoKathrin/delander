import type { TokenResposta } from '../types'

const BASE = '/api'
const CHAVE_SESSAO = 'oficina.sessao'

export interface Sessao {
  accessToken: string
  refreshToken: string
  usuario: TokenResposta['usuario']
}

export class ErroApi extends Error {
  readonly status: number
  readonly camposComErro: Record<string, string>

  constructor(status: number, mensagem: string, camposComErro: Record<string, string> = {}) {
    super(mensagem)
    this.status = status
    this.camposComErro = camposComErro
  }
}

// ------------------------------------------------------------------ sessao

export function lerSessao(): Sessao | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    return bruto ? (JSON.parse(bruto) as Sessao) : null
  } catch {
    return null
  }
}

export function gravarSessao(sessao: Sessao | null) {
  try {
    if (sessao) {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao))
    } else {
      localStorage.removeItem(CHAVE_SESSAO)
    }
  } catch {
    // modo privado ou armazenamento bloqueado: a sessao vive so nesta aba
  }
  ouvintes.forEach((fn) => fn(sessao))
}

const ouvintes = new Set<(s: Sessao | null) => void>()

export function assinarSessao(fn: (s: Sessao | null) => void) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

// ------------------------------------------------------------------ requisicao

let renovacaoEmCurso: Promise<string | null> | null = null

async function renovarToken(): Promise<string | null> {
  const sessao = lerSessao()
  if (!sessao?.refreshToken) return null

  if (!renovacaoEmCurso) {
    renovacaoEmCurso = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessao.refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          gravarSessao(null)
          return null
        }
        const dados = (await res.json()) as TokenResposta
        gravarSessao({
          accessToken: dados.accessToken,
          refreshToken: dados.refreshToken,
          usuario: dados.usuario,
        })
        return dados.accessToken
      })
      .catch(() => {
        gravarSessao(null)
        return null
      })
      .finally(() => {
        renovacaoEmCurso = null
      })
  }
  return renovacaoEmCurso
}

async function extrairErro(res: Response): Promise<ErroApi> {
  let mensagem = 'Nao foi possivel completar a operacao.'
  let campos: Record<string, string> = {}
  try {
    const corpo = await res.json()
    mensagem = corpo.detail || corpo.title || mensagem
    if (corpo.erros && typeof corpo.erros === 'object') {
      campos = corpo.erros as Record<string, string>
    }
  } catch {
    // resposta sem corpo JSON
  }
  return new ErroApi(res.status, mensagem, campos)
}

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  corpo?: unknown
  publico?: boolean
  formData?: FormData
}

export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, publico = false, formData } = opcoes

  const montar = (token?: string | null): RequestInit => {
    const headers: Record<string, string> = {}
    if (!formData) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    return {
      method: metodo,
      headers,
      body: formData ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
    }
  }

  const token = publico ? null : lerSessao()?.accessToken
  let res = await fetch(`${BASE}${caminho}`, montar(token))

  if (res.status === 401 && !publico) {
    const novoToken = await renovarToken()
    if (!novoToken) {
      throw new ErroApi(401, 'Sua sessao expirou. Entre novamente.')
    }
    res = await fetch(`${BASE}${caminho}`, montar(novoToken))
  }

  if (!res.ok) {
    throw await extrairErro(res)
  }
  if (res.status === 204) {
    return undefined as T
  }

  const tipo = res.headers.get('content-type') ?? ''
  if (!tipo.includes('application/json')) {
    return (await res.text()) as unknown as T
  }
  return (await res.json()) as T
}

export async function entrar(email: string, senha: string): Promise<Sessao> {
  const dados = await api<TokenResposta>('/auth/login', {
    metodo: 'POST',
    corpo: { email, senha },
    publico: true,
  })
  const sessao: Sessao = {
    accessToken: dados.accessToken,
    refreshToken: dados.refreshToken,
    usuario: dados.usuario,
  }
  gravarSessao(sessao)
  return sessao
}

export async function sair() {
  const sessao = lerSessao()
  if (sessao?.refreshToken) {
    try {
      await api('/auth/logout', {
        metodo: 'POST',
        corpo: { refreshToken: sessao.refreshToken },
        publico: true,
      })
    } catch {
      // logout local acontece de qualquer forma
    }
  }
  gravarSessao(null)
}
