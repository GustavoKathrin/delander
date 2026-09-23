# Delander · Auto Car

Controle de pátio, agenda e produtividade para oficina mecânica.

O problema que ele resolve não é "falta mecânico" — é **fluxo**: carro entra, ocupa espaço
e não sai. O sistema mede a diferença entre **permanência** (dias que o carro fica na
oficina) e **mão de obra** (horas de trabalho que ele realmente recebeu), mostra por que
cada carro está parado e diz quando há folga para aceitar o próximo.

---

## Como subir

**Pré-requisito:** Docker Desktop aberto (o engine precisa estar rodando).

```bash
docker compose up --build
```

| O que | Onde |
|---|---|
| Sistema (front) | http://localhost:5175 |
| API | http://localhost:8081 |
| Documentação da API (Swagger) | http://localhost:8081/swagger-ui |
| Banco (PostgreSQL) | localhost:5434 |

> **Por que essas portas.** As padrão (5173, 8080, 5432) estão ocupadas por outro projeto
> nesta máquina, então o `.env` deste projeto move as do Delander com `WEB_PORT`, `API_PORT`
> e `POSTGRES_PORT`. Em outra máquina, apague essas linhas do `.env` e ele volta para
> 5173/8080/5432. Os containers conversam entre si pela rede do compose, então só o acesso
> pelo navegador muda.

Para parar: `docker compose down`. Para apagar também o banco: `docker compose down -v`.

### Acessos de demonstração

O primeiro start cria o dono e, com `APP_CARGA_DEMO=true` (padrão), carrega uma oficina
de exemplo com 12 veículos e o quadro da semana já preenchido.

| Perfil | E-mail | Senha |
|---|---|---|
| Dono | `dono@oficina.local` | `123` |
| Mecânico (motor/câmbio) | `carlos@oficina.local` | `123` |
| Mecânico (elétrica/ar) | `rafael@oficina.local` | `123` |
| Mecânico (suspensão/freios) | `bruno@oficina.local` | `123` |

> **Antes de usar de verdade:** a demonstração roda com `APP_SENHA_MINIMA=3` só para
> permitir a senha `123`. Em produção, copie `.env.example` para `.env`, **remova**
> `APP_SENHA_MINIMA` (o padrão volta a 8), troque `APP_JWT_SECRET` por um segredo
> aleatório de 64+ caracteres, troque a senha do dono e coloque `APP_CARGA_DEMO=false`.

### Rodando sem Docker (desenvolvimento)

```bash
# 1. banco
docker compose up -d db

# 2. backend (usa o Maven Wrapper; nao precisa instalar Maven)
cd backend && ./mvnw spring-boot:run

# 3. front
cd frontend && npm install && npm run dev
```

---

## O que o sistema faz

### Quadro da semana (tela inicial do dono)
Colunas por dia, cards por carro. Cada card mostra placa, veículo, cliente, mecânico,
barra de **estimado × realizado** e os alertas do carro. No topo de cada dia, um
**semáforo de capacidade**: verde até 74%, amarelo até 99%, vermelho quando o dia está
cheio. Arrastar um card muda o dia. A primeira coluna é a **fila de entrada** — carros
sem dia definido, com o total de horas de trabalho parado ali.

A capacidade do dia é o **limite mais restritivo** entre três coisas, e cada uma pode ser
ligada ou desligada em Configurações:
1. horas de mão de obra (soma da jornada dos funcionários ativos);
2. vagas físicas (boxes ativos);
3. teto de carros por dia / semana / mês.

### Pátio (a planta da oficina)
A oficina vista de cima: cada vaga é um card com o **carro desenhado na cor dele**, a placa, o
mecânico e quando libera. Arrastar um carro da fila para uma vaga **agenda**. Clicar no carro
abre a OS — é lá que está tudo que foi feito.

- **Elevador em destaque**: anel e cabeçalho na cor de destaque, além do desenho próprio. É o
  recurso mais disputado da oficina e não podia ter a mesma moldura de um box comum.
- **Mais carro, menos card**: o botão *Detalhado / Visual* engorda o desenho e some com o texto
  secundário. A tarja vermelha de alerta crítico **nunca** some. A escolha fica no navegador de
  quem olha (a TV pendurada na oficina e a mesa do dono querem coisas diferentes).
