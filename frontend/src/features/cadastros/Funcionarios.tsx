import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Users } from 'lucide-react'
import { api } from '../../api/client'
import type { Especialidade, Funcionario } from '../../types'
import {
  AvisoErro,
  Botao,
  Campo,
  Carregando,
  Cartao,
  CartaoTitulo,
  Entrada,
  Etiqueta,
  Interruptor,
  Modal,
  Selecao,
  Vazio,
  cx,
  useAviso,
} from '../../components/ui'
import { horas } from '../../lib/format'

export default function Funcionarios() {
  const avisar = useAviso()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<Funcionario | null>(null)
  const [criando, setCriando] = useState(false)

  const lista = useQuery({
    queryKey: ['funcionarios', false],
    queryFn: () => api<Funcionario[]>('/funcionarios'),
  })

  const especialidades = useQuery({
    queryKey: ['especialidades', false],
    queryFn: () => api<Especialidade[]>('/especialidades'),
  })

  const totalHoras = (lista.data ?? [])
    .filter((f) => f.ativo)
    .reduce((soma, f) => soma + Number(f.horasPorDia), 0)

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Funcionários</h1>
          <p className="mt-1 text-sm text-slate-500">
            A jornada dos funcionários ativos é a capacidade de horas da oficina:{' '}
            <span className="font-medium text-slate-700">{horas(totalHoras)} por dia</span>.
          </p>
        </div>
        <Botao onClick={() => setCriando(true)}>
          <Plus className="size-4" aria-hidden />
          Novo funcionário
        </Botao>
      </header>

      <Cartao>
        <CartaoTitulo
          titulo="Equipe"
          descricao="A especialidade define quais serviços o funcionário pode assumir"
        />
        {lista.isLoading ? (
          <Carregando />
        ) : (lista.data ?? []).length === 0 ? (
          <Vazio
            icone={<Users className="size-10" />}
            titulo="Nenhum funcionário cadastrado"
            descricao="Cadastre a equipe para poder atribuir serviços e medir a capacidade da oficina."
            acao={<Botao onClick={() => setCriando(true)}>Cadastrar o primeiro</Botao>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.data!.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className={cx(
                    'grid size-9 flex-none place-items-center rounded-full text-sm font-semibold',
                    f.ativo ? 'bg-marca-100 text-marca-700' : 'bg-slate-100 text-slate-400',
                  )}
                >
                  {f.nome.charAt(0).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cx(
                        'text-sm font-medium',
                        f.ativo ? 'text-slate-900' : 'text-slate-400 line-through',
                      )}
                    >
                      {f.nome}
                    </p>
                    {f.papelDescricao && <Etiqueta>{f.papelDescricao}</Etiqueta>}
                    {!f.ativo && (
                      <Etiqueta className="bg-slate-100 text-slate-500 ring-slate-200">
                        Inativo
                      </Etiqueta>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {horas(f.horasPorDia)}/dia
                    {f.email && ` · ${f.email}`}
                    {f.telefone && ` · ${f.telefone}`}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {f.especialidades.length === 0 ? (
                      <span className="text-[11px] text-amber-700">
                        Sem especialidade — não vai aparecer na atribuição de serviços
                      </span>
                    ) : (
                      f.especialidades.map((e) => (
                        <Etiqueta key={e.id} className="bg-slate-50 text-slate-600 ring-slate-200">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: e.cor }}
                            aria-hidden
                          />
                          {e.nome}
                        </Etiqueta>
                      ))
                    )}
                  </div>
                </div>

                <Botao variante="secundario" tamanho="sm" onClick={() => setEditando(f)}>
                  Editar
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <ModalFuncionario
        aberto={criando || editando !== null}
        funcionario={editando}
        especialidades={especialidades.data ?? []}
        onFechar={() => {
          setCriando(false)
          setEditando(null)
        }}
        onSalvo={() => {
          setCriando(false)
          setEditando(null)
          void queryClient.invalidateQueries({ queryKey: ['funcionarios'] })
          avisar('Funcionário salvo.')
        }}
      />
    </div>
  )
}

function ModalFuncionario({
  aberto,
  funcionario,
  especialidades,
  onFechar,
  onSalvo,
}: {
  aberto: boolean
  funcionario: Funcionario | null
  especialidades: Especialidade[]
  onFechar: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [horasPorDia, setHorasPorDia] = useState('8')
  const [custoHora, setCustoHora] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const [darAcesso, setDarAcesso] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState('MECANICO')
  const [erro, setErro] = useState<string>()

  useEffect(() => {
    if (!aberto) return
    setNome(funcionario?.nome ?? '')
    setTelefone(funcionario?.telefone ?? '')
    setHorasPorDia(String(funcionario?.horasPorDia ?? 8))
    setCustoHora(funcionario?.custoHora ? String(funcionario.custoHora) : '')
    setAtivo(funcionario?.ativo ?? true)
    setEscolhidas(funcionario?.especialidades.map((e) => e.id) ?? [])
    setDarAcesso(Boolean(funcionario?.email))
    setEmail(funcionario?.email ?? '')
    setSenha('')
    setPapel(funcionario?.papel ?? 'MECANICO')
    setErro(undefined)
  }, [aberto, funcionario])

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        nome,
        telefone: telefone || undefined,
        horasPorDia: Number(horasPorDia),
        custoHora: custoHora ? Number(custoHora) : undefined,
        ativo,
        especialidadeIds: escolhidas,
        acesso: darAcesso
          ? { email, senha: senha || undefined, papel }
          : undefined,
      }
      return funcionario
        ? api(`/funcionarios/${funcionario.id}`, { metodo: 'PUT', corpo })
        : api('/funcionarios', { metodo: 'POST', corpo })
    },
    onSuccess: onSalvo,
    onError: (falha: Error) => setErro(falha.message),
  })

  const alternar = (id: string) =>
    setEscolhidas((atuais) =>
      atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id],
    )

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={funcionario ? 'Editar funcionário' : 'Novo funcionário'}
      largura="max-w-xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo rotulo="Nome" obrigatorio>
              <Entrada autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
            </Campo>
          </div>
          <Campo rotulo="Telefone">
            <Entrada value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </Campo>
          <Campo rotulo="Horas por dia" dica="Entra no cálculo de capacidade">
            <Entrada
              type="number"
              step="0.5"
              min="0.5"
              value={horasPorDia}
              onChange={(e) => setHorasPorDia(e.target.value)}
            />
          </Campo>
          <Campo rotulo="Custo por hora (R$)" dica="Opcional, usado em relatórios">
            <Entrada
              type="number"
              step="0.01"
              min="0"
              value={custoHora}
              onChange={(e) => setCustoHora(e.target.value)}
            />
          </Campo>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">Especialidades</p>
          <div className="flex flex-wrap gap-2">
            {especialidades.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => alternar(e.id)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ring-1 transition',
                  escolhidas.includes(e.id)
                    ? 'bg-marca-50 text-marca-900 ring-marca-400'
                    : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
                )}
              >
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: e.cor }}
                  aria-hidden
                />
                {e.nome}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            O sistema só deixa atribuir um serviço a quem tem a especialidade exigida.
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
          <Interruptor
            ativo={ativo}
            rotulo="Funcionário ativo"
            descricao="Inativo não recebe serviços e perde o acesso ao sistema"
            onChange={setAtivo}
          />
        </div>

        <div className="rounded-lg px-3 ring-1 ring-slate-200">
          <Interruptor
            ativo={darAcesso}
            rotulo="Dar acesso ao sistema"
            descricao="Cria um login para o funcionário apontar as próprias horas"
            onChange={setDarAcesso}
          />
          {darAcesso && (
            <div className="grid gap-3 pb-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Campo rotulo="E-mail de acesso" obrigatorio>
                  <Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Campo>
              </div>
              <Campo
                rotulo={funcionario?.email ? 'Nova senha' : 'Senha'}
                obrigatorio={!funcionario?.email}
                dica={funcionario?.email ? 'Deixe vazio para manter a atual' : 'Mínimo 6 caracteres'}
              >
                <Entrada
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </Campo>
              <Campo rotulo="Perfil">
                <Selecao value={papel} onChange={(e) => setPapel(e.target.value)}>
                  <option value="MECANICO">Mecânico</option>
                  <option value="RECEPCAO">Recepção</option>
                  <option value="GERENTE">Gerente</option>
                  <option value="DONO">Dono</option>
                </Selecao>
              </Campo>
              <p className="sm:col-span-2 flex items-start gap-1.5 text-[11px] text-slate-500">
                <KeyRound className="mt-0.5 size-3 flex-none" aria-hidden />
                A senha é guardada com BCrypt — nem o dono consegue vê-la depois. Para trocar, basta
                digitar uma nova aqui.
              </p>
            </div>
          )}
        </div>

        <AvisoErro mensagem={erro} />
      </div>
    </Modal>
  )
}
