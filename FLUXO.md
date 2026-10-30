# O fluxo das etapas, por quem faz

Este documento é o combinado do fluxo de uma OS, ditado pelo dono em
30/10/2026. Ele existe porque a mudança não é de tela: é de **dono de cada
etapa**. A mesma OS passa pela mão do mecânico, da secretária e do dono da
oficina, e cada um só pode ver e preencher o que é dele.

A régua de etapas **não muda de ordem**. Ganha uma etapa nova (agendar a
execução, depois da aprovação) e passa de sete para oito.

| # | Etapa | Quem faz | O que decide |
|---|---|---|---|
| 1 | Recebimento | atendente | o carro entrou, a vaga e o dia |
| 2 | Peças e serviços | **mecânico** | o que o carro precisa — **sem preço** |
| 3 | Cotação | **secretária** | quanto custa cada peça, e se compra ou já tem |
| 4 | Mão de obra | **secretária** | o valor que o dono ditou |
| 5 | Aprovação | **secretária** | manda pro cliente e registra o aceite |
| 6 | Agendar execução | **secretária** | que dia o carro vai ser feito, de verdade |
| 7 | Serviço | **mecânico** | executa, registra e acompanha |
| 8 | Entrega | atendente | devolve o carro |

---

## Etapa 2 — Peças e serviços (mecânico)

O mecânico diz **o que o carro precisa**. Ele não fala de dinheiro e não fala
de estoque.

- Adiciona **serviços** — sem valor. O valor da mão de obra é da etapa 4.
- Adiciona **peças** — só o nome.
- **Sai da mão dele** a escolha entre "comprar" e "já tem aqui". Quem sabe o
  que tem na prateleira é a secretária, e ela decide na etapa 3.

**Peça parecida, na hora de digitar.** Quando ele escrever o nome de uma peça,
o sistema procura no cadastro e avisa antes de criar outra: *"já existe uma
peça parecida com essa"*, com a lista do que achou e a opção de usar a que já
existe. É isso que impede o cadastro de encher de "pastilha de freio",
"pastilha freio" e "past. de freio" como se fossem três coisas.

## Etapa 3 — Cotação (secretária, só no desktop)

Ela trabalha no notebook, ligando para fornecedor. Esta tela é **de desktop**;
no celular ela não aparece.

- Lista das peças da OS, **numeradas**, uma linha por peça — o número é o que
  ela usa para não se perder no meio da ligação.
- Para cada peça ela registra **vários orçamentos**: fornecedor, preço, e
  marca **qual escolheu**. O que não foi escolhido fica guardado, porque é
  disso que sai a conversa da próxima compra.
- É aqui que ela marca **comprar** ou **já tem aqui**.
- Tem um campo de mão de obra à vista, mas **não é ela quem preenche** — é a
  etapa seguinte.

**Cadastro novo: Fornecedores.** Em lugar próprio, no menu, igual ao catálogo
de serviços. Nome, telefone, o que costuma vender. É dele que sai a lista na
hora de cotar.

## Etapa 4 — Mão de obra (secretária)

Manual, e de propósito. Ela chama o dono da oficina, ele diz o valor, ela
digita e conclui. O sistema não calcula nada aqui.

## Etapa 5 — Aprovação (secretária)

O momento de mandar o orçamento para o cliente.

- Um **resumo** da OS: peças com preço, serviços, mão de obra, total.
- Ela vê o **texto que vai ser enviado** e pode editar o **começo**, o **meio**
  e o **fim** — o corpo com os valores o sistema monta.
- **Enviar** abre o WhatsApp dela com o texto pronto, do número da oficina.
  Se o carro não tiver telefone cadastrado, o campo abre ali mesmo para ela
  digitar antes.
- Depois de enviar, a OS fica **pendente de aprovação**.
- Quando o cliente responde, **ela confirma na mão**. O sistema não adivinha
  resposta de WhatsApp.

**Dois botões, e só.** Enviar e concluir. Nada espalhado pelos cantos.

## Etapa 6 — Agendar execução (secretária) — NOVA

Aprovar não é começar. O cliente pode ter demorado a responder e outro carro
já entrou na frente.

- Mostra os dias disponíveis.
- Dá pra fazer hoje? Confirma. Não dá? Remarca.

Depois disso o carro está **liberado para o mecânico**.

## Etapa 7 — Serviço (mecânico)

Tela grande, e **só com o que é desta etapa**. Nada do que pertence a outra.

- **Iniciar** pega o **usuário logado** — ninguém escolhe mecânico numa lista.
- Respeita a peça: o que precisa chegar para começar e o que só é preciso no
  fim continua valendo.
- Ele registra **anotação** e **foto** enquanto trabalha.
- **Link de acompanhamento para o cliente**, e é **ele quem decide o que o
  cliente vê**: horário, anotação, foto — cada um liga e desliga.
- Ao **concluir**, sai a mensagem de *carro pronto para retirada* — pelo mesmo
  caminho do orçamento: abre o WhatsApp com o texto pronto.

---

## Decisões já tomadas

**WhatsApp é por link, não por API.** O botão abre o WhatsApp da secretária
com o texto montado, e ela envia do número da oficina. Custo zero e funciona
hoje. A API oficial da Meta enviaria sozinha, mas cobra por conversa, exige
número dedicado e aprovação de modelo de mensagem — fica para depois, se o
volume justificar. Consequência: **nenhum envio é automático**, nem o "pronto
para retirada". Sempre tem um clique humano no meio.

**Cotação guarda o histórico.** Vários preços por peça, com o escolhido
marcado. Custa uma tela mais densa e paga em poder de negociação.

**Agendar execução é etapa própria.** Mexe na numeração de todas as telas que
falam em etapa, mas aparece na régua — e o dono quer ver na régua que o carro
aprovado ainda não tem dia.

## Direção visual

O dono recusou a primeira tentativa de pátio em 3D com estas palavras:
*"infantil, colorido, parece brinquedo"*. Vale para tudo que vier:

- pouca cor, e cor com significado — não decoração;
- material fosco, sombra curta, contorno fino;
- informação na frente do enfeite;
- sério, moderno, sofisticado. Isto aqui é ferramenta de trabalho.
