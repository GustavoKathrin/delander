import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Package, Plus } from 'lucide-react'
import { api } from '../../api/client'
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  CartaoTitulo,
  Entrada,
  Etiqueta,
  Interruptor,
  Modal,
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import { moeda } from '../../lib/format'
import type { PecaCatalogo } from '../../types'

/**
 * O cadastro de peças, com o que a oficina tem na prateleira.
 *
 * O saldo aparece aqui, mas quase nunca é digitado aqui: ele sobe sozinho
 * quando uma compra chega e desce quando a peça vai para um carro. O campo
 * editável existe para o dia em que alguém conta a prateleira e acerta o que
 * o sistema errou — e é só para isso.
 *
 * "Estoque mínimo" é o que transforma o cadastro em aviso: abaixo dele a peça
 * aparece como acabando, antes de faltar no meio de um serviço.
 */
export default function CatalogoPecas() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<PecaCatalogo | null>(null)
  const [criando, setCriando] = useState(false)

  const consulta = useQuery({
    queryKey: ['catalogo-pecas'],
    queryFn: () => api<PecaCatalogo[]>('/pecas/catalogo'),
  })

  if (consulta.isLoading) return <Carregando texto="Abrindo o catálogo..." />
  if (consulta.isError || !consulta.data) {
    return (
      <Cartao>
        <Vazio
          icone={<Package className="size-8" />}
          titulo="Não foi possível abrir o catálogo"
          descricao={(consulta.error as Error)?.message}
          acao={<Botao onClick={() => void consulta.refetch()}>Tentar de novo</Botao>}
        />
      </Cartao>
    )
  }

  const pecas = consulta.data
  const faltando = pecas.filter((p) => p.ativo && !p.temEstoque)
  const acabando = pecas.filter((p) => p.acabando)

  return (
    <Cartao>
      <CartaoTitulo
        titulo="Peças e estoque"
        descricao="O que a oficina conhece e o que tem na prateleira. O saldo se move sozinho: sobe quando uma compra chega, desce quando a peça vai para um carro."
        acao={
          <Botao tamanho="sm" onClick={() => setCriando(true)}>
            <Plus className="size-3.5" aria-hidden />
            Nova peça
          </Botao>
        }
      />

      {(faltando.length > 0 || acabando.length > 0) && (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 size-4 flex-none" aria-hidden />
          <span>
            {faltando.length > 0 && <strong>{faltando.length} peça(s) zerada(s)</strong>}
            {faltando.length > 0 && acabando.length > 0 && ' · '}
            {acabando.length > 0 && `${acabando.length} acabando`}. Vale olhar antes de prometer
            prazo para o cliente.
          </span>
        </p>
      )}

      {pecas.length === 0 ? (
        <Vazio
          icone={<Package className="size-8" />}
          titulo="Catálogo vazio"
          descricao="As peças entram aqui sozinhas quando uma compra é recebida. Cadastrar à mão serve para adiantar o que você já tem na prateleira."
          acao={<Botao onClick={() => setCriando(true)}>Cadastrar a primeira</Botao>}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {pecas.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Package
                className={cx(
                  'size-4 flex-none',
                  !p.ativo ? 'text-slate-300' : p.temEstoque ? 'text-slate-400' : 'text-amber-500',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className={cx('text-sm font-medium', p.ativo ? 'text-slate-900' : 'text-slate-400')}>
                  {p.descricao}
                  {!p.ativo && ' (inativa)'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {p.codigo && `${p.codigo} · `}
                  {p.fabricante && `${p.fabricante} · `}
                  {p.valorSugerido != null ? moeda(p.valorSugerido) : 'sem preço'}
                </p>
              </div>

              <Etiqueta
                className={
                  !p.temEstoque
                    ? 'bg-amber-100 text-amber-800 ring-amber-200'
                    : p.acabando
                      ? 'bg-amber-100 text-amber-800 ring-amber-200'
                      : 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                }
              >
                {p.quantidadeEstoque} na prateleira
              </Etiqueta>

              <Botao variante="secundario" tamanho="sm" onClick={() => setEditando(p)}>
                Editar
              </Botao>
            </li>
          ))}
        </ul>
      )}

      <ModalPeca
        aberto={criando || editando !== null}
        peca={editando}
        onFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        onSalvo={() => {
          setCriando(false)
          setEditando(null)
          void queryClient.invalidateQueries({ queryKey: ['catalogo-pecas'] })
          avisar('Peça salva.')
        }}
      />
    </Cartao>
  )
}

