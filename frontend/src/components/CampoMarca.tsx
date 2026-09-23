import { useMemo, useState } from 'react'
import { CHAVES, useConfig } from '../lib/config'
import { Entrada, Selecao } from './ui'

/**
 * A marca do carro, escolhida em vez de digitada.
 *
 * Digitar a cada carro novo é lento e suja o acervo: "honda", "HONDA" e
 * "Hnoda" viram três marcas na hora de procurar a leitura de um Civic. A
 * lista vem de Configurações › Cadastros › Marcas, então cada oficina bota
 * as marcas que realmente atende.
 *
 * "Outra marca" existe de propósito: moto, caminhão e importado aparecem, e
 * recusar um carro porque a marca não estava no combo seria uma oficina
 * pior. Quem escolhe "Outra" digita, e o valor salvo é o digitado.
 */
const OUTRA = '__outra__'

export function CampoMarca({
  valor,
  onChange,
  id,
}: {
  valor: string
  onChange: (marca: string) => void
  id?: string
}) {
  const { lista } = useConfig()
  const marcas = useMemo(() => lista(CHAVES.marcasVeiculo), [lista])

  const [digitando, setDigitando] = useState(false)

  /**
   * Uma marca já preenchida que não está na lista (carro antigo, lista
   * mudada depois) tem que continuar visível. Isto é calculado a cada
   * render, e não só na montagem, porque a lista chega do servidor depois:
   * decidir uma vez deixaria a marca sumir do combo sem avisar.
   */
  const foraDaLista = marcas.length > 0 && valor.length > 0 && !marcas.includes(valor)

  if (marcas.length === 0) {
    // Sem lista configurada o campo volta a ser texto: melhor um campo livre
    // do que um combo vazio que não deixa cadastrar carro nenhum.
    return (
      <Entrada
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Honda"
      />
    )
  }

  if (digitando || foraDaLista) {
    return (
      <div className="flex gap-1">
        <Entrada
          id={id}
          autoFocus={digitando}
          className="flex-1"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite a marca"
        />
        <button
          type="button"
          onClick={() => {
            setDigitando(false)
            onChange('')
          }}
          className="rounded-md px-2 text-xs text-slate-500 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Lista
        </button>
      </div>
    )
  }

  return (
    <Selecao
      id={id}
      value={valor}
      onChange={(e) => {
        if (e.target.value === OUTRA) {
          setDigitando(true)
          onChange('')
          return
        }
        onChange(e.target.value)
      }}
    >
      <option value="">Escolha a marca</option>
      {marcas.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
      <option value={OUTRA}>Outra marca...</option>
    </Selecao>
  )
}