- **Cadeado**: abrir o cadeado deixa **arrastar as vagas** e **esticar** um card para ocupar
  mais colunas ou linhas — inclusive onde ficam os elevadores. É a planta da oficina, salva
  para todo mundo, não uma preferência de quem mexeu.
  - Com o cadeado aberto, arrastar carro não agenda nada; com ele fechado, vaga não se move.
    São dois tipos de arrasto separados de propósito.
  - Duas vagas no mesmo lugar são recusadas **pelo servidor** (409, nomeando as duas), não só
    pela tela.
  - *Voltar ao automático* apaga a planta e a grade volta a se arrumar sozinha — que é o estado
    de quem nunca abriu o cadeado.
  - Abaixo de 1024px a planta é ignorada e o cadeado some: layout de 6 colunas não cabe no
    celular.

**Agendar em uma tela, em duas etapas.** O botão AGENDAR CARRO abre um painel que responde
"quando dá?" sem sair da conversa com o cliente: no topo, a frase para ler ao telefone
(*"Pátio 5 de 7 livres · elevador livre agora"*).

- **Etapa 1 — cliente e carro.** Na oficina o carro quase sempre **nasce neste momento**: o
  cliente liga, nunca esteve antes. Então cadastrar é um caminho de primeira classe, sempre
  visível, e não algo que só aparece se você digitar algo parecido com placa. Placa, nome e
  telefone bastam; marca, modelo, ano e cor entram aqui ou depois. A placa é editável no
  próprio formulário — errar uma letra não faz voltar. Carro que já existe continua a um
  clique pela busca por placa ou por nome.
  - A **marca é escolhida numa lista**, não digitada: "honda", "HONDA" e "Hnoda" viravam três
    marcas diferentes na hora de achar a leitura de um Civic. A lista é da oficina
    (*Configurações › Cadastros › Marcas de veículo*), e **"Outra marca…"** continua aceitando
    o que não está nela — moto, caminhão, importado. Oficina que recusa um carro porque a
    marca não estava no combo é uma oficina pior.
- **Etapa 2 — serviço e dia.** O que o cliente falou, os serviços (com tempo e preço, que
  viram o orçamento), as **próximas 4 semanas dia a dia** com o número de vagas livres em cada
  um — cor nunca decide sozinha, dia cheio escreve "cheio" em vez de um número que a
  contradiga, e dia fechado não é clicável. Clicar num dia já escolhe a data. Os chips de
  sugestão continuam abaixo: eles respondem "onde cabe *este* serviço", a faixa responde "como
  está o mês".

