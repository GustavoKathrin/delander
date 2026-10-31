import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Clock,
  History,
  Package,
  PauseCircle,
  Plus,
  Printer,
  Share2,
  Trash2,
  User,
  Wrench,
  BellRing,
  FileText,
  Pencil,
  Send,
} from 'lucide-react'
import { api } from '../../api/client'
import type {
  Box,
  DetalheOs as DetalheTipo,
  FilaElevador,
  Funcionario,
  ItemOs,
  MomentoPeca,
  PecaCatalogo,
  MotivoParada,
  OrigemPeca,
  ResumoArtigo,
  ResumoLeitura,
  ServicoCatalogo,
  StatusOs,
} from '../../types'
import {
  AreaTexto,
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
import {
  CORES_ITEM,
  CORES_PRIORIDADE,
  CORES_STATUS,
  dataCompleta,
  dataHora,
  diasTexto,
  horaMinuto,
  horas,
  moeda,
} from '../../lib/format'
import { useAuth } from '../../lib/auth'
import { CHAVES, useConfig } from '../../lib/config'
import { CarroTopo, Placa } from '../../components/oficina'
import ModalCompartilhar from './ModalCompartilhar'
import { RegistrarTrabalho } from './RegistrarTrabalho'
import { ChecklistEntrada } from './ChecklistEntrada'
import { PrecoDaPeca } from '../../components/PrecoDaPeca'
import { GaleriaFotos } from './GaleriaFotos'
import { HistoricoDaOs } from './HistoricoDaOs'
import { ModalOrcamento } from './ModalOrcamento'
import { RequisitosDaEtapa } from './RequisitosDaEtapa'
import { AjudaDaTela } from '../../components/AjudaDaTela'
import { EtapasDaOs, SecaoDaEtapa, etapaDaOs } from './EtapasDaOs'
import { LinhaServico } from './LinhaServico'
import { ModalMotivoServico } from './ModalMotivoServico'
import type { AcaoServico } from './ModalMotivoServico'
import { ModalAnotarServico } from './ModalAnotarServico'
import { BuscaPeca } from './BuscaPeca'

const ROTULOS_ACAO: Partial<Record<StatusOs, string>> = {
  EM_DIAGNOSTICO: 'Iniciar diagnóstico',
  AGUARDANDO_APROVACAO: 'Enviar orçamento',
  ORCAMENTO_APROVADO: 'Aprovar orçamento',
  AGENDADO: 'Agendar',
  EM_EXECUCAO: 'Iniciar execução',
  PAUSADO: 'Pausar',
  PRONTO_AGUARDANDO_RETIRADA: 'Marcar como pronto',
  ENTREGUE: 'Entregar veículo',
  CANCELADO: 'Cancelar OS',
  RECEBIDO: 'Voltar para recebido',
}

/**
 * O mesmo destino quer dizer coisas diferentes dependendo de onde a OS esta.
 *
 * Voltar para o diagnostico vindo da aprovacao nao e "iniciar diagnostico" —
 * e o cliente ter dito nao. Chamar os dois de "Iniciar diagnostico" faria o
 * atendente recusar um orcamento achando que estava so voltando uma etapa.
 */
/**
 * Voltar uma etapa não pode usar o texto de avançar.
 *
 * Era o que acontecia: com o carro em execução, o botão de voltar ao orçamento
 * dizia "Aprovar orçamento" — o mesmo texto do avanço, mudando só a cor. Quem
 * lia entendia que ia aprovar alguma coisa, e não desfazer.
 */
const ROTULOS_RECUO: Partial<Record<StatusOs, string>> = {
  ORCAMENTO_APROVADO: 'Voltar para o orçamento',
  EM_DIAGNOSTICO: 'Voltar ao diagnóstico',
  AGENDADO: 'Voltar para a agenda',
  EM_EXECUCAO: 'Voltar para a execução',
}

/** A ordem das etapas, para saber o que é avanço e o que é recuo. */
const ORDEM_ETAPA: Record<StatusOs, number> = {
  RECEBIDO: 0,
  AGENDADO: 0,
  EM_DIAGNOSTICO: 1,
  AGUARDANDO_APROVACAO: 2,
  ORCAMENTO_APROVADO: 2,
  EM_EXECUCAO: 3,
  PAUSADO: 3,
  PRONTO_AGUARDANDO_RETIRADA: 4,
  ENTREGUE: 5,
  CANCELADO: 0,
}

function rotuloDaAcao(de: StatusOs, para: StatusOs): string {
  if (para === 'EM_DIAGNOSTICO' && de === 'AGUARDANDO_APROVACAO') {
    return 'Cliente recusou'
  }
  // Pausar e retomar andam de lado, não para trás: mantêm o texto de sempre.
  if (para !== 'PAUSADO' && de !== 'PAUSADO' && ORDEM_ETAPA[para] < ORDEM_ETAPA[de]) {
    return ROTULOS_RECUO[para] ?? ROTULOS_ACAO[para] ?? para
  }
  return ROTULOS_ACAO[para] ?? para
}

/** Quem pode dar o passo. O servidor recusa de novo; aqui é só não mostrar. */
function podeAcionar(
  de: StatusOs,
  para: StatusOs,
  perfil: { podeAtender: boolean; ehMecanico: boolean; gerencia: boolean },
): boolean {
  if (para === 'ORCAMENTO_APROVADO' || (para === 'EM_DIAGNOSTICO' && de === 'AGUARDANDO_APROVACAO')) {
    return perfil.podeAtender
  }
  if (para === 'EM_EXECUCAO') {
    return perfil.ehMecanico || perfil.gerencia
  }
  return true
}

export default function DetalheOs() {
  const { id = '' } = useParams()
  const { gerencia, ehMecanico, podeAtender } = useAuth()
  const perfil = { gerencia, ehMecanico, podeAtender }
  // Quem registra trabalho e quem trabalha. Atendente nao tem o que contar
  // sobre o servico, e o cliente le esses registros pelo link.
  const podeRegistrarTrabalho = ehMecanico || gerencia
  const { flag } = useConfig()
  const avisar = useAviso()
  const queryClient = useQueryClient()

  const [compartilhando, setCompartilhando] = useState(false)
  const [mandandoOrcamento, setMandandoOrcamento] = useState(false)
  /** Perguntar sobre o aviso antes de iniciar a execução. */
  const [iniciandoExecucao, setIniciandoExecucao] = useState(false)
  const [pausando, setPausando] = useState<StatusOs | null>(null)
  const [motivoParadaId, setMotivoParadaId] = useState('')
  const [descricaoParada, setDescricaoParada] = useState('')
  const [paradaVisivel, setParadaVisivel] = useState(true)
  /** A âncora da vistoria de entrada, para "Tirar foto" saber onde rolar. */
  const ANCORA_RECEBIMENTO = 'bloco-recebimento'
  /**
   * Qual etapa abriu a gaveta das outras etapas — não um "está aberta".
   *
   * Guardando a etapa, "está aberta?" vira uma comparação e ela se fecha
   * sozinha quando o carro anda. Com um booleano, fechar exigiria um
   * `useEffect` depois de `etapaAtual` — que vem depois do return do
   * carregamento, e hook condicional o React recusa.
   */
  const [gavetaAberta, setGavetaAberta] = useState<number | null>(null)

  const [adicionandoServico, setAdicionandoServico] = useState(false)
  const [adicionandoPeca, setAdicionandoPeca] = useState(false)
  /** O serviço cujo motivo estamos perguntando, e para qual ação. */
  const [acaoServico, setAcaoServico] = useState<{ item: ItemOs; acao: AcaoServico } | null>(null)
  /** O serviço sobre o qual se vai anotar o trabalho. */
  const [anotando, setAnotando] = useState<ItemOs | null>(null)
  const [erroAcao, setErroAcao] = useState<string>()

  const consulta = useQuery({
    queryKey: ['os', id],
    queryFn: () => api<DetalheTipo>(`/os/${id}`),
    refetchInterval: 30_000,
  })

  const motivos = useQuery({
    queryKey: ['motivos', true],
    queryFn: () => api<MotivoParada[]>('/motivos-parada?apenasAtivos=true'),
  })

  const funcionarios = useQuery({
    queryKey: ['funcionarios', true],
    queryFn: () => api<Funcionario[]>('/funcionarios?apenasAtivos=true'),
    enabled: gerencia,
  })

  const boxes = useQuery({
    queryKey: ['boxes', true],
    queryFn: () => api<Box[]>('/boxes?apenasAtivos=true'),
    enabled: gerencia,
  })

  /** A reserva viva nao vem no resumo; sai da fila do elevador. */
  const filaElevador = useQuery({
    queryKey: ['elevadores'],
    queryFn: () => api<FilaElevador>('/elevadores'),
    enabled: gerencia,
  })

  /** Artigos da wiki que servem para este modelo. */
  const wikiDoCarro = useQuery({
    queryKey: ['wiki-veiculo', consulta.data?.resumo.veiculoId],
    queryFn: () => api<ResumoArtigo[]>(`/wiki/veiculo/${consulta.data!.resumo.veiculoId}`),
    enabled: Boolean(consulta.data?.resumo.veiculoId),
  })

  /** As leituras deste carro: o "clico no carro e vejo os relatorios dele". */
  const leiturasDoCarro = useQuery({
    queryKey: ['leituras-veiculo', consulta.data?.resumo.veiculoId],
    queryFn: () => api<ResumoLeitura[]>(`/leituras/veiculo/${consulta.data!.resumo.veiculoId}`),
    enabled: Boolean(consulta.data?.resumo.veiculoId),
  })

  const [elevadorEscolhido, setElevadorEscolhido] = useState('')
  const elevadores = (boxes.data ?? []).filter((b) => b.tipo === 'ELEVADOR')
  const reservaAtual = filaElevador.data?.emUso.find((r) => r.osId === id)

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['os', id] })
    void queryClient.invalidateQueries({ queryKey: ['quadro'] })
    void queryClient.invalidateQueries({ queryKey: ['radar'] })
    void queryClient.invalidateQueries({ queryKey: ['patio'] })
    void queryClient.invalidateQueries({ queryKey: ['elevadores'] })
  }

  const transicionar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) =>
      api<DetalheTipo>(`/os/${id}/transicao`, { metodo: 'POST', corpo }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      setPausando(null)
      setMotivoParadaId('')
      setDescricaoParada('')
      setErroAcao(undefined)
      avisar(`OS agora está em "${dados.resumo.statusDescricao}".`)
    },
    onError: (erro: Error) => setErroAcao(erro.message),
  })

  const avisarInicio = useMutation({
    mutationFn: () => api<DetalheTipo>(`/os/${id}/avisar-inicio`, { metodo: 'POST' }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Cliente avisado de que o serviço começou.')
    },
    onError: (erro: Error) => setErroAcao(erro.message),
  })

  const alocar = useMutation({
    mutationFn: (corpo: Record<string, unknown>) =>
      api<DetalheTipo>(`/os/${id}/alocar`, { metodo: 'POST', corpo }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Agenda atualizada.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const marcarElevador = useMutation({
    mutationFn: (precisaElevador: boolean) =>
      api<DetalheTipo>(`/os/${id}/elevador`, { metodo: 'PATCH', corpo: { precisaElevador } }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const subirElevador = useMutation({
    mutationFn: (boxId: string) =>
      api<DetalheTipo>(`/os/${id}/elevador/subir`, { metodo: 'POST', corpo: { boxId } }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Carro no elevador.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const descerElevador = useMutation({
    mutationFn: () => api<DetalheTipo>(`/os/${id}/elevador/descer`, { metodo: 'POST' }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Carro desceu do elevador.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  const atribuir = useMutation({
    mutationFn: ({ itemId, funcionarioId }: { itemId: string; funcionarioId: string }) =>
      api<DetalheTipo>(`/os/${id}/itens/${itemId}/atribuir`, {
        metodo: 'POST',
        corpo: { funcionarioId },
      }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  /**
   * Mudar o estado de um serviço.
   *
   * Um endpoint só para iniciar, pausar, concluir e cancelar, porque do ponto
   * de vista de quem aperta o botão é a mesma coisa: este serviço andou.
   */
  const transicionarItem = useMutation({
    mutationFn: ({ itemId, corpo }: { itemId: string; corpo: Record<string, unknown> }) =>
      api<DetalheTipo>(`/os/${id}/itens/${itemId}/transicao`, { metodo: 'POST', corpo }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      setAcaoServico(null)
      setErroAcao(undefined)
    },
    onError: (erro: Error) => setErroAcao(erro.message),
  })

  const removerItem = useMutation({
    mutationFn: (itemId: string) =>
      api<DetalheTipo>(`/os/${id}/itens/${itemId}`, { metodo: 'DELETE' }),
    onSuccess: (dados) => {
      queryClient.setQueryData(['os', id], dados)
      invalidar()
      avisar('Serviço removido.')
    },
    onError: (erro: Error) => avisar(erro.message, 'erro'),
  })

  if (consulta.isLoading) return <Carregando texto="Abrindo a OS..." />
  // `!consulta.data` junto com o erro de propósito: existe um terceiro estado,
  // nem carregando nem em erro, quando a consulta está entre tentativas — API
  // reiniciando, rede caindo. Com `consulta.data!` a tela ficava **em branco**,
  // que é a pior falha possível: ninguém sabe se quebrou o sistema ou a
  // internet, e não há o que fazer na tela.
  if (consulta.isError || !consulta.data) {
    return (
      <div className="p-4">
        <Vazio
          titulo="Não foi possível abrir a OS"
          descricao={(consulta.error as Error)?.message ?? 'Sem resposta do servidor.'}
          acao={<Botao onClick={() => void consulta.refetch()}>Tentar de novo</Botao>}
        />
      </div>
    )
  }

  const os = consulta.data
  const r = os.resumo
  const cores = CORES_STATUS[r.status]
  const mostraValores = gerencia || flag(CHAVES.mecanicoVeValores)

  /**
   * Em que etapa das SETE este carro esta.
   *
   * Nao e o status do servidor: tres etapas -- pecas, cotacao e mao de obra
   * -- acontecem todas em EM_DIAGNOSTICO. `etapaDaOs` le o dado para
   * distinguir, e e dela que sai a cor de cada secao.
   */
  const etapaAtual = etapaDaOs(os)
  /**
   * De que etapa e cada seção.
   *
   * A mesma lista de serviços é trabalho diferente conforme o carro: antes
   * de aprovar, lançar serviço é dizer o que o carro precisa (etapa 2);
   * depois, é fazer (etapa 6); na entrega, é o registro do que foi feito
   * (etapa 7). A peça ainda passa pela 3, que é quando ela deixa de ser "o
   * que falta" e vira "quanto custa e quando chega".
   */
  const etapaDoServico = etapaAtual >= 6 ? etapaAtual : 2
  const etapaDaPeca =
    etapaAtual >= 6 ? etapaAtual : etapaAtual === 3 ? 3 : 2
  const etapaDosValores = etapaAtual >= 7 ? 7 : etapaAtual >= 5 ? 5 : 4
  const etapaDasFotos = etapaAtual >= 7 ? 7 : 6
  /** A gaveta so conta como aberta para a etapa que a abriu. */
  const verOutrasEtapas = gavetaAberta === etapaAtual
  /**
   * Leva a pessoa até a vistoria de entrada, onde mora a foto.
   *
   * Fora da etapa 1 essa seção vive na gaveta, fechada: rolar até um
   * elemento que não está montado não faz nada, e o botão pareceria
   * quebrado. Abre primeiro, rola depois que o React montou.
   */
  const irParaFotos = () => {
    setGavetaAberta(etapaAtual)
    // Procura pelo id, e nao por uma ref: fora da etapa 1 a seção ainda não
    // existe no instante do clique, e uma ref de um elemento que vai nascer
    // chega vazia. Com o id, cada tentativa pergunta ao DOM de novo.
    //
    // Por timeout e não por quadro: o navegador não entrega quadro para uma
    // aba em segundo plano, e o botão ficaria mudo ao voltar para ela.
    const rolar = (tentativas: number) => {
      const alvo = document.getElementById(ANCORA_RECEBIMENTO)
      if (alvo) {
        // `auto` e nao `smooth`: a rolagem suave simplesmente nao acontece em
        // parte dos navegadores embarcados (medido: scrollY ficava em 0), e
        // quando acontece sao 1600px de animacao num celular -- o mecanico
        // perde de vista onde estava. O salto diz melhor "voce esta aqui".
        alvo.scrollIntoView({ behavior: 'auto', block: 'start' })
      } else if (tentativas > 0) {
        window.setTimeout(() => rolar(tentativas - 1), 50)
      }
    }
    rolar(20)
  }
  const descricaoDosServicos =
    `${os.itens.length === 1 ? '1 serviço' : `${os.itens.length} serviços`}` +
    ` · ${horas(r.horasEstimadas)} estimadas` +
    (etapaDoServico >= 6
      ? ' · os botões valem para cada serviço, um por um'
      : ' · isto é o que vai para o orçamento')


  // ---------------------------------------------------------------- seções
  //
  // Cada seção pertence a UMA etapa, e só aparece quando o carro está nela.
  //
  // Antes elas ficavam todas na tela ao mesmo tempo, só pintadas com a cor da
  // etapa a que pertencem. O dono, olhando: "em cada etapa só quero os campos
  // necessários para concluir cada etapa, ficou confuso do jeito que vc fez"
  // — e tinha razão: a cor dizia "isto é de outra etapa" e a presença dizia
  // "preencha agora". Duas mensagens opostas na mesma caixa.
  //
  // O que não é da etapa corrente não some: vai para `foraDaEtapa`, atrás de
  // um toque. Conferir a vistoria de entrada com o carro já na bancada é uma
  // coisa que se faz.
  const secaoRecebimento = (
    <div key="recebimento" id={ANCORA_RECEBIMENTO} className="scroll-mt-4">
      <SecaoDaEtapa
        etapa={1}
        titulo="Vistoria de entrada"
        descricao="Como o carro chegou. É a prova dos dois lados se aparecer avaria depois."
      >
        <ChecklistEntrada os={os} gerencia={gerencia} />
      </SecaoDaEtapa>
    </div>
  )

  const secaoServicos = (
    <SecaoDaEtapa
      key="servicos"
      etapa={etapaDoServico}
      titulo="Serviços"
      descricao={descricaoDosServicos}
      acao={
        // O mecânico também lança serviço: é o diagnóstico dele que diz o
        // que o carro precisa. Quem protege a oficina é ele não ver nem
        // escrever preço.
        podeRegistrarTrabalho && (
          <Botao variante="secundario" tamanho="toque" onClick={() => setAdicionandoServico(true)}>
            <Plus className="size-4" aria-hidden />
            Adicionar
          </Botao>
        )
      }
    >
      {os.itens.length === 0 ? (
        <Vazio
          icone={<Wrench className="size-8" />}
          titulo="Nenhum serviço na OS"
          descricao="Adicione o que será feito para o sistema poder estimar o tempo e a capacidade do dia."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {os.itens.map((item) => (
            <LinhaServico
              key={item.id}
              item={item}
              osId={os.resumo.id}
              fotos={os.arquivos.filter((a) => a.osItemId === item.id).length}
              gerencia={gerencia}
              mostraValores={mostraValores}
              funcionarios={funcionarios.data ?? []}
              salvando={transicionarItem.isPending}
              onAtribuir={(funcionarioId) => atribuir.mutate({ itemId: item.id, funcionarioId })}
              onAcao={(acao) => setAcaoServico({ item, acao })}
              onIniciar={() =>
                transicionarItem.mutate({
                  itemId: item.id,
                  corpo: {
                    status: 'EM_EXECUCAO',
                    // A estimativa do próprio serviço vai junto.
                    //
                    // Sem ela, este botão NUNCA funcionava: a oficina com
                    // "exigir estimativa" ligada (o padrão) devolvia 409
                    // "Informe quanto tempo você pretende gastar" em todo
                    // toque, e o mecânico não tinha onde informar — o campo
                    // só existe no modal do Painel do Mecânico. O serviço já
                    // traz a previsão do catálogo; começar com ela é melhor
                    // resposta que um erro, e quem quiser mudar muda no
                    // painel.
                    horasEstimadas: item.horasEstimadas,
                  },
                })
              }
              onRegistrarTrabalho={() => setAnotando(item)}
              onFotoEnviada={invalidar}
              onRemover={() => removerItem.mutate(item.id)}
            />
          ))}
        </ul>
      )}
    </SecaoDaEtapa>
  )

  // Na etapa 3 a peça fica âmbar: é quando ela deixa de ser "o que o carro
  // precisa" e vira "quanto custa e quando chega". A lista é a mesma; o
  // trabalho em cima dela, não.
  const secaoPecas = (
    <SecaoDaEtapa
      key="pecas"
      etapa={etapaDaPeca}
      titulo="Peças"
      descricao={
        etapaAtual === 3
          ? 'Marque o que tem no estoque e ponha o preço do que precisa comprar'
          : 'Falta de peça é o motivo número um de carro parado'
      }
      acao={
        podeRegistrarTrabalho && (
          <Botao variante="secundario" tamanho="toque" onClick={() => setAdicionandoPeca(true)}>
            <Plus className="size-4" aria-hidden />
            Adicionar
          </Botao>
        )
      }
    >
      {os.pecas.length === 0 ? (
        <Vazio
          icone={<Package className="size-8" />}
          titulo="Nenhuma peça registrada"
          descricao="Registre a peça e a previsão de chegada para o quadro mostrar por que o carro está parado."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {os.pecas.map((peca) => (
            <li key={peca.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  {peca.quantidade > 1 && `${peca.quantidade}x `}
                  {peca.descricao}
                </p>
                {/* Origem primeiro: é ela que diz se aquilo é dinheiro no
                    orçamento ou trabalho para alguém fazer. */}
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                  <span
                    className={cx(
                      'rounded px-1.5 py-0.5 font-medium',
                      peca.origem === 'ESTOQUE'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-orange-100 text-orange-800',
                    )}
                  >
                    {peca.origemDescricao}
                  </span>
                  {peca.origem === 'COMPRAR' && (
                    <>
                      <span>· {peca.momentoDescricao}</span>
                      <span>· {peca.fornecedor ?? 'sem fornecedor'}</span>
                      {peca.previsaoChegada && ` · chega ${dataCompleta(peca.previsaoChegada)}`}
                    </>
                  )}
                </p>
              </div>
              <Etiqueta
                className={cx(
                  peca.status === 'RECEBIDA' || peca.status === 'APLICADA'
                    ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                    : 'bg-amber-100 text-amber-800 ring-amber-200',
                )}
              >
                {peca.statusDescricao}
              </Etiqueta>
              {/* O preço entra aqui, editável.
                  A etapa 3 manda "ponha o preço do que precisa comprar" e
                  esta linha era só leitura: a única tela que cotava era a
                  fila de compras, e a etapa não levava até ela. Quem não vê
                  dinheiro não vê nada disto; peça de estoque também não,
                  porque o preço dela vem do cadastro. */}
              {mostraValores &&
                (peca.origem === 'COMPRAR' ? (
                  <span className="flex items-center gap-2">
                    {peca.quantidade > 1 && peca.valorUnitario != null && (
                      <span className="text-xs text-slate-500">{moeda(peca.total)}</span>
                    )}
                    <PrecoDaPeca osId={os.resumo.id} peca={peca} onSalvou={invalidar} />
                  </span>
                ) : (
                  <span className="w-24 text-right text-xs text-slate-600">{moeda(peca.total)}</span>
                ))}
            </li>
          ))}
        </ul>
      )}
    </SecaoDaEtapa>
  )

  // Quem não pode ver dinheiro não vê: o servidor nem manda os valores.
  const secaoValores = mostraValores ? (
    <SecaoDaEtapa
      key="valores"
      etapa={etapaDosValores}
      titulo={etapaAtual >= 5 ? 'Orçamento do cliente' : 'Mão de obra e total'}
      descricao={
        etapaAtual >= 5
          ? 'O que foi combinado com o cliente'
          : 'Quanto fica a mão de obra e o desconto que o balcão pode dar'
      }
    >
      <CartaoValores
        os={os}
        osId={id}
        onSalvo={invalidar}
        onMandarOrcamento={() => setMandandoOrcamento(true)}
      />
    </SecaoDaEtapa>
  ) : null

  // Seção de foto vazia numa OS já encerrada é só caixa vazia: ninguém vai
  // fotografar um carro que saiu, e o lugar de olhar foto antiga é o
  // prontuário.
  const semFotoDeServico = os.arquivos.every((a) => a.momento === 'ENTRADA')
  const osEncerrada = r.status === 'ENTREGUE' || r.status === 'CANCELADO'
  const secaoFotos = semFotoDeServico && osEncerrada ? null : (
    <SecaoDaEtapa
      key="fotos"
      etapa={etapaDasFotos}
      titulo="Fotos do serviço"
      descricao="Cada foto fica colada no serviço dela. Toque para abrir, liberar ao cliente ou apagar."
    >
      <GaleriaFotos os={os} gerencia={gerencia} onMudou={invalidar} />
    </SecaoDaEtapa>
  )

  /**
   * Agenda e vaga: etapa 1, e nao cartao solto.
   *
   * Dizer quando o carro entra e em que box e o passo 4 do check-in -- e
   * trabalho do recebimento. Ficava num cartao da coluna lateral, longe da
   * etapa que o pede, junto de mais cinco cartoes que nao eram de etapa
   * nenhuma. O dono, pela terceira vez: "os campos estao dentro das etapas,
   * nao fora delas".
   */
  const secaoAgenda = gerencia ? (
    <SecaoDaEtapa
      key="agenda"
      etapa={1}
      titulo="Agenda e vaga"
      descricao="Que dia o carro entra e em qual vaga ele fica"
    >
      <div className="space-y-3 p-4">
        <Campo rotulo="Dia na agenda">
          <Entrada
            type="date"
            value={r.dataAgendada ?? ''}
            onChange={(e) =>
              alocar.mutate({ dataAgendada: e.target.value || null, boxId: r.boxId ?? null })
            }
          />
        </Campo>
        <Campo rotulo="Box / vaga">
          <Selecao
            value={r.boxId ?? ''}
            onChange={(e) =>
              alocar.mutate({
                dataAgendada: r.dataAgendada ?? null,
                boxId: e.target.value || null,
              })
            }
          >
            <option value="">Sem vaga definida</option>
            {(boxes.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        {r.previsaoEntrega && (
          <p className={cx('text-xs', r.atrasada ? 'text-red-600' : 'text-slate-500')}>
            Entrega prometida: {dataCompleta(r.previsaoEntrega)}
            {r.atrasada && ' (atrasada)'}
          </p>
        )}

        {/* elevador: um carro por vez, e o tempo corre em hora */}
        <div className="border-t border-slate-200 pt-1">
          <Interruptor
            ativo={r.precisaElevador}
            onChange={(v) => marcarElevador.mutate(v)}
            rotulo="Precisa de elevador"
            descricao="Entra na fila do elevador; um carro sobe de cada vez."
          />

          {r.precisaElevador && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {elevadores.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Nenhum elevador cadastrado. Ajuste em Configurações › Capacidade.
                </p>
              ) : reservaAtual?.status === 'EM_USO' ? (
                <>
                  <span className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                    {reservaAtual.boxNome} · {reservaAtual.rotulo}
                  </span>
                  <Botao variante="secundario" onClick={() => descerElevador.mutate()}>
                    Descer
                  </Botao>
                </>
              ) : (
                <>
                  <Selecao
                    value={elevadorEscolhido}
                    onChange={(e) => setElevadorEscolhido(e.target.value)}
                    className="w-auto min-w-40"
                  >
                    <option value="">Escolha o elevador</option>
                    {elevadores.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome}
                      </option>
                    ))}
                  </Selecao>
                  <Botao
                    tamanho="toque"
                    onClick={() => subirElevador.mutate(elevadorEscolhido)}
                    disabled={!elevadorEscolhido}
                  >
                    Subir agora
                  </Botao>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </SecaoDaEtapa>
  ) : null

  /**
   * O que o carro ja contou: scanner e wiki. Etapa 2, que e quando se
   * descobre o que ele precisa -- e e para isso que esses dois servem.
   */
  const temContexto =
    (leiturasDoCarro.data ?? []).length > 0 || (wikiDoCarro.data ?? []).length > 0
  const secaoContexto = (
    <SecaoDaEtapa
      key="contexto"
      etapa={2}
      titulo="O que este carro ja contou"
      descricao={
        temContexto
          ? 'Leituras do scanner e o que a oficina ja resolveu em carro igual'
          : 'Ainda nao ha leitura de scanner nem artigo da wiki para este modelo'
      }
    >
      <div className="divide-y divide-slate-100">
      {(leiturasDoCarro.data ?? []).length === 0 ? (
        <div className="px-4 py-5">
          <p className="text-sm text-slate-500">Nenhuma leitura deste carro ainda.</p>
          {/* Link virou alvo de 44px: dentro do paragrafo ele tinha 37
              e era o unico da tela abaixo da regra -- e quem aperta
              esta de luva com o tablet na mao. */}
          <Link
            to="/leituras"
            className="mt-1 -ml-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-marca-600 transition hover:bg-slate-100 hover:underline"
          >
            Importar o PDF do scanner
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {leiturasDoCarro.data!.map((l) => (
            <Link
              key={l.id}
              to={`/leituras/${l.id}`}
              className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50"
            >
              <Etiqueta
                className={
                  l.tipo === 'OFICIAL'
                    ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                    : 'bg-amber-100 text-amber-800 ring-amber-200'
                }
              >
                {l.tipoDescricao}
              </Etiqueta>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                {l.condicao ?? l.modeloDescricao}
              </span>
              <span className="flex-none text-xs text-slate-500">
                {l.modulos} mód · {l.itens} itens
              </span>
            </Link>
          ))}
        </div>
      )}
      {/* Sem moldura de cartao: a seção da etapa já é a moldura. */}
      {(wikiDoCarro.data ?? []).length > 0 && (
        <div>
          <p className="bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            A oficina já viu isso neste modelo
          </p>
          {wikiDoCarro.data!.map((a) => (
            <Link key={a.id} to={`/wiki/${a.id}`} className="block px-4 py-2 hover:bg-slate-50">
              <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
              <p className="text-xs text-marca-700">{a.alcance}</p>
            </Link>
          ))}
        </div>
      )}
      </div>
    </SecaoDaEtapa>
  )

  /**
   * Registrar trabalho: etapa 6.
   *
   * E o registro do que esta sendo feito no carro -- nao cabe em quem ainda
   * nem comecou. O que e de UM servico continua saindo pelo "Anotar" da
   * linha dele; aqui fica o que e do carro inteiro.
   */
  const secaoRegistro = podeRegistrarTrabalho ? (
    <SecaoDaEtapa
      key="registro"
      etapa={6}
      titulo="Registrar trabalho"
      descricao="O que voce esta fazendo agora. Entra no historico do carro."
    >
      <RegistrarTrabalho os={os} semCartao />
    </SecaoDaEtapa>
  ) : null

  const TODAS_AS_SECOES = [
    { chave: 'recebimento', etapa: 1, no: secaoRecebimento },
    { chave: 'agenda', etapa: 1, no: secaoAgenda },
    { chave: 'contexto', etapa: 2, no: secaoContexto },
    { chave: 'registro', etapa: 6, no: secaoRegistro },
    { chave: 'servicos', etapa: etapaDoServico, no: secaoServicos },
    { chave: 'pecas', etapa: etapaDaPeca, no: secaoPecas },
    { chave: 'valores', etapa: etapaDosValores, no: secaoValores },
    { chave: 'fotos', etapa: etapaDasFotos, no: secaoFotos },
  ].filter((s) => s.no !== null)

  /**
   * Numa OS cancelada nao ha etapa corrente: mostra tudo.
   *
   * Esconder o que "nao e da etapa" so faz sentido quando existe um proximo
   * passo a destacar. Numa OS cancelada nao existe -- ela virou registro do
   * que ia ser feito, e esconder dois tercos do registro atras de uma gaveta
   * e esconder por esconder.
   */
  const cancelada = r.status === 'CANCELADO'
  const daEtapa = cancelada
    ? TODAS_AS_SECOES
    : TODAS_AS_SECOES.filter((s) => s.etapa === etapaAtual)
  const naEtapa = daEtapa.map((s) => s.no)
  const foraDaEtapa = cancelada
    ? null
    : TODAS_AS_SECOES.filter((s) => s.etapa !== etapaAtual).map((s) => s.no)
  const secoesNaTela = daEtapa.map((s) => s.chave)

  const acionar = (status: StatusOs) => {
    setErroAcao(undefined)
    if (status === 'PAUSADO' || status === 'CANCELADO') {
      setPausando(status)
      const padrao = motivos.data?.find((m) => m.categoria === 'PECA')
      setMotivoParadaId(padrao?.id ?? '')
      setParadaVisivel(padrao?.visivelClientePadrao ?? true)
      return
    }
    // Comecar o servico e o unico momento em que o cliente ganha uma data
    // nova. Perguntar aqui, uma vez, e o que o dono pediu -- e e menos
    // atrito que uma configuracao que ninguem lembra de mexer.
    if (status === 'EM_EXECUCAO') {
      setIniciandoExecucao(true)
      return
    }
    transicionar.mutate({ status })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      {/* ---------------- cabecalho ---------------- */}
      <div className="sem-impressao">
        <Link
          to="/quadro"
          className="-my-1 inline-flex min-h-11 items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar para o quadro
        </Link>
      </div>

      <div className="sem-impressao">
        <AjudaDaTela chave="os" titulo="Tudo no carro é um serviço">
          A régua no meio do cartão mostra em que etapa o carro está, e o botão grande é o próximo
          passo. Cada <strong>serviço</strong> tem os botões dele na linha: iniciar, pausar com o
          motivo, concluir, cancelar com o motivo — e <strong>Anotar</strong>, para registrar o
          que foi feito naquele serviço. O botão <strong>Compartilhar</strong> controla o que o
          cliente vê pelo link, item a item.
        </AjudaDaTela>
      </div>

      <Cartao className="p-4">
        {/*
          No celular isto virava uma coluna de uma palavra por linha.
          O carro (46px) + os dois botoes (~250px) comiam a largura e
          sobravam ~40px para placa, modelo e cliente: "Teste Etapa Um"
          descia em tres linhas e a placa saia cortada. Agora o bloco de
          identificacao ocupa a largura inteira do telefone e os botoes
          descem para baixo; do sm: para cima volta a ser lado a lado.
        */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <CarroTopo cor={r.cor} largura={46} titulo={r.veiculo} className="flex-none" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Placa placa={r.placa} tamanho="lg" />
              <Etiqueta className={cores.chip}>{r.statusDescricao}</Etiqueta>
              {r.prioridade !== 'NORMAL' && (
                <Etiqueta className={CORES_PRIORIDADE[r.prioridade]}>{r.prioridade}</Etiqueta>
              )}
              <span className="text-xs text-slate-500">OS #{r.numero}</span>
            </div>
            {/* Sem modelo cadastrado o servidor devolve a propria placa, e o
                cabecalho mostrava "ETA1P01" logo abaixo da placa ETA1P01. */}
            {r.veiculo !== r.placa && (
              <p className="mt-1 text-sm text-slate-700">{r.veiculo}</p>
            )}
            <p className="text-sm text-slate-500">
              {r.clienteNome}
              {r.clienteTelefone && ` · ${r.clienteTelefone}`}
            </p>
            {r.queixa && (
              <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
                <span className="font-medium">Relato do cliente: </span>
                {r.queixa}
              </p>
            )}
          </div>
          </div>

          <div className="flex flex-none flex-col gap-2 sem-impressao">
            {/* Duas colunas no celular, e nao tres.
                Em 375px os tres botoes dividiam 343px em fatias de 112px, e
                "O cliente vê" nao cabe em 112px: o rotulo quebrava em tres
                linhas, uma palavra por linha, dentro do botao verde. */}
            <div className="grid grid-cols-2 gap-2 [&_button]:whitespace-nowrap sm:flex sm:[&>*]:flex-none">
              {/* Sem `gerencia`: o mecânico decide o que vai para o link deste
                  carro. Ele é quem sabe se a foto do motor aberto ajuda ou
                  assusta. Com isso só na gerência, na prática ninguém mexia. */}
              {flag(CHAVES.compAtivo) && (
                <Botao
                  variante={r.compartilhado ? 'sucesso' : 'secundario'}
                  tamanho="toque"
                  bloco
                  onClick={() => setCompartilhando(true)}
                >
                  <Share2 className="size-4" aria-hidden />
                  {r.compartilhado ? 'O cliente vê' : 'Compartilhar'}
                </Botao>
              )}
              {/* Link e nao botao: a ficha e uma pagina, e quem quer conferir
                  antes de imprimir costuma abrir numa aba separada. */}
              <Link to={`/os/${r.id}/ficha`} className="flex-1 sm:flex-none">
                <Botao variante="secundario" tamanho="toque" bloco>
                  <Printer className="size-4" aria-hidden />
                  Ficha
                </Botao>
              </Link>
              {/* O que ja foi feito NESTE carro, nas outras vezes. E a
                  pergunta que o mecanico faz antes de abrir o capo. */}
              <Link to={`/veiculo/${r.veiculoId}/prontuario`} className="flex-1 sm:flex-none">
                <Botao variante="secundario" tamanho="toque" bloco>
                  <FileText className="size-4" aria-hidden />
                  Histórico
                </Botao>
              </Link>
            </div>

          </div>
        </div>

        {/* As ações do fluxo saíram daqui de cima e viraram a régua de etapas,
            logo abaixo: no canto elas pareciam um menu de opções, e o mecânico
            novo não sabia se aquilo era o caminho ou uma escolha. */}
        <div className="mt-4 sem-impressao">
          <EtapasDaOs
            status={r.status}
            etapaAtual={etapaAtual}
            proximos={os.proximosStatus.filter(
              (status) => status === 'CANCELADO' || podeAcionar(r.status, status, perfil),
            )}
            rotulo={rotuloDaAcao}
            salvando={transicionar.isPending}
            onAcionar={acionar}
            outrasEtapas={foraDaEtapa}
            outrasAbertas={verOutrasEtapas}
            onVerOutras={(aberta) => setGavetaAberta(aberta ? etapaAtual : null)}
            requisitos={
              <RequisitosDaEtapa
                os={os}
                secoesNaTela={secoesNaTela}
                onAdicionarServico={() => setAdicionandoServico(true)}
                onAdicionarPeca={() => setAdicionandoPeca(true)}
                onIrParaFotos={irParaFotos}
              />
            }
          >
            {naEtapa}
          </EtapasDaOs>
        </div>

        <AvisoErro mensagem={erroAcao} />

        {/* "Depois" nao pode virar "nunca": o aviso pendente fica visivel
            ate alguem mandar, e a data que vai para o cliente e a de HOJE,
            nao a de quando o carro realmente comecou. */}
        {os.avisoInicioPendente && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200 sem-impressao">
            <BellRing className="size-4 flex-none text-amber-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-amber-900">
              O cliente ainda não sabe que o serviço começou — e o acompanhamento dele não mostra a
              data de início.
            </p>
            <Botao
              variante="secundario"
              tamanho="toque"
              carregando={avisarInicio.isPending}
              onClick={() => avisarInicio.mutate()}
            >
              Avisar agora
            </Botao>
          </div>
        )}

        {/* indicadores rapidos */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-4">
          <Indicador rotulo="Na oficina" valor={diasTexto(r.diasNaOficina)} />
          <Indicador
            rotulo="Mão de obra"
            valor={`${horas(r.horasTrabalhadas)} / ${horas(r.horasEstimadas)}`}
            alerta={r.percentualExecutado > 110}
          />
          <Indicador
            rotulo="Sem movimento"
            valor={diasTexto(r.diasSemMovimentacao)}
            alerta={r.diasSemMovimentacao >= 3}
          />
          <Indicador
            rotulo={r.status === 'PRONTO_AGUARDANDO_RETIRADA' ? 'Aguardando retirada' : 'Parado'}
            valor={
              r.status === 'PRONTO_AGUARDANDO_RETIRADA'
                ? diasTexto(r.diasAguardandoRetirada)
                : horas(r.horasParado)
            }
            alerta={r.diasAguardandoRetirada >= 2}
          />
        </div>

        {r.paradaMotivo && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-orange-50 p-2.5 text-xs text-orange-800 ring-1 ring-orange-200">
            <PauseCircle className="mt-0.5 size-4 flex-none" aria-hidden />
            <span>
              <span className="font-medium">Parado: {r.paradaMotivo}.</span> O tempo continua
              contando no relatório de paradas até alguém retomar o serviço.
            </span>
          </div>
        )}
      </Cartao>

      {/* O que passou fica fechado: nenhum destes tres e campo de etapa
          nenhuma, e registro nao disputa o meio da tela com o proximo
          passo. Continua a um toque. */}
      <HistoricoDaOs os={os} />

      {/* ---------------- modais ---------------- */}
      <ModalMotivoServico
        acao={acaoServico?.acao ?? null}
        descricaoDoServico={acaoServico?.item.descricao ?? ''}
        semCronometro={acaoServico ? acaoServico.item.horasTrabalhadas === 0 : false}
        salvando={transicionarItem.isPending}
        erro={erroAcao}
        onFechar={() => {
          setAcaoServico(null)
          setErroAcao(undefined)
        }}
        onConfirmar={(corpo) =>
          acaoServico && transicionarItem.mutate({ itemId: acaoServico.item.id, corpo })
        }
      />

      <ModalAnotarServico
        servico={anotando}
        osId={id}
        onFechar={() => setAnotando(null)}
        onSalvo={(dados) => {
          queryClient.setQueryData(['os', id], dados)
          setAnotando(null)
          avisar('Trabalho anotado.')
        }}
      />

      <ModalCompartilhar
        aberto={compartilhando}
        onFechar={() => setCompartilhando(false)}
        os={os}
      />

      <Modal
        aberto={pausando !== null}
        onFechar={() => setPausando(null)}
        titulo={pausando === 'CANCELADO' ? 'Cancelar OS' : 'Pausar serviço'}
        descricao={
          pausando === 'CANCELADO'
            ? 'A OS sai do pátio e a vaga é liberada.'
            : 'O motivo vira métrica no painel do dono. É assim que você descobre o gargalo real.'
        }
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setPausando(null)}>
              Voltar
            </Botao>
            <Botao
              variante={pausando === 'CANCELADO' ? 'perigo' : 'primario'}
              carregando={transicionar.isPending}
              onClick={() =>
                transicionar.mutate({
                  status: pausando,
                  motivoParadaId: pausando === 'PAUSADO' ? motivoParadaId || undefined : undefined,
                  descricao: descricaoParada || undefined,
                  visivelCliente: paradaVisivel,
                })
              }
            >
              Confirmar
            </Botao>
          </>
        }
      >
        <div className="space-y-4">
          {pausando === 'PAUSADO' && (
            <Campo rotulo="Motivo da parada" obrigatorio={flag(CHAVES.exigirMotivoPausa)}>
              <Selecao
                value={motivoParadaId}
                onChange={(e) => {
                  setMotivoParadaId(e.target.value)
                  const m = motivos.data?.find((x) => x.id === e.target.value)
                  setParadaVisivel(m?.visivelClientePadrao ?? false)
                }}
              >
                <option value="">Selecione...</option>
                {(motivos.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} ({m.categoriaDescricao})
                  </option>
                ))}
              </Selecao>
            </Campo>
          )}

          <Campo
            rotulo={pausando === 'CANCELADO' ? 'Motivo do cancelamento' : 'Observação'}
            dica="Fica no histórico da OS"
          >
            <AreaTexto
              value={descricaoParada}
              onChange={(e) => setDescricaoParada(e.target.value)}
              placeholder={
                pausando === 'CANCELADO'
                  ? 'Ex.: cliente desistiu do orçamento.'
                  : 'Ex.: kit de embreagem em falta, fornecedor entrega quinta.'
              }
            />
          </Campo>

          {pausando === 'PAUSADO' && (
            <div className="rounded-lg bg-slate-50 px-3 ring-1 ring-slate-200">
              <Interruptor
                ativo={paradaVisivel}
                rotulo="Mostrar esta parada para o cliente"
                descricao="Se desligado, o dono vê o motivo mas o cliente não"
                onChange={setParadaVisivel}
              />
            </div>
          )}
        </div>
      </Modal>

      <ModalNovoServico
        aberto={adicionandoServico}
        onFechar={() => setAdicionandoServico(false)}
        osId={id}
        onSalvo={(dados) => {
          queryClient.setQueryData(['os', id], dados)
          invalidar()
          setAdicionandoServico(false)
          avisar('Serviço adicionado.')
        }}
      />

      <Modal
        aberto={iniciandoExecucao}
        onFechar={() => setIniciandoExecucao(false)}
        titulo="Começar o serviço"
        descricao="O cliente fica sabendo agora, ou depois?"
        rodape={
          <>
            <Botao
              variante="secundario"
              tamanho="toque"
              carregando={transicionar.isPending}
              onClick={() => {
                setIniciandoExecucao(false)
                transicionar.mutate({ status: 'EM_EXECUCAO', avisarCliente: false })
              }}
            >
              Depois
            </Botao>
            <Botao
              tamanho="toque"
              carregando={transicionar.isPending}
              onClick={() => {
                setIniciandoExecucao(false)
                transicionar.mutate({ status: 'EM_EXECUCAO', avisarCliente: true })
              }}
            >
              Avisar agora
            </Botao>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Escolhendo <strong>depois</strong>, o carro começa normalmente aqui dentro, mas o
          acompanhamento do cliente <strong>não mostra a data em que o serviço começou</strong> —
          e o aviso fica pendente nesta tela até alguém mandar.
        </p>
      </Modal>

      <ModalOrcamento
        aberto={mandandoOrcamento}
        onFechar={() => setMandandoOrcamento(false)}
        os={os}
      />

      <ModalNovaPeca
        aberto={adicionandoPeca}
        onFechar={() => setAdicionandoPeca(false)}
        osId={id}
        mostraValores={mostraValores}
        onSalvo={() => {
          invalidar()
          setAdicionandoPeca(false)
          avisar('Peça registrada.')
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------------ auxiliares

function Indicador({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string
  valor: string
  alerta?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className={cx('text-sm font-semibold', alerta ? 'text-red-600' : 'text-slate-800')}>
        {valor}
      </p>
    </div>
  )
}

/**
 * A etapa de precificar: mao de obra e desconto.
 *
 * Ate aqui este cartao era so leitura, e NENHUMA tela do sistema escrevia
 * valorMaoObra ou desconto -- o endpoint existia e nada o chamava. Na
 * pratica o valor so podia vir do catalogo, e a "mao de obra manual" que o
 * dono pediu nao tinha onde acontecer.
 *
 * O cartao muda de forma conforme a configuracao:
 * - MANUAL: campo para digitar o valor fechado do servico.
 * - AUTOMATICA: o valor e a soma dos servicos e aparece so para leitura,
 *   com o caminho para mexer onde ele e de verdade -- na linha do servico.
 */
function CartaoValores({
  os,
  osId,
  onSalvo,
  onMandarOrcamento,
}: {
  os: DetalheTipo
  osId: string
  onSalvo: () => void
  onMandarOrcamento: () => void
}) {
  const { gerencia } = useAuth()
  const { texto, numero } = useConfig()
  const avisar = useAviso()
  const automatica = texto(CHAVES.modoMaoDeObra, 'MANUAL') === 'AUTOMATICA'
  const tetoDesconto = numero(CHAVES.descontoMaximo, 0)

  const [editando, setEditando] = useState(false)
  const [maoObra, setMaoObra] = useState('')
  const [desconto, setDesconto] = useState('')
  const [erro, setErro] = useState<string>()

  const abrir = () => {
    setMaoObra(os.valorMaoObra ? String(os.valorMaoObra) : '')
    setDesconto(os.desconto ? String(os.desconto) : '')
    setErro(undefined)
    setEditando(true)
  }

  const salvar = useMutation({
    mutationFn: () =>
      api(`/os/${osId}`, {
        metodo: 'PATCH',
        corpo: {
          valorMaoObra: automatica ? undefined : maoObra === '' ? 0 : Number(maoObra),
          desconto: desconto === '' ? 0 : Number(desconto),
        },
      }),
    onSuccess: () => {
      setEditando(false)
      onSalvo()
      avisar('Valores salvos.')
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  // O desconto que ESTA pessoa pode dar, para o limite aparecer antes do
  // erro em vez de depois. Dono e gerente nao tem teto.
  const subtotal = (os.valorPecas ?? 0) + (os.valorMaoObra ?? 0)
  const limite = gerencia ? null : Math.round(subtotal * tetoDesconto) / 100

  return (
    // Sem `Cartao`: a seção da etapa já é a moldura, e cartão dentro de
    // cartão come 32px de largura útil no celular — só de margem.
    <>
      {!editando && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
          {automatica && (
            <p className="text-xs text-slate-500">A mão de obra é a soma dos serviços</p>
          )}
          <Botao variante="secundario" tamanho="toque" className="ml-auto" onClick={abrir}>
            <Pencil className="size-4" aria-hidden />
            {automatica ? 'Desconto' : 'Preços'}
          </Botao>
        </div>
      )}

      {editando ? (
        <div className="space-y-3 p-4">
          {automatica ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 ring-1 ring-slate-200">
              A mão de obra sai da tabela de serviços ({moeda(os.valorMaoObra)}). Para mudar, ajuste
              o preço na linha do serviço — ou troque para “Digitado” em Configurações &gt; Fluxo.
            </p>
          ) : (
            <Campo rotulo="Mão de obra (R$)" dica="O valor fechado do serviço, sem as peças.">
              <Entrada
                autoFocus
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={maoObra}
                onChange={(e) => setMaoObra(e.target.value)}
              />
            </Campo>
          )}

          <Campo
            rotulo="Desconto (R$)"
            dica={
              limite === null
                ? 'Sem limite para o seu perfil.'
                : limite > 0
                  ? `Você pode dar até ${moeda(limite)} nesta OS (${tetoDesconto}%). Acima disso, chame o dono.`
                  : 'Desconto neste sistema é com o dono.'
            }
          >
            <Entrada
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              disabled={limite !== null && limite <= 0}
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
            />
          </Campo>

          <AvisoErro mensagem={erro} />

          <div className="flex gap-2">
            <Botao variante="secundario" tamanho="toque" bloco onClick={() => setEditando(false)}>
              Cancelar
            </Botao>
            <Botao tamanho="toque" bloco carregando={salvar.isPending} onClick={() => salvar.mutate()}>
              Salvar
            </Botao>
          </div>
        </div>
      ) : (
        <dl className="divide-y divide-slate-100 px-4 py-2 text-sm">
          <Linha rotulo="Peças" valor={moeda(os.valorPecas)} />
          <Linha rotulo="Mão de obra" valor={moeda(os.valorMaoObra)} />
          {(os.desconto ?? 0) > 0 && (
            <Linha rotulo="Desconto" valor={`- ${moeda(os.desconto)}`} />
          )}
          <Linha rotulo="Total" valor={moeda(os.valorTotal)} destaque />
          {/* O que o cliente aprovou, congelado. Se o total mudou depois, os
              dois numeros aparecem e a diferenca fica visivel -- que e
              exatamente a conversa dificil de seis meses depois. */}
          {os.valorAprovado != null && os.valorAprovado !== os.valorTotal && (
            <Linha rotulo="Cliente aprovou" valor={moeda(os.valorAprovado)} />
          )}
        </dl>
      )}

      {/* O caminho curto para o cliente. A Ficha existe e e papel -- serve
          para imprimir e assinar; isto aqui e o que acontece de verdade:
          alguem pega o celular e manda no WhatsApp. So aparece quando ha
          algum valor, porque mandar orcamento zerado e so constrangimento. */}
      {!editando && (os.valorTotal ?? 0) > 0 && (
        <div className="border-t border-slate-200 p-3">
          <Botao variante="tonal" tamanho="toque" bloco onClick={onMandarOrcamento}>
            <Send className="size-4" aria-hidden />
            Mandar o orçamento ao cliente
          </Botao>
        </div>
      )}
    </>
  )
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className={cx('text-xs', destaque ? 'font-semibold text-slate-800' : 'text-slate-500')}>
        {rotulo}
      </dt>
      <dd className={cx(destaque ? 'text-sm font-semibold text-slate-900' : 'text-xs text-slate-700')}>
        {valor}
      </dd>
    </div>
  )
}

function ModalNovoServico({
  aberto,
  onFechar,
  osId,
  onSalvo,
}: {
  aberto: boolean
  onFechar: () => void
  osId: string
  onSalvo: (dados: DetalheTipo) => void
}) {
  const [catalogoId, setCatalogoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [horasEstimadas, setHorasEstimadas] = useState('1')
  const [erro, setErro] = useState<string>()

  const catalogo = useQuery({
    queryKey: ['catalogo', true],
    queryFn: () => api<ServicoCatalogo[]>('/catalogo-servicos?apenasAtivos=true'),
    enabled: aberto,
  })

  const salvar = useMutation({
    mutationFn: () =>
      api<DetalheTipo>(`/os/${osId}/itens`, {
        metodo: 'POST',
        corpo: {
          catalogoServicoId: catalogoId || undefined,
          descricao: descricao || undefined,
          horasEstimadas: Number(horasEstimadas),
        },
      }),
    onSuccess: (dados) => {
      setCatalogoId('')
      setDescricao('')
      setHorasEstimadas('1')
      onSalvo(dados)
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Adicionar serviço"
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Adicionar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Do catálogo" dica="Traz o tempo padrão e o preço sugerido">
          <Selecao
            value={catalogoId}
            onChange={(e) => {
              setCatalogoId(e.target.value)
              const escolhido = catalogo.data?.find((c) => c.id === e.target.value)
              if (escolhido) setHorasEstimadas(String(escolhido.horasPadrao))
            }}
          >
            <option value="">Serviço avulso</option>
            {(catalogo.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao} ({c.horasPadrao}h)
              </option>
            ))}
          </Selecao>
        </Campo>

        {!catalogoId && (
          <Campo rotulo="Descrição do serviço" obrigatorio>
            <Entrada
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: soldar suporte do escapamento"
            />
          </Campo>
        )}

        <Campo rotulo="Horas estimadas" obrigatorio>
          <Entrada
            type="number"
            step="0.25"
            min="0.25"
            value={horasEstimadas}
            onChange={(e) => setHorasEstimadas(e.target.value)}
          />
        </Campo>

        <AvisoErro mensagem={erro} />
      </div>
    </Modal>
  )
}

function ModalNovaPeca({
  aberto,
  onFechar,
  osId,
  onSalvo,
  mostraValores,
}: {
  aberto: boolean
  onFechar: () => void
  osId: string
  onSalvo: () => void
  /**
   * Quem nao ve preco na tela tambem nao digita preco aqui.
   *
   * Este e o MESMO formulario em que o mecanico registra a peca, e ele
   * pedia "Valor unitario (R$)" e "Fornecedor" para todo mundo -- ou seja,
   * o sistema dizia "o mecanico nao ve valores" e logo em seguida mandava
   * ele chutar um. Cotar e ligar para fornecedor e trabalho do balcao.
   */
  mostraValores: boolean
}) {
  const [descricao, setDescricao] = useState('')
  const [doCatalogo, setDoCatalogo] = useState<PecaCatalogo | null>(null)
  const [quantidade, setQuantidade] = useState('1')
  const [fornecedor, setFornecedor] = useState('')
  const [origem, setOrigem] = useState<OrigemPeca>('COMPRAR')
  const [momento, setMomento] = useState<MomentoPeca>('DURANTE')
  const [previsao, setPrevisao] = useState('')
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string>()

  /**
   * Escolher do catálogo responde três perguntas de uma vez.
   *
   * Tem na prateleira → é peça de estoque, e o preço já é conhecido. Não tem
   * → é compra, por mais que esteja cadastrada. Deixar o mecânico responder
   * "temos aqui" na mão quando o saldo diz zero seria manter o problema que
   * o catálogo veio resolver.
   */
  function escolherDoCatalogo(peca: PecaCatalogo | null) {
    setDoCatalogo(peca)
    if (!peca) return
    setOrigem(peca.temEstoque ? 'ESTOQUE' : 'COMPRAR')
    if (peca.valorSugerido != null) setValor(String(peca.valorSugerido))
  }

  const salvar = useMutation({
    mutationFn: () =>
      api(`/os/${osId}/pecas`, {
        metodo: 'POST',
        corpo: {
          descricao,
          quantidade: Number(quantidade),
          // O vínculo com o catálogo é o que faz a baixa de estoque acontecer
          // e o que deixa a próxima vez ser só escolher da lista.
          pecaCatalogoId: doCatalogo?.id,
          // Situação não é pergunta para o mecânico: "temos aqui" já chegou,
          // "precisa comprar" nasce solicitada. Quem decide é o servidor.
          origem,
          // "Quando faz falta" so existe para peca que alguem vai buscar:
          // a da prateleira ja esta aqui, nao tem prazo e nao entra na fila.
          momentoNecessario: origem === 'COMPRAR' ? momento : undefined,
          // Peça de estoque já está aqui: o servidor força RECEBIDA, e mandar
          // fornecedor ou previsão dela seria guardar dado que não existe.
          fornecedor: origem === 'COMPRAR' ? fornecedor || undefined : undefined,
          previsaoChegada: origem === 'COMPRAR' ? previsao || undefined : undefined,
          valorUnitario: valor ? Number(valor) : undefined,
        },
      }),
    onSuccess: () => {
      setDescricao('')
      setDoCatalogo(null)
      setQuantidade('1')
      setFornecedor('')
      setPrevisao('')
      setValor('')
      // A origem volta para "precisa comprar" a cada peça registrada.
      //
      // Manter a última escolha pareceria comodidade, mas os dois erros não
      // custam igual: peça de estoque marcada como compra aparece na fila e
      // alguém corrige; peça de compra marcada como estoque não aparece em
      // lugar nenhum, e o carro fica esperando uma peça que ninguém comprou.
      setOrigem('COMPRAR')
      setMomento('DURANTE')
      onSalvo()
    },
    onError: (falha: Error) => setErro(falha.message),
  })

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Registrar peça"
      descricao="Com a previsão de chegada, o quadro mostra até quando o carro fica esperando."
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>
            Registrar
          </Botao>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo
            rotulo="Peça"
            obrigatorio
            dica={
              doCatalogo
                ? undefined
                : 'Digite para procurar no catálogo. O que não estiver lá vira pedido de compra.'
            }
          >
            <BuscaPeca
              descricao={descricao}
              onDescricao={setDescricao}
              onEscolher={escolherDoCatalogo}
              escolhida={doCatalogo}
              mostraValores={mostraValores}
            />
          </Campo>
        </div>

        {/*
            "Temos aqui ou precisa comprar" NAO e pergunta para o mecanico.
            Quem sabe o que tem na prateleira e quem cuida da prateleira: o
            balcao. O mecanico esta de pe ao lado do carro e sabe uma coisa
            so, que e o que ele responde aqui -- de que peca o carro precisa.
            Quando ele escolhe do catalogo, o proprio saldo ja responde; e
            quando digita livre, nasce como compra, que e o erro barato: peca
            de estoque marcada como compra aparece na fila e alguem corrige,
            o contrario fica invisivel e o carro espera uma peca que ninguem
            comprou.

            Em botao e nao em combo porque isto e preenchido de pe, no
            celular -- vale para quem ainda ve este campo. */}
        <div className={cx('sm:col-span-2', !mostraValores && 'hidden')}>
          <Campo rotulo="Esta peça" obrigatorio>
            <EscolhaDupla
              valor={origem}
              onEscolher={setOrigem}
              opcoes={[
                { valor: 'ESTOQUE', rotulo: 'Temos aqui' },
                { valor: 'COMPRAR', rotulo: 'Precisa comprar' },
              ]}
            />
          </Campo>
        </div>

        {/* "Quando faz falta" só é pergunta para peça que alguém vai
            buscar. Para a que já está na prateleira a resposta não existe,
            e pergunta cuja resposta o sistema joga fora é clique à toa. */}
        {origem === 'COMPRAR' && mostraValores && (
          <div className="sm:col-span-2">
            <Campo
              rotulo="Faz falta"
              dica={
                momento === 'INICIO'
                  ? 'Sem ela o serviço não começa — o prazo passa a ser o dia agendado do carro.'
                  : 'Dá para começar sem ela; precisa chegar antes de o carro sair.'
              }
            >
              <EscolhaDupla
                valor={momento}
                onEscolher={setMomento}
                opcoes={[
                  { valor: 'INICIO', rotulo: 'Para começar' },
                  { valor: 'DURANTE', rotulo: 'Antes de terminar' },
                ]}
              />
            </Campo>
          </div>
        )}

        <Campo rotulo="Quantidade">
          <Entrada
            type="number"
            step="0.5"
            min="0.5"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </Campo>
        {mostraValores && (
          <Campo rotulo="Valor unitário (R$)" dica="Entra no orçamento do cliente.">
            <Entrada
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Campo>
        )}

        {/* Fornecedor e previsão só existem para peça que alguém vai comprar.
            Peça que já está na prateleira não tem fornecedor a cobrar. */}
        {origem === 'COMPRAR' && mostraValores && (
          <>
            <Campo rotulo="Fornecedor">
              <Entrada value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
            </Campo>
            <Campo rotulo="Fornecedor prometeu para" dica="Comparado com o prazo do carro.">
              <Entrada type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
            </Campo>
          </>
        )}

        {origem === 'COMPRAR' && !mostraValores && (
          <p className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 ring-1 ring-slate-200">
            Preço, fornecedor e prazo quem resolve é o balcão. Você só diz o que o carro precisa —
            a peça entra na lista de compras assim que você salvar.
          </p>
        )}

        <div className="sm:col-span-2">
          <AvisoErro mensagem={erro} />
        </div>
      </div>
    </Modal>
  )
}

/**
 * Duas opções em botão, não em combo.
 *
 * Combo de duas opções é pior em tudo: esconde a segunda até você abrir,
 * pede mira fina e some o rótulo depois de escolher. Isto aqui é preenchido
 * de pé na oficina, muitas vezes no celular, com o carro na frente — e nessa
 * situação alvo grande vale mais que economia de espaço.
 */
function EscolhaDupla<T extends string>({
  valor,
  onEscolher,
  opcoes,
}: {
  valor: T
  onEscolher: (v: T) => void
  opcoes: { valor: T; rotulo: string }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onEscolher(o.valor)}
          className={cx(
            'rounded-lg px-3 py-2.5 text-sm font-medium ring-1 transition',
            valor === o.valor
              ? 'bg-marca-600 text-white ring-marca-600'
              : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
