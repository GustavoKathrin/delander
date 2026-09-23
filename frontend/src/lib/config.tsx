import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from './auth'
import { claro, clarear, escurecer } from '../components/oficina'

/**
 * Configuracoes da oficina carregadas uma vez por sessao.
 * O front usa estas flags para esconder campos, botoes e telas inteiras:
 * o que o dono desligou nao aparece como opcao morta na interface.
 */
export const CHAVES = {
  exigirDiagnostico: 'fluxo.exigir_diagnostico',
  exigirAprovacao: 'fluxo.exigir_aprovacao_orcamento',
  exigirChecklist: 'fluxo.exigir_checklist_entrada',
  exigirFotos: 'fluxo.exigir_fotos_entrada',
  multiplosMecanicos: 'fluxo.permitir_multiplos_mecanicos_por_os',
  apontamentoSimultaneo: 'fluxo.permitir_apontamento_simultaneo',
  exigirEstimativa: 'fluxo.exigir_estimativa_ao_iniciar',
  exigirMotivoPausa: 'fluxo.exigir_motivo_ao_pausar',
  mecanicoCriaOs: 'fluxo.mecanico_pode_criar_os',
  mecanicoRealoca: 'fluxo.mecanico_pode_realocar',
  mecanicoVeValores: 'fluxo.mecanico_ve_valores',
  compAtivo: 'compartilhamento.ativo_global',
  compAutomatico: 'compartilhamento.gerar_automatico_ao_iniciar',
  compExigirPin: 'compartilhamento.exigir_pin',
  compDiasValidade: 'compartilhamento.dias_validade',
  nomeOficina: 'app.nome_oficina',
  modoTv: 'app.modo_tv',
  diasSemMovimentacao: 'alertas.dias_sem_movimentacao',
  diasProntoSemRetirada: 'alertas.dias_pronto_sem_retirada',
  horasUteisPorDia: 'capacidade.horas_uteis_por_dia',
  patioColunas: 'app.patio_colunas',
  corMarca: 'app.cor_marca',
  corDestaque: 'app.cor_destaque',
  marcasVeiculo: 'cadastro.marcas_veiculo',
} as const

/**
 * Parte uma configuracao de lista ("Honda,Fiat,Ford") em itens.
 *
 * Fica aqui, exportada, porque as duas telas que cadastram carro e a tela
 * que edita a lista precisam concordar sobre o que e um separador. Duas
 * copias disso divergiriam no primeiro espaco sobrando.
 */
export function listaDeTexto(valor: string): string[] {
  return valor
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

interface ContextoConfig {
  mapa: Record<string, string>
  carregando: boolean
  flag: (chave: string) => boolean
  numero: (chave: string, padrao?: number) => number
  texto: (chave: string, padrao?: string) => string
  lista: (chave: string) => string[]
  recarregar: () => void
}

const Contexto = createContext<ContextoConfig>({
  mapa: {},
  carregando: true,
  flag: () => false,
  numero: (_, padrao = 0) => padrao,
  texto: (_, padrao = '') => padrao,
  lista: () => [],
  recarregar: () => {},
})

export function useConfig() {
  return useContext(Contexto)
}

export function ProvedorConfig({ children }: { children: ReactNode }) {
  const { autenticado } = useAuth()

  const consulta = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => api<Record<string, string>>('/configuracoes/mapa'),
    enabled: autenticado,
    staleTime: 5 * 60 * 1000,
  })

  const valor = useMemo<ContextoConfig>(() => {
    const mapa = consulta.data ?? {}
    return {
      mapa,
      carregando: consulta.isLoading,
      flag: (chave) => mapa[chave] === 'true',
      numero: (chave, padrao = 0) => {
        const bruto = Number(mapa[chave])
        return Number.isFinite(bruto) ? bruto : padrao
      },
      texto: (chave, padrao = '') => mapa[chave] || padrao,
      lista: (chave) => listaDeTexto(mapa[chave] ?? ''),
      recarregar: () => void consulta.refetch(),
    }
  }, [consulta.data, consulta.isLoading, consulta])

  // A cor escolhida pelo dono vira tema de verdade.
  useEffect(() => {
    const raiz = document.documentElement
    const marca = valor.texto(CHAVES.corMarca, '')
    const destaque = valor.texto(CHAVES.corDestaque, '')

    if (/^#[0-9a-f]{6}$/i.test(marca)) {
      // Uma cor so vira a escala inteira: bg-marca-600, ring-marca-500,
      // text-marca-700... estao espalhados pelo codigo e todos leem daqui.
      raiz.style.setProperty('--color-marca-50', clarear(marca, 0.92))
      raiz.style.setProperty('--color-marca-100', clarear(marca, 0.84))
      raiz.style.setProperty('--color-marca-200', clarear(marca, 0.7))
      raiz.style.setProperty('--color-marca-500', clarear(marca, 0.18))
      raiz.style.setProperty('--color-marca-600', marca)
      raiz.style.setProperty('--color-marca-700', escurecer(marca, 0.18))
      raiz.style.setProperty('--color-marca-900', escurecer(marca, 0.45))
    }

    if (/^#[0-9a-f]{6}$/i.test(destaque)) {
      raiz.style.setProperty('--color-faixa', destaque)
      // Com destaque escuro o preto sumiria: o texto por cima segue o contraste.
      raiz.style.setProperty('--cor-sobre-destaque', claro(destaque) ? '#18181b' : '#ffffff')
    }
  }, [valor])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}
