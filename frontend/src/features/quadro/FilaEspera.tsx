import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Clock, Inbox, ListOrdered, ParkingCircle } from 'lucide-react'
import { api } from '../../api/client'
import type { Fila, ItemFila } from '../../types'
import {
  Botao,
  Carregando,
  Cartao,
  CartaoTitulo,
  Etiqueta,
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import { CORES_PRIORIDADE, CORES_STATUS, dataCompleta, diasTexto, horas } from '../../lib/format'
import { useAuth } from '../../lib/auth'
import { CHAVES, useConfig } from '../../lib/config'

/**
 * Fila de espera: quando um carro sai, a vaga dele aparece para o proximo.
 * A data de cada carro sai de uma simulacao de capacidade — o segundo da fila
 * so entra depois que o primeiro ocupou a vaga dele.
 */
export default function FilaEspera() {
  const { gerencia } = useAuth()
  const { flag } = useConfig()
  const avisar = useAviso()
  const queryClient = useQueryClient()

  const podeAlocar = gerencia || flag(CHAVES.mecanicoRealoca)

  const consulta = useQuery({
    queryKey: ['fila'],
    queryFn: () => api<Fila>('/fila'),
    refetchInterval: 60_000,
  })

  const alocar = useMutation({
    mutationFn: ({ osId, data }: { osId: string; data: string }) =>
      api(`/os/${osId}/alocar`, { metodo: 'POST', corpo: { dataAgendada: data } }),
    onSuccess: () => {
      avisar('Carro colocado na agenda.')
      void queryClient.invalidateQueries({ queryKey: ['fila'] })
      void queryClient.invalidateQueries({ queryKey: ['quadro'] })
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  if (consulta.isLoading) return <Carregando texto="Calculando a fila..." />

  const fila = consulta.data!
  const semVaga = fila.itens.filter((i) => !i.entradaPrevista)

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <ListOrdered className="size-5 text-slate-400" aria-hidden />
          Fila de espera
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Carros que entraram e ainda não têm dia marcado, na ordem de prioridade e chegada. A data
          prevista considera a vaga liberando quando o carro que está nela sai.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Cartao className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
            <Inbox className="size-3.5" aria-hidden />
            Na fila
          </p>
          <p className="text-xl font-bold text-slate-900">{fila.itens.length}</p>
          <p className="text-[11px] text-slate-500">{horas(fila.backlogHoras)} de trabalho parado</p>
        </Cartao>

        <Cartao className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
            <ParkingCircle className="size-3.5" aria-hidden />
            Vagas livres agora
          </p>
          <p
            className={cx(
              'text-xl font-bold',
              fila.vagasLivresHoje === 0 ? 'text-red-600' : 'text-emerald-600',
            )}
          >
            {fila.vagasLivresHoje} de {fila.vagasTotal}
          </p>
          <p className="text-[11px] text-slate-500">
            {fila.vagasLivresHoje === 0 ? 'oficina lotada agora' : 'dá para receber carro hoje'}
          </p>
        </Cartao>

        <Cartao className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
            <Clock className="size-3.5" aria-hidden />
            Próxima vaga
          </p>
          <p className="text-xl font-bold text-slate-900">
            {fila.proximaVagaLivre ? dataCompleta(fila.proximaVagaLivre) : '—'}
          </p>
          <p className="text-[11px] text-slate-500">
            {fila.proximaVagaLivre
              ? 'primeiro dia com box livre'
              : 'sem vaga nos próximos 90 dias'}
          </p>
        </Cartao>
      </div>

      {semVaga.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
          {semVaga.length} carro(s) da fila não cabem nos próximos 90 dias com a capacidade atual.
          Ou a oficina precisa entregar mais rápido, ou esses clientes precisam de outra data — e o
          sistema está dizendo isso antes de você prometer prazo.
        </div>
      )}

      <Cartao>
        <CartaoTitulo
          titulo="Ordem de entrada"
          descricao="Prioridade primeiro, depois quem chegou antes"
        />
        {fila.itens.length === 0 ? (
          <Vazio
            icone={<Inbox className="size-10" />}
            titulo="Fila vazia"
            descricao="Todo carro que está na oficina já tem dia marcado na agenda."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {fila.itens.map((item) => (
              <LinhaFila
                key={item.os.id}
                item={item}
                podeAlocar={podeAlocar}
                alocando={alocar.isPending}
                onAlocar={(data) => alocar.mutate({ osId: item.os.id, data })}
              />
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  )
}

function LinhaFila({
  item,
  podeAlocar,
  alocando,
  onAlocar,
}: {
  item: ItemFila
  podeAlocar: boolean
  alocando: boolean
  onAlocar: (data: string) => void
}) {
  const os = item.os
  const cores = CORES_STATUS[os.status]

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span
        className={cx(
          'grid size-8 flex-none place-items-center rounded-full text-xs font-bold',
          item.posicao === 1 ? 'bg-marca-600 text-white' : 'bg-slate-100 text-slate-600',
        )}
        title={`${item.posicao}º da fila`}
      >
        {item.posicao}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/os/${os.id}`}
            className="font-mono text-sm font-semibold text-slate-900 hover:text-marca-700"
          >
            {os.placa}
          </Link>
          <span className="text-xs text-slate-500">
            {os.veiculo} · {os.clienteNome}
          </span>
          <Etiqueta className={cores.chip}>{os.statusDescricao}</Etiqueta>
          {os.prioridade !== 'NORMAL' && (
            <Etiqueta className={CORES_PRIORIDADE[os.prioridade]}>{os.prioridade}</Etiqueta>
          )}
        </div>
        {os.queixa && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{os.queixa}</p>}
        <p className="text-[11px] text-slate-400">
          esperando {diasTexto(item.diasEsperando)} · precisa de {horas(item.horasNecessarias)}
        </p>
      </div>

      <div className="flex flex-none items-center gap-3">
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Entrada prevista</p>
          <p
            className={cx(
              'text-sm font-semibold capitalize',
              item.entradaPrevista ? 'text-slate-800' : 'text-red-600',
            )}
          >
            {item.entradaPrevistaRotulo}
          </p>
        </div>

        {podeAlocar && item.entradaPrevista && (
          <Botao
            tamanho="sm"
            carregando={alocando}
            onClick={() => onAlocar(item.entradaPrevista!)}
            title="Coloca o carro na agenda nesse dia"
          >
            <CalendarPlus className="size-3.5" aria-hidden />
            Agendar
          </Botao>
        )}
      </div>
    </li>
  )
}
