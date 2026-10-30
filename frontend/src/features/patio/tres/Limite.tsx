import { Component, type ErrorInfo, type ReactNode } from 'react'

/*
 * Se o 3D falhar, a tela NAO quebra: ela volta para a planta 2D.
 *
 * WebGL e a unica parte do sistema que depende de placa de video, driver e
 * navegador ao mesmo tempo -- maquina velha da oficina, navegador antigo,
 * aceleracao desligada por politica. Qualquer um desses derruba a cena, e
 * sem este limite derrubaria o Patio inteiro junto, que e a tela mais usada
 * do dia. Com ele, o pior caso e ver a planta de sempre.
 */
interface Props {
  children: ReactNode
  aoFalhar: (motivo: string) => void
}

export class LimiteDoTresD extends Component<Props, { caiu: boolean }> {
  state = { caiu: false }

  static getDerivedStateFromError() {
    return { caiu: true }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Patio 3D caiu, voltando para a planta:', erro, info.componentStack)
    this.props.aoFalhar(erro.message || 'não foi possível abrir a visão 3D')
  }

  render() {
    if (this.state.caiu) return null
    return this.props.children
  }
}
