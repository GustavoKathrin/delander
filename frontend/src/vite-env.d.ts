/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Endereco da API.
   *
   * Vazio = caminho relativo /api, que a Vercel reescreve para o Render.
   * Preenchido com a URL do Render = o navegador fala direto com o backend,
   * sem a parada no meio. Medido: a mesma chamada levou 6,16 s pelo desvio da
   * Vercel e 2,76 s direto.
   */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