O botão do rodapé diz o que falta em vez de ficar apagado em silêncio ("Falta a placa e o nome
do cliente"), e o mês aparece já na abertura, antes da placa — porque a pergunta do telefone
vem antes do cadastro.

### Elevador
O elevador é o único recurso que corre em **hora**, não em dia. A vaga é ocupada por dia —
o carro dorme na oficina — mas um alinhamento de 1h não pode travar o elevador das 8h às 18h.
Por isso o elevador tem **reserva com horário e duração**, e o pátio mostra *"desce em 1h20"*
em vez de *"ocupado hoje"*.

- **Quantos elevadores a oficina tem** é um parâmetro em Configurações › Capacidade. Aumentar
  cria as vagas `Elevador N` na planta; diminuir só desativa elevador **vazio** — com carro em
  cima o sistema recusa nomeando a placa, e o parâmetro nem chega a ser salvo.
- **Um carro por elevador de cada vez**, garantido por índice único no banco
  (`uk_elevador_em_uso`), não por checagem no código.
- Quem precisa de elevador entra na **fila do elevador**, com o horário previsto de subida e
  em qual elevador. A marcação vem sozinha dos serviços do catálogo marcados como
  `exige elevador` (alinhamento, embreagem, amortecedores…), e é editável.
- No agendamento dá para **vincular o carro direto a um elevador**, com horário e duração, já
  vendo quem está na frente.
- O selo ▲ aparece no card do pátio, no quadro da semana e na task do mecânico.

Elevador levantado **sempre** implica vaga ocupada: subir um carro aloca a OS naquele box na
mesma transação. É essa amarração que impede a agenda do elevador de discordar da planta.

### Leituras do scanner (menu Conhecimento)
Achar o valor de MAP, MAF ou ECT de um Civic 2014 deixava de exigir plugar o scanner de novo.
O relatório em PDF do Autel é importado e vira tabela.

**Importar → conferir → salvar.** O parse **não grava nada**: devolve um rascunho editável, e a
leitura só nasce quando alguém confere e informa o que o PDF não diz — **motor ligado**,
**ignição**, e se aquela é a leitura boa do carro (**oficial**) ou uma **anomalia** com nome
("carro com problema no frio"). Inventar esses campos envenenaria justamente o dado que a
ferramenta existe para guardar. Dá para digitar uma leitura inteira à mão também.

- Uma leitura tem **vários módulos** (PGM-FI, ABS…), cada um com a lista de itens. O módulo sai
  sozinho da linha `Caminho:` do relatório.
- Cada exportação do Autel traz um módulo, então importar o segundo PDF do mesmo carro oferece
  **anexar à leitura existente** em vez de criar outra.
- **Um carro tem no máximo uma leitura oficial**, garantido por índice único no banco. Promover
  uma anomalia rebaixa a anterior na mesma transação.
- A leitura fica ligada ao **carro (placa)** e ao **modelo** (marca/modelo/ano/motor soltos):
  buscar "Civic 2014" acha a leitura mesmo partindo de outro carro.
- Abrir a OS de um carro mostra **as leituras dele**; dentro de uma anomalia, *Comparar com a
  oficial* põe lado a lado o valor de agora e o valor de quando o carro estava bom.
- O mesmo relatório não entra duas vezes (índice único no número do relatório).

**Privacidade.** O relatório traz VIN, nome e telefone do cliente e o número de série do
aparelho. Nada disso é guardado — **não existe coluna para eles**, e um teste automatizado falha
se alguém adicionar uma. O que fica: placa, marca/modelo/ano, km, ferramenta e versão, data do
teste, e o PDF original com acesso controlado.

> **Limite conhecido:** o parser foi calibrado contra o texto do relatório e é validado por 15
> testes, incluindo um que monta um PDF de verdade e o lê de volta. Ele ainda **não foi rodado
> contra um PDF original do aparelho** — o espaçamento real das colunas pode pedir ajuste. Por
> isso a tela de conferência existe: erro de leitura é visível e corrigível antes de gravar.

**A lista é por modelo, não por arquivo.** "HONDA CIVIC 2014" é um cartão; dentro dele a
**oficial em destaque** e embaixo as outras leituras daquele modelo, cada uma com a sua
condição. Modelo sem oficial diz isso na cara — é a informação que falta, e ela vale ser dita.

#### Entrada por e-mail (Configurações › E-mail)

O tablet do scanner manda o relatório para uma caixa da oficina e o sistema busca sozinho.
**Nasce desligado**: com a chave desligada o job não abre conexão nenhuma.

A leitura entra **PENDENTE**, com a etiqueta "Falta completar", e aparece numa faixa no topo
de Leituras. Clicar nela abre o mesmo painel da importação, com a etapa do arquivo pulada:
falta só o que o PDF não diz — o carro, motor ligado, ignição e oficial/anomalia. Pendente de
propósito: inventar esses campos envenenaria o dado que a ferramenta existe para guardar.

**A credencial não fica em Configurações.** `GET /api/configuracoes/mapa` devolve todo valor em
texto claro para qualquer usuário autenticado — a senha da caixa chegaria a cada mecânico. Ela
vem do ambiente:

```bash
APP_IMAP_HOST=imap.gmail.com APP_IMAP_USUARIO=oficina@exemplo.com APP_IMAP_SENHA=senha-de-app docker compose up -d
```

| Variável | Para quê |
|---|---|
| `APP_IMAP_HOST` | Servidor IMAP. Vazio = não conecta, mesmo com a chave ligada |
| `APP_IMAP_PORTA` | 993 com SSL |
| `APP_IMAP_USUARIO` / `APP_IMAP_SENHA` | No Gmail, use **senha de app**, não a senha da conta |
| `APP_IMAP_SSL` | `true` por padrão |

O que a tela configura é o comportamento: ligar/desligar, a palavra que precisa estar no
assunto, **de quem aceitar** (vazio = ninguém), de quanto em quanto tempo olhar e a pasta.

**As guardas**, porque uma caixa de e-mail é uma porta para o mundo: remetente da lista com
endereço exato, assunto com a palavra combinada, anexo que é PDF **pelos bytes e nunca pelo
nome**, 8 MB e 5 anexos por mensagem, 20 mensagens por rodada, timeout de conexão e de leitura,
o mesmo relatório não entra duas vezes, e a mensagem só é marcada como lida quando foi tratada
até o fim sem erro — se o banco cair no meio, ela fica lá para a próxima rodada. **Nenhum
e-mail é apagado, e nada é enviado.**

### Wiki da oficina (menu Conhecimento)
O livro da empresa: a solução que deu certo, escrita por quem resolveu — sintoma, o que foi
medido, causa, solução e como confirmar. Aceita fotos.

O vínculo que importa é o **modelo**, não o carro: o artigo declara marca, modelo, motor e uma
**faixa de anos**, e reaparece sozinho no próximo carro que cair nessa faixa. Um artigo sem
marca nem modelo vale para qualquer veículo (a dica geral da casa). Carro, OS e leitura do
scanner ficam como procedência, para voltar ao caso concreto.

Onde aparece: na tela **Wiki** (busca por sintoma, peça ou modelo), dentro da **OS** como *"A
oficina já viu isso"*, e o artigo mostra ao lado as **leituras do mesmo modelo** — o texto diz
o que fazer, a leitura mostra como o carro bom se comporta.

### Fila de espera
Carros que entraram e ainda não têm dia marcado, na ordem de prioridade e chegada. Cada um
mostra **a data prevista de entrada**, e essa data é o ponto importante: a vaga não é contada
como livre só porque nenhum carro está *agendado* naquele dia — ela fica ocupada da entrada
até a previsão de entrega do carro que está nela. **Quando o carro sai, a vaga aparece para o
próximo da fila.**

A previsão de cada carro sai de uma simulação: o sistema percorre a fila em ordem e coloca
cada carro no primeiro dia em que ele cabe, consumindo a capacidade daquele dia — então o
segundo da fila só entra depois que o primeiro ocupou a vaga dele. Se um carro não couber nos
próximos 90 dias, o sistema diz isso **antes** de a oficina prometer prazo.

Duas regras que mantêm o número honesto:
- carro atrasado não libera vaga retroativamente — ele está lá; a previsão otimista é que saia
  a partir de amanhã;
- a ocupação de "agora" no painel do dono e as "vagas livres agora" na fila usam a mesma
  contagem, então as duas telas nunca se contradizem.

### Radar de carros parados
Lista ordenada pelo que precisa de decisão hoje: carro sem nenhum apontamento há N dias,
carro pronto que ninguém buscou, entrega prometida estourada, tempo acima do estimado,
serviço sem mecânico. Cada linha tem "avisar cliente" (abre o WhatsApp com a mensagem
pronta) e "abrir OS".

### Novo atendimento (check-in rápido)
Uma tela: busca o cliente por nome/telefone/placa (ou cadastra na hora), escolhe o carro
(ou cadastra na hora), descreve o problema, escolhe os serviços do catálogo — e o sistema
**já sugere o primeiro dia com folga**, com quantas horas e quantas vagas sobram naquele dia.

### Painel do mecânico (celular)
Cards grandes com os serviços dele. Três botões: **Iniciar** (pede quanto tempo ele acha
que vai gastar), **Pausar** (escolhe o motivo) e **Concluir**. O cronômetro aparece
rodando ao vivo e fica vermelho quando passa do previsto.

### Acompanhamento do cliente
Link somente leitura com QR Code. O dono escolhe o que ele mostra — lista de serviços,
previsão de entrega, paradas, motivo da parada, horas trabalhadas, nome do mecânico,
valores, fotos — em três camadas: **padrão da oficina → preferência do cliente → ajuste
daquela OS**. O link expira, pode exigir código de acesso e pode ser desligado na hora.

### Painel do dono
- Pátio agora: carros, em execução, aguardando, prontos não retirados, ocupação das vagas.
- **Permanência × mão de obra** e o aproveitamento do tempo — o diagnóstico central.
- **Entra × sai por semana**: se a barra de recebidos fica acima da de entregues, o pátio enche.
- **Onde o tempo se perde**: horas de carro parado por motivo (peça, aprovação, terceiro...).
- Equipe: horas apontadas e aderência entre previsto e realizado.
- Quando dá para pegar outro carro.

### Modo TV
`/tv` — quadro dos próximos dias em tela cheia, para pendurar um monitor na oficina.

---

## Ciclo de vida da OS

```
RECEBIDO → EM_DIAGNOSTICO → AGUARDANDO_APROVACAO → AGENDADO → EM_EXECUCAO ⇄ PAUSADO
                                                                   ↓
                                                  PRONTO_AGUARDANDO_RETIRADA → ENTREGUE
qualquer estado → CANCELADO
```

- Transição inválida devolve **409** com mensagem em português.
- `EM_DIAGNOSTICO` e `AGUARDANDO_APROVACAO` podem ser desligados (oficina que não faz
  orçamento formal).
- `PAUSADO` exige motivo (configurável) e abre um registro de parada que alimenta o Pareto.
- `PRONTO_AGUARDANDO_RETIRADA` é um estado próprio **de propósito**: carro pronto ocupando
  vaga é a causa de pátio cheio que ninguém mede. O sistema conta os dias.
- `ENTREGUE` libera o box. É este evento que esvazia o pátio.

---

## Tudo que é parametrizável

Tela **Configurações** (só o dono). O que você desligar **desaparece das telas** — não fica
opção morta na interface.

| Grupo | Exemplos |
|---|---|
| **Capacidade** | horas úteis/dia, dias e horário de funcionamento, máximo de carros por dia/semana/mês, quais limites estão ativos, permitir passar do limite e em quantos % |
| **Fluxo** | exigir diagnóstico, exigir aprovação de orçamento, exigir checklist/fotos na entrada, vários mecânicos na mesma OS, dois cronômetros ao mesmo tempo, exigir previsão de horas ao iniciar, exigir motivo ao pausar, mecânico pode abrir OS / mexer na agenda / ver valores, fechar cronômetro esquecido no fim do turno e em que horário |
| **Cliente** | ligar/desligar o acompanhamento, gerar link automático, validade, exigir código, e o que o link mostra (8 chaves) |
| **Alertas** | dias sem movimentação, dias pronto sem retirada, % de estouro de tempo, aviso antes da entrega |
| **E-mail** | ligar a entrada automática de leituras, palavra do assunto, de quem aceitar, de quanto em quanto tempo olhar, pasta da caixa (a **credencial** fica em variável de ambiente, não aqui) |
| **Cadastros** | especialidades (com cor), boxes e vagas, motivos de parada (com categoria), catálogo de serviços com tempo padrão, **marcas de veículo** |
| **Aparência** | nome da oficina, **cor principal**, **cor de destaque**, colunas da planta do pátio, modo TV |

---

## Arquitetura

```
delander (oficina-flow)/
├── docker-compose.yml          db + api + web
├── .env.example
├── backend/                    Java 21 + Spring Boot 3.5
│   ├── src/main/java/br/com/oficina/
│   │   ├── config/             seguranca (JWT), CORS, auditoria, rate limit, OpenAPI
│   │   ├── common/             BaseEntity, Contexto, erros RFC 7807
│   │   ├── auth/               login, refresh rotativo, principal da sessao
│   │   ├── usuario/ funcionario/ cadastro/    equipe e cadastros configuraveis
│   │   ├── cliente/ veiculo/                  clientes, carros, historico por placa
│   │   ├── ordemservico/       OS, itens, maquina de estados, timeline, cards
│   │   ├── apontamento/        cronometro e job de fechamento automatico
│   │   ├── parada/ peca/       paradas com motivo e pecas
│   │   ├── agenda/             quadro da semana e motor de capacidade
│   │   ├── compartilhamento/   link publico e visao do cliente
│   │   ├── configuracao/       leitura tipada das configuracoes
│   │   ├── metrica/            painel do dono
│   │   ├── arquivo/            fotos e documentos
│   │   └── demo/               usuario dono e dados de demonstracao
│   └── src/main/resources/db/migration/        Flyway V1 (schema) + V2 (dados iniciais)
└── frontend/                   React 18 + TypeScript + Vite + Tailwind
    └── src/
        ├── api/                cliente HTTP com refresh automatico
        ├── lib/                sessao, configuracoes, formatacao
        ├── components/          UI e layout
        └── features/            quadro, checkin, os, mecanico, dashboard,
                                 cadastros, config, publico, tv
```

**Stack:** Spring Web, Data JPA, Security (JWT), Validation, Flyway, PostgreSQL 16,
springdoc-openapi, Lombok, Testcontainers · React, TanStack Query, React Router,
Tailwind CSS, Recharts, lucide-react, qrcode.react.

---

## Segurança e LGPD

- Senhas com **BCrypt** (força 12). Nem o dono consegue ler a senha de um funcionário.
- **JWT** assinado com HS256; o segredo vem de variável de ambiente e o app não sobe com
  segredo curto. Refresh token é **rotativo**: ao renovar, o anterior é invalidado.
- Permissão por perfil (`DONO`, `GERENTE`, `RECEPCAO`, `MECANICO`) validada no **serviço**,
  não só no controller, e reforçada pelas flags de Configurações.
- Mecânico só aponta hora em serviço dele, e só se tiver a especialidade exigida.
- **Link público:** token aleatório de 32 bytes (`SecureRandom`), indexado por hash
  SHA-256, resposta somente leitura montada pelo escopo configurado, expiração, código de
  acesso opcional, **limite de requisições por IP** e log de acesso com IP truncado.
  *Nota honesta:* o token também é guardado em claro para o dono poder reenviar o mesmo
  link ao cliente sem invalidar o que já foi compartilhado. Se o seu cenário não aceita
  isso, use "Gerar link novo" e remova a coluna `token` (a busca já é feita pelo hash).
- **Uploads:** tipo conferido pelos bytes iniciais (não pela extensão), limite de 8 MB,
  nome gerado pelo servidor, download sempre autorizado.
- Erros em **RFC 7807** com mensagem pronta para a tela; nada de stack trace vazando.
- **LGPD:** consentimento de contato no cadastro, mínimo de dados na página pública
  (só o primeiro nome do cliente), e exclusão de cliente por **anonimização** — preserva
  o histórico de OS e as métricas.
- Integridade do cronômetro: horário sempre do **servidor**, índice único no banco impede
  dois apontamentos abertos no mesmo serviço, e um job fecha o cronômetro esquecido no fim
  do turno.

---

## Testes

```bash
cd backend

./mvnw test        # 50 testes unitarios
./mvnw verify      # + teste de integracao ponta a ponta (precisa do Docker aberto)
```

Os unitários cobrem: máquina de estados da OS, métricas de permanência × mão de obra, a
reserva do elevador (um carro por vez, contagem regressiva, conflito de horário), o parser do
relatório do scanner (acento, vírgula decimal, mínimo negativo, bandas repetidas de página,
dois módulos no mesmo PDF) e o alcance do artigo da wiki. Dois deles merecem destaque:

- `LeitorPdfAutelTest` **monta um PDF de verdade com o PDFBox** e o lê de volta, então o
  caminho `Loader → PDFTextStripper → analisador` é exercitado sem binário no repositório.
- `AnalisadorRelatorioAutelTest` tem um teste que falha se VIN, nome, telefone ou número de
  série aparecerem no resultado. É uma decisão de privacidade, não um acidente — se alguém
  adicionar esse campo um dia, o teste quebra e a conversa acontece de novo.

O teste de integração (`FluxoOficinaIT`) sobe um PostgreSQL real com Testcontainers e
percorre: check-in → transição inválida (409) → aprovação → cronômetro → parada com motivo
→ conclusão → link público com escopo respeitado → entrega liberando a vaga.

```bash
cd frontend
npm run typecheck  # TypeScript
npm run build
```

---

## Roteiro de demonstração (10 minutos)

1. Entre como **dono** (`dono@oficina.local` / `123`). O quadro da semana já vem
   com carros e o semáforo de capacidade por dia.
2. **Radar de parados** — veja o carro travado por falta de peça e o que está pronto
   esperando o cliente há 3 dias.
3. **Novo atendimento** — cadastre um cliente e um carro novos, descreva o problema,
   escolha "Revisão completa" e aceite o dia sugerido.
4. Na OS criada, clique em **Enviar orçamento** e depois em **Aprovar e agendar**.
5. Saia e entre como **mecânico** (`carlos@oficina.local`). No painel dele, toque em
   **Iniciar**, informe 3h e veja o cronômetro rodando.
6. Toque em **Pausar** e escolha "Falta de peça". Volte como dono: o card ficou âmbar e a
   parada já está contando.
7. Na OS, registre a peça com previsão de chegada. Em **Peças pendentes**, marque "Chegou".
8. Como mecânico, **Iniciar** de novo e **Concluir**. A OS vira "Pronto — aguardando
   retirada" e começa a contar os dias.
9. Como dono, abra a OS → **Compartilhar**. Desligue "Mostrar valores", copie o link e
   abra em uma aba anônima: o valor não aparece.
10. **Entregar veículo** — a vaga é liberada na hora.
11. **Painel do dono** — permanência × mão de obra, entra × sai, onde o tempo se perde.
12. **Configurações → Fluxo** — desligue "Exigir aprovação do orçamento" e veja a etapa
    sair do fluxo da próxima OS.

---

## Fora do escopo desta versão

Emissão fiscal/NF-e, integração com fornecedor de peças, **envio** de e-mail e WhatsApp
(há o link e a mensagem pronta, mas quem envia é você — o sistema só *lê* e-mail, nunca
manda), financeiro completo (caixa, contas a pagar) e multi-oficina ativo — o `oficina_id`
já existe em todas as tabelas e o código está isolado, mas não há cadastro de empresas nem
cobrança.
