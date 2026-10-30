/*
 * De planta para metro.
 *
 * O 3D NAO tem um editor proprio: ele le exatamente o que o cadeado do Patio
 * ja salva em cada vaga (coluna, linha, largura, altura) e so converte celula
 * em metro. Um editor so, duas vistas -- arrumar a planta de frente muda o
 * barracao em 3D no mesmo instante.
 *
 * E o barracao nao e configurado: ele e MEDIDO a partir das vagas. Configurar
 * largura do predio de um lado e vagas do outro deixaria alguem montar uma
 * oficina onde o carro nao cabe, e a tela passaria a mentir. Derivando, isso
 * e impossivel: entrou vaga, o barracao esticou.
 */
import type { Vaga } from '../../../types'

export interface ConfigPlanta {
  /** app.patio_colunas -- quantas colunas a planta tem */
  colunas: number
  /** app.vaga_largura_m */
  vagaLargura: number
  /** app.vaga_comprimento_m */
  vagaComprimento: number
  /** app.galpao_recuo_fundo -- faixa do fundo, onde fica a bancada */
  recuoFundo: number
  /** app.galpao_manobra -- faixa entre a ultima vaga e o portao */
  manobra: number
  /** app.galpao_portao_largura */
  portaoLargura: number
  peDireito: number
}

export const CONFIG_PADRAO: ConfigPlanta = {
  colunas: 6,
  vagaLargura: 2.6,
  vagaComprimento: 5,
  recuoFundo: 1.2,
  manobra: 3.5,
  portaoLargura: 3.2,
  peDireito: 3.6,
}

export interface Celula {
  coluna: number
  linha: number
  largura: number
  altura: number
}

/**
 * Onde cada vaga cai na planta.
 *
 * Sem layout salvo o arranjo e o automatico de sempre -- a mesma conta de
 * `posicoesIniciais` na tela 2D. Duas contas diferentes aqui e la fariam a
 * mesma oficina ter duas plantas.
 */
export function celulaDaVaga(vagas: Vaga[], colunas: number): Map<string, Celula> {
  const mapa = new Map<string, Celula>()
  vagas.forEach((v, i) => {
    mapa.set(v.id, {
      coluna: v.layoutColuna ?? (i % colunas) + 1,
      linha: v.layoutLinha ?? Math.floor(i / colunas) + 1,
      largura: v.layoutLargura || 1,
      altura: v.layoutAltura || 1,
    })
  })
  return mapa
}

export interface MedidaGalpao {
  colunas: number
  linhas: number
  largura: number
  comprimento: number
  /** colunas em que ninguem botou vaga: e o corredor, e nao e parametro */
  corredores: number[]
}

export function medirGalpao(cfg: ConfigPlanta, celulas: Celula[]): MedidaGalpao {
  const colunas = Math.max(cfg.colunas, ...celulas.map((c) => c.coluna + c.largura - 1), 1)
  const linhas = Math.max(1, ...celulas.map((c) => c.linha + c.altura - 1))

  const usadas = new Set<number>()
  for (const c of celulas) {
    for (let i = 0; i < c.largura; i++) usadas.add(c.coluna + i)
  }
  const corredores: number[] = []
  for (let c = 1; c <= colunas; c++) if (!usadas.has(c)) corredores.push(c)

  return {
    colunas,
    linhas,
    largura: colunas * cfg.vagaLargura,
    comprimento: cfg.recuoFundo + linhas * cfg.vagaComprimento + cfg.manobra,
    corredores,
  }
}

export interface GeometriaVaga {
  x: number
  z: number
  larg: number
  prof: number
  aoLongoDeZ: boolean
  giro: number
}

export function geometriaDaVaga(
  cfg: ConfigPlanta,
  med: MedidaGalpao,
  c: Celula,
): GeometriaVaga {
  const x = -med.largura / 2 + (c.coluna - 1 + c.largura / 2) * cfg.vagaLargura
  const z =
    -med.comprimento / 2 + cfg.recuoFundo + (c.linha - 1 + c.altura / 2) * cfg.vagaComprimento
  const larg = c.largura * cfg.vagaLargura - 0.16
  const prof = c.altura * cfg.vagaComprimento - 0.16

  return {
    x,
    z,
    larg,
    prof,
    /*
     * O carro deita no lado maior da vaga e o nariz aponta para a saida.
     * E essa regra que faz a mesma tela servir para o barracao estreito, onde
     * os carros ficam enfileirados, e para o galpao largo, onde eles entram
     * em espinha -- sem nenhum "se" no desenho.
     */
    aoLongoDeZ: prof >= larg,
    giro: prof >= larg ? Math.PI : x < 0 ? Math.PI / 2 : -Math.PI / 2,
  }
}

export function faixaDoCorredor(cfg: ConfigPlanta, med: MedidaGalpao, coluna: number) {
  const x0 = -med.largura / 2 + (coluna - 1) * cfg.vagaLargura
  return { x0, x1: x0 + cfg.vagaLargura }
}
