import { useMemo, useState } from 'react'
import { Camera } from 'lucide-react'

import { GradeDeFotos, VisorDeFoto } from '../../components/fotos'
import { Vazio } from '../../components/ui'
import type { ArquivoOs, DetalheOs } from '../../types'

/**
 * As fotos do trabalho, agrupadas por serviço.
 *
 * A foto sempre existiu nesta OS, mas presa à ordem inteira — e sem nenhuma
 * tela que a mostrasse. Ela subia e desaparecia: só a foto de ENTRADA tinha
 * onde aparecer, dentro do checklist. Num carro com cinco serviços, quatro
 * fotos de motor aberto não respondem à única pergunta que o cliente faz:
 * "e a correia, como ficou?".
 *
 * O agrupamento é por serviço e não por data de propósito. Data é como o
 * arquivo foi gravado; serviço é como alguém procura — "me mostra a foto da
 * suspensão" —, e é o que a legenda precisa dizer.
 *
 * A foto de entrada não entra aqui: ela mora no checklist, logo acima, onde
 * quer dizer "foi assim que o carro chegou". Repetida nos dois lugares, na
 * mesma tela, ela deixaria de querer dizer isso.
 */
export function GaleriaFotos({
  os,
  gerencia,
  onMudou,
}: {
  os: DetalheOs
  gerencia: boolean
  onMudou: () => void
}) {
  const [aberta, setAberta] = useState<ArquivoOs | null>(null)
  const osId = os.resumo.id

  const grupos = useMemo(() => {
    const doTrabalho = os.arquivos.filter((a) => a.momento !== 'ENTRADA')
    const porServico = new Map<string, ArquivoOs[]>()
    const doCarro: ArquivoOs[] = []

    for (const foto of doTrabalho) {
      if (!foto.osItemId) {
        doCarro.push(foto)
        continue
      }
      const atual = porServico.get(foto.osItemId)
      if (atual) atual.push(foto)
      else porServico.set(foto.osItemId, [foto])
    }

    // A ordem dos serviços manda, não a das fotos: na OS a lista de serviços
    // já está numa ordem que quem trabalha reconhece.
    const blocos = os.itens
      .filter((item) => porServico.has(item.id))
      .map((item) => ({ titulo: item.descricao, fotos: porServico.get(item.id)! }))

    if (doCarro.length > 0) {
      blocos.push({ titulo: 'Do carro', fotos: doCarro })
    }
    return { blocos, total: doTrabalho.length }
  }, [os.arquivos, os.itens])

  // A foto fica atualizada entre renders: o visor guarda o objeto, e um
  // "o cliente vê" muda a OS inteira — sem isto, o botão voltava ao estado
  // anterior logo depois de alguém tocar nele.
  const fotoAberta = aberta ? (os.arquivos.find((a) => a.id === aberta.id) ?? null) : null

  // Cartão vazio numa OS encerrada é só ruído: ninguém vai fotografar um
  // carro que já saiu, e o lugar de olhar a foto antiga é o prontuário.
  const encerrada = os.resumo.status === 'ENTREGUE' || os.resumo.status === 'CANCELADO'
  if (grupos.total === 0 && encerrada) return null

  return (
    <>
      <div className="space-y-4 px-4 py-3">
        {grupos.total === 0 ? (
          <Vazio
            icone={<Camera className="size-8" />}
            titulo="Nenhuma foto do serviço ainda"
            descricao="A câmera fica na linha de cada serviço, acima. A foto que é do carro e não de um serviço sobe junto com o registro de trabalho."
          />
        ) : (
          grupos.blocos.map((bloco) => (
            <div key={bloco.titulo}>
              <p className="mb-1.5 text-xs font-semibold text-slate-600">{bloco.titulo}</p>
              <GradeDeFotos fotos={bloco.fotos} onAbrir={setAberta} />
            </div>
          ))
        )}

      </div>

      <VisorDeFoto
        foto={fotoAberta}
        osId={osId}
        podeApagar={fotoAberta?.momento !== 'ENTRADA' || gerencia}
        onFechar={() => setAberta(null)}
        onMudou={onMudou}
      />
    </>
  )
}