function ModalPeca({
  aberto,
  peca,
  onFechar,
  onSalvo,
}: {
  aberto: boolean
  peca: PecaCatalogo | null
  onFechar: () => void
  onSalvo: () => void
}) {
  const [descricao, setDescricao] = useState('')
  const [codigo, setCodigo] = useState('')
  const [fabricante, setFabricante] = useState('')
  const [valor, setValor] = useState('')
  const [estoque, setEstoque] = useState('0')
  const [minimo, setMinimo] = useState('0')
  const [ativo, setAtivo] = useState(true)
  const [erro, setErro] = useState<string>()

  useEffect(() => {
    if (!aberto) return
    setDescricao(peca?.descricao ?? '')
    setCodigo(peca?.codigo ?? '')
    setFabricante(peca?.fabricante ?? '')
    setValor(peca?.valorSugerido != null ? String(peca.valorSugerido) : '')
    setEstoque(peca ? String(peca.quantidadeEstoque) : '0')
    setMinimo(peca ? String(peca.estoqueMinimo) : '0')
    setAtivo(peca?.ativo ?? true)
    setErro(undefined)
  }, [aberto, peca])

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        descricao,
        codigo: codigo.trim() || undefined,
        fabricante: fabricante.trim() || undefined,
        valorSugerido: valor ? Number(valor) : undefined,
        quantidadeEstoque: Number(estoque),
        estoqueMinimo: Number(minimo),
        ativo,
      }
      return peca
        ? api(`/pecas/catalogo/${peca.id}`, { metodo: 'PUT', corpo })
        : api('/pecas/catalogo', { metodo: 'POST', corpo })
    },
    onSuccess: onSalvo,
    onError: (falha: Error) => setErro(falha.message),
  })

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={peca ? `Editar ${peca.descricao}` : 'Nova peça'}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            carregando={salvar.isPending}
            disabled={descricao.trim().length < 2}
            onClick={() => salvar.mutate()}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Peça" obrigatorio>
            <Entrada
              autoFocus
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Filtro de óleo Tecfil PSL560"
            />
          </Campo>
        </div>
        <Campo
          rotulo="Código do fabricante"
          dica="É o que impede cadastrar a mesma peça duas vezes."
        >
          <Entrada value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </Campo>
        <Campo rotulo="Fabricante">
          <Entrada value={fabricante} onChange={(e) => setFabricante(e.target.value)} />
        </Campo>
        <Campo rotulo="Preço sugerido (R$)" dica="Vem preenchido quando o mecânico escolhe a peça.">
          <Entrada type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
        <Campo
          rotulo="Na prateleira"
          dica="Normalmente se move sozinho. Mexa aqui quando contar o estoque e o sistema estiver errado."
        >
          <Entrada type="number" step="0.5" min="0" value={estoque} onChange={(e) => setEstoque(e.target.value)} />
        </Campo>
        <Campo rotulo="Avisar quando chegar em" dica="Zero desliga o aviso.">
          <Entrada type="number" step="0.5" min="0" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </Campo>
        <div className="sm:col-span-2">
          <Interruptor
            ativo={ativo}
            rotulo="Peça em uso"
            descricao="Desligue em vez de apagar: o histórico das OS que usaram esta peça continua valendo."
            onChange={setAtivo}
          />
        </div>
        <div className="sm:col-span-2">{erro && <p className="text-sm text-red-700">{erro}</p>}</div>
      </div>
    </Modal>
  )
}
