# Subir o Delander na internet, de graça

**Feito: <https://delander.onrender.com>** — 23/09/2026. Sem cartão de crédito, sem prazo
de validade, com HTTPS. O que segue é o registro de como foi, e serve para refazer.

**Endereço para usar: <https://delander.vercel.app>** (a tela não dorme).

| Peça | Onde | Detalhe |
|---|---|---|
| Banco | Neon, projeto `delander` | Ohio (`aws-us-east-2`), Postgres 18, plano Free |
| Aplicação | Render, serviço `delander` | Ohio, Docker, plano Free, deploy automático a cada push |
| Tela | Vercel, projeto `delander` | Root Directory `frontend`, repassa `/api` para o Render |
| Repositório | [GustavoKathrin/delander](https://github.com/GustavoKathrin/delander) | branch `main` |

### Ponta solta

`APP_URL_PUBLICA` no Render ainda é `https://delander.onrender.com`. Funciona — é o mesmo
sistema — mas é o endereço que vai no link de acompanhamento do cliente, e pelo Render ele
pega a espera de 1 minuto. Trocar para `https://delander.vercel.app` em *Render → delander
→ Environment* melhora isso. É um campo só; não está quebrado.

**A pilha:** **Neon** (banco Postgres) + **Render** (a aplicação). Duas contas, e o
deploy é uma imagem só — a tela e a API saem da mesma origem, porque o front chama
`/api` relativo. Foi por isso que o `Dockerfile` da raiz existe: ele compila o front e
o embute no jar. Um serviço em vez de dois, sem CORS e sem URL de API para configurar.

## Por que estes dois

| | Escolhido | Por quê |
|---|---|---|
| Banco | **Neon** | 0,5 GB e 100 CU-horas/mês, **sem prazo e sem apagar dado**. Dorme quando ninguém usa e acorda sozinho. O Postgres grátis do Render expira em 30 dias; o do **Supabase pausa depois de 7 dias** sem acesso — ruim para um sistema que fica dias parado |
| Aplicação | **Render** | Plano grátis de verdade, **sem cartão**, 750 h/mês, aceita Docker e lê o `render.yaml` daqui. Fly.io e Railway hoje pedem cartão |
| Tela | **Vercel** (opcional) | O jar já serve a tela, então o sistema funciona só com o Render. O Vercel entra porque **não dorme**: a tela abre na hora mesmo com a API hibernando |

## O que o plano grátis cobra em troca

Três coisas, e nenhuma é surpresa depois:

1. **Dorme.** Sem acesso por 15 minutos, o serviço desliga. O primeiro clique depois
   disso espera **cerca de 1 minuto**.

   Isso agora tem remédio de graça: o workflow
   [`manter-acordado.yml`](.github/workflows/manter-acordado.yml) visita o serviço de
   10 em 10 minutos, **das 7h às 19h, de segunda a sábado**. Nesse intervalo ninguém
   espera. Fora dele o serviço dorme de propósito — o plano grátis dá 750 horas por
   mês e manter acordado 24h consome ~730, sem folga para nada.

   Para o workflow funcionar, o repositório precisa estar no GitHub e as Actions
   ligadas. O agendador do GitHub atrasa alguns minutos quando a fila está cheia; como
   a margem é de 15 minutos e a visita é de 10 em 10, um atraso ocasional não derruba.

   Quem abrir às 6h da manhã ainda espera — mas agora a tela **diz** que o servidor
   está acordando, em vez de girar um spinner mudo que parece sistema quebrado.
2. **Não guarda arquivo.** O plano grátis não tem disco. O banco inteiro sobrevive
   (carros, OS, leituras, wiki, configurações), mas o **PDF do scanner e as fotos da
   wiki somem** a cada deploy ou reinício. Resolver isso é mandar arquivo para um
   armazenamento externo — dá para fazer depois, é mexer em `ArmazenamentoArquivos`.
3. **0,5 GB de banco.** Para uma oficina, isso demora anos a incomodar.

## Antes de mandar para o ar: a senha

Hoje todo login é `123`, porque você pediu isso para testar no seu computador. **Na
internet aberta, isso quer dizer que qualquer pessoa que achar a URL é o dono da
oficina.** O `render.yaml` já vem com `APP_SENHA_MINIMA=6` e pede uma `APP_ADMIN_SENHA`
sua — escolha uma de verdade nesse campo. Os usuários de demonstração continuam com
`123`; se o link for circular, desligue `APP_CARGA_DEMO` (fica `false`) e a oficina
nasce vazia, sem esses logins.

O `APP_JWT_SECRET` **o Render sorteia sozinho** (`generateValue: true`): ninguém digita,
ninguém cola em conversa nenhuma.

### A equipe e o apelido

**Delander, Gustavo, a secretária, Tonny e Kevim** nascem no primeiro start com a
senha **`12345678`**, por decisão do dono — assim a equipe entra sem depender de
configurar nada.

O que isso custa, dito claramente: enquanto o repositório for público, essa senha
está publicada junto com o endereço do sistema. Duas saídas, e qualquer uma
resolve:

- **Trocar a senha de cada um em Funcionários** depois do primeiro acesso. Até
  isso acontecer, qualquer um dos cinco entra como qualquer outro.
- **Definir `APP_EQUIPE_SENHA_PADRAO`** no painel do Render. A variável tem
  prioridade sobre o padrão, então a senha real nunca entra no repositório.

A tela de Funcionários tem **duas listas**, e isso não é enfeite. Em cima, quem
pega serviço — Tonny e Kevim — porque a jornada de quem tem ficha é somada como
capacidade de mão de obra da oficina. Embaixo, **"Entram no sistema, mas não
pegam serviço"**: Delander, Gustavo e a secretária, com o botão **Trocar senha**.
Eles ficam fora da primeira lista de propósito: cadastrar o dono como mão de obra
faria o sistema prometer prazo que a bancada não cobre.

Eles entram pelo **apelido**, não pelo e-mail:

| Entra como | Quem é | Papel |
|---|---|---|
| `delander` | Delander | Dono |
| `gustavo` | Gustavo | Dono |
| `secretaria` | Secretária | Recepção |
| `tonny` | Tonny | Mecânico |
| `kevim` | Kevim | Mecânico |

Os dois mecânicos já nascem com ficha de funcionário — é dela que saem a agenda, o
apontamento de hora e a alocação no pátio. Dono e recepção não pegam serviço, então
não entram na bancada.

O e-mail continua valendo para entrar. Ninguém é obrigado a decorar nada novo.

---

## Os passos

### 1. O código precisa estar num repositório Git

O Render lê de um repositório. Já rodei `git init` e fiz o primeiro commit aqui; falta
criar o repositório no GitHub (na sua conta) e apontar para ele:

```bash
git remote add origin https://github.com/SEU-USUARIO/delander.git
git push -u origin main
```

O `.gitignore` já deixa `.env`, `dados/` e `target/` fora — nada de segredo vai subir.
Pode ser repositório **privado**; o Render pede autorização de leitura e funciona igual.

### 2. Banco no Neon — **feito**

Projeto **`delander`**, região **AWS US East 2 (Ohio)**, plano Free, Postgres 18.

> **Por que Ohio e não São Paulo.** O Neon oferece São Paulo e parece a escolha óbvia
> daqui. É a errada: o **Render não tem região na América do Sul**, então o banco em São
> Paulo com a aplicação nos EUA faria **cada consulta** atravessar o continente — e uma
> tela do pátio dispara várias. Com os dois em Ohio, a consulta leva ~1 ms e você, no
> Brasil, paga a distância **uma vez por clique** em vez de uma vez por consulta.

A connection string do Neon vem assim (a senha fica mascarada na tela até você copiar):

```
postgresql://neondb_owner:SUA_SENHA@ep-sparkling-wave-b5y93el9.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Ela não serve para o Java como está.** São três diferenças, e cada uma custa uma hora
de depuração:

1. usuário e senha vão em **campos separados**, fora da URL;
2. o prefixo é **`jdbc:postgresql://`**;
3. **apague o `&channel_binding=require`** — isso é parâmetro do driver C (libpq). O
   driver JDBC não conhece esse parâmetro e recusa a conexão.

Tem ainda uma quarta, invisível: a tela do Neon oferece o endereço **com `-pooler`** por
padrão. **Não use.** O pooler é um PgBouncer em modo transação, e o Hibernate usa
prepared statements — a combinação quebra com *"prepared statement already exists"*. A
aplicação já tem o pool dela (HikariCP, 10 conexões); o endereço direto é o certo, e é o
que está abaixo (sem `-pooler`).

Os três valores prontos para colar no Render:

| Variável | Valor |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://ep-sparkling-wave-b5y93el9.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | `neondb_owner` |
| `SPRING_DATASOURCE_PASSWORD` | *no botão **Show password** do Neon — só você vê* |

### 3. A aplicação no Render

1. [dashboard.render.com](https://dashboard.render.com) → entrar com GitHub
2. **New** → **Blueprint** → escolha o repositório `delander`
3. Ele acha o `render.yaml` e mostra o serviço `delander`. Confirme.
4. Ele vai pedir os campos marcados como "seu": as três do banco acima,
   `APP_ADMIN_EMAIL`, `APP_ADMIN_SENHA` e `APP_URL_PUBLICA`.
   - `APP_URL_PUBLICA` é a URL que o próprio Render te dá
     (`https://delander.onrender.com`) — é ela que vai no link que o cliente recebe
     para acompanhar o carro. Se ainda não souber, salve qualquer coisa e corrija
     depois; só o link de acompanhamento depende disso.
5. **Apply**. O primeiro build leva de 5 a 10 minutos (compila o front e o jar).

### 4. Conferir

Abra a URL. Na primeira vez espere o minuto de partida.

- Login com o `APP_ADMIN_EMAIL` / `APP_ADMIN_SENHA` que você escolheu
- `https://.../actuator/health` tem que responder `{"status":"UP"}`
- Nos logs do Render, procure `Successfully applied N migrations` — é o Flyway criando
  as tabelas no Neon na primeira subida. Se aparecer erro de conexão, quase sempre é a
  URL do passo 2 com `usuario:senha@` sobrando ou sem `sslmode=require`.

### 5. A tela no Vercel (opcional, e vale a pena)

O Render sozinho já serve a tela. Pôr o front no Vercel resolve o pior sintoma do plano
grátis: **a tela deixa de dormir**. Com tudo no Render, o primeiro acesso depois de 15
minutos parados mostra uma página de carregamento por ~1 minuto. Com o Vercel na frente,
a tela abre **na hora** (é CDN, não dorme) e só os dados esperam a API acordar — a
diferença entre "site fora do ar" e "carregando".

E não precisa mexer em uma linha de código. O front chama `/api` relativo; o
[frontend/vercel.json](frontend/vercel.json) faz o Vercel repassar `/api/*` para o
Render. O navegador continua vendo mesma origem, então **não entra CORS na história**.

1. [vercel.com/new](https://vercel.com/new) → entrar com GitHub → importar `delander`
2. **Root Directory: `frontend`** (esse é o campo que todo mundo erra)
3. O `vercel.json` já define build e saída — não precisa configurar mais nada
4. **Depois do deploy do Render**, confira se a URL dentro do `vercel.json` é mesmo a
   sua (`https://delander.onrender.com`). Se o Render tiver dado outro nome, corrija a
   linha `destination` e faça `git push`
5. Com o Vercel na frente, `APP_URL_PUBLICA` no Render passa a ser a **URL do Vercel** —
   é ela que o cliente recebe para acompanhar o carro

> Se algo der errado no Vercel, a URL do Render continua servindo o sistema inteiro
> sozinha. Não é um caminho sem volta.

## Depois

- **Deploy automático** já está ligado (`autoDeployTrigger: commit`): `git push` sobe.
- **Tirar o sono e ganhar disco** é o plano Starter do Render (~US$ 7/mês). É o único
  jeito de PDF e foto sobreviverem, e de o primeiro clique ser instantâneo.
- **Domínio próprio** (`oficina.com.br`) o Render aceita de graça, com HTTPS.

---

## O fluxo em sete etapas (28/10/2026)

O atendimento passou a ter etapas explícitas. **Nenhum estado novo foi criado
no banco**: as etapas 2, 3 e 4 acontecem todas com a OS em `EM_DIAGNOSTICO` —
é o mesmo carro mudando de mão, não de lugar.

| Etapa | Quem faz | O que trava |
|---|---|---|
| 1. Recebimento | mecânico | **foto de entrada**, se `fluxo.exigir_fotos_entrada` estiver ligada |
| 2. Peças e serviços | mecânico | — (ele não vê nem escreve preço) |
| 3. Verificação e cotação | balcão | peça sem preço não deixa o orçamento fechar |
| 4. Mão de obra | balcão | desconto acima do teto |
| 5. Aprovação do cliente | balcão | o total é congelado em `valor_aprovado` |
| 6. Status do serviço | mecânico | — |
| 7. Entrega e prontuário | balcão | serviço em aberto não deixa entregar |

### Duas configurações novas, em Configurações → Fluxo

**Como o valor da mão de obra é definido** (`fluxo.modo_mao_de_obra`)
nasce em **Digitado**, e isso é uma mudança de comportamento: antes o valor
era sempre a soma dos serviços pelo preço do catálogo. Nasce assim porque a
tabela de preços da oficina ainda não existe — com catálogo vazio,
"Pela tabela" soma zero e o orçamento sai de graça. No dia em que a tabela
estiver pronta, é um clique.

**Desconto que o balcão pode dar sozinho**
(`fluxo.desconto_maximo_percentual`) nasce em **0**: ninguém dá desconto até
você dizer quanto. Dono e gerente nunca têm teto.

### A régua da tela mostra essas sete

A OS abre com uma régua de sete caixinhas, **com uma cor por etapa**, e
serviço, peça e valores são seções *dentro* do cartão da etapa — cada uma
com a barra na cor da etapa a que pertence. Antes eram cartões soltos abaixo
da régua, visualmente iguais à wiki e à linha do tempo.

Quem decide a etapa é `etapaDaOs(os)`, em
`frontend/src/features/os/EtapasDaOs.tsx`. Como 2, 3 e 4 compartilham o estado
`EM_DIAGNOSTICO`, a diferença vem do dado: sem serviço lançado é a 2; com
peça `COMPRAR` ainda **sem preço** é a 3; o resto é a 4.

> Já foi *status* da peça em vez de preço, e estava errado: a peça continua
> `SOLICITADA` depois de cotada — comprar só acontece depois do "sim" do
> cliente —, então o carro ficava preso na etapa 3 com a pendência "1 peça
> esperando preço" em cima de uma peça que já tinha preço. Quem mede isso é
> `PecaResposta.semCotacao`, um booleano que o servidor manda para todo
> mundo: é a *ausência* do preço, não o preço, e por isso não é mascarado.

**Cada etapa mostra só o que é dela.** A primeira versão deixava todas as
seções na tela ao mesmo tempo, só pintadas com a cor da etapa a que
pertencem — e o dono recusou: "em cada etapa só quero os campos necessários
para concluir cada etapa". A cor dizia "isto é de outra etapa" e a presença
dizia "preencha agora".

| Etapa | O que a tela mostra |
|---|---|
| 1. Recebimento | vistoria de entrada e as fotos de como o carro chegou |
| 2. Peças e serviços | serviços e peças, para lançar |
| 3. Cotação | peças, para marcar estoque e pôr preço |
| 4. Mão de obra | mão de obra, desconto e total |
| 5. Aprovação | o orçamento e o botão de mandar ao cliente |
| 6. Serviço | serviços (executar), peças (chegada) e fotos — e o painel **Oficina agora** |
| 7. Entrega | serviços, peças, total e fotos — o registro do que foi feito |

O que não é da etapa corrente não some: fica em **"Ver o que é das outras
etapas"**, fechado, no pé do cartão. Conferir a vistoria de entrada com o
carro já na bancada é uma coisa que se faz.

**A foto de entrada só é cobrada nas etapas 1 e 5**, porque é só aí que o
servidor trava: `exigirChecklistDeEntrada` é chamado ao entrar em
`EM_DIAGNOSTICO` e ao entrar em `EM_EXECUCAO`. Cobrá-la nas etapas 2 a 4
punha o trabalho da etapa 1 no lugar onde o trabalho é outro.

**A pendência não repete um botão que a seção já mostra.** Na etapa 2 havia
quatro botões para duas ações: o atalho nas pendências nasceu quando serviço
e peça viviam em cartões soltos e era preciso rolar até eles.

**A conta não pode usar o VALOR.** Valor é mascarado para quem não vê
dinheiro, então uma regra baseada nele mostraria uma etapa para o dono e
outra para o mecânico olhando o mesmo carro. `semCotacao` existe para isso:
diz se há preço sem dizer qual é.

**O preço da peça se põe na própria etapa 3.** O editor é
`components/PrecoDaPeca.tsx`, usado tanto na linha da peça dentro da OS
quanto na fila de compras (`/pecas`). Antes a etapa 3 mandava "ponha o preço
do que precisa comprar" e a linha da peça era só leitura — a única tela que
cotava era a fila, e a etapa não levava até ela.

**O próximo passo é o destino mais próximo adiante**, e não o primeiro que o
servidor devolve. A régua tem sete etapas mas a comparação usa uma escala
mais fina (`ordemDoStatus`): "aguardando aprovação" e "orçamento aprovado"
valiam 5 os dois, nenhum candidato passava no "maior que", e o botão grande
da etapa 5 caía em **"Cliente recusou"** — a tela destacava a recusa e
escondia o "sim" atrás de "Outras opções".

**As cores das etapas não usam `marca-*`.** Essa é a cor da oficina, trocada
em tempo de execução pelo tema (Configurações → Layout); no Delander ela é
cinza-quase-preto. A paleta da marca também só tem os degraus 50, 100, 200,
500, 600, 700 e 900 — `marca-300` não existe e a classe some sem erro.

### Oficina agora — o painel da etapa 6 (30/10/2026)

`/execucao`, no menu como **Oficina agora**. É a etapa 6 vista de fora: a
oficina inteira agora, **um cartão por carro**, não por serviço.

Já existiam duas telas da execução e nenhuma respondia a esta pergunta. A OS
mostra um carro. O Painel do Mecânico mostra um serviço por cartão, na ordem
da agenda — é a tela de quem está com a chave na mão. Quem olha a oficina
inteira pergunta "onde está cada carro, e o que falta nele", e a resposta
disso é por carro.

Cada cartão traz a rosca de progresso (serviços concluídos sobre o total), a
placa, o box, a entrega prometida, e dentro dele uma linha por serviço com o
mecânico, o cronômetro ao vivo, a barra contra a estimativa e **o motivo da
parada**. No pé, as seis fotos mais recentes do trabalho. Abaixo dos cartões,
a fila: carros **aprovados que ninguém começou**, ordenados pelo tempo de
espera — o pior número da oficina, porque o cliente já disse sim e a vaga
continua ocupada.

Três coisas que valem saber antes de mexer:

- **Azul é a cor da etapa 6**, a mesma da régua da OS. Não é `marca-*`.
- **Carro parado não se conta pelos serviços.** O caminho mais comum de um
  carro virar `PAUSADO` não pausa serviço nenhum: quando o último cronômetro
  fecha, `ReconciliacaoOs` põe a OS em `PAUSADO` e não toca nos itens. Por
  isso o resumo tem `carrosParados` **e** `servicosParados`.
- **Nenhum preço entra na tela.** Ela serve aos quatro perfis sem máscara:
  hora de trabalho o mecânico já vê, dinheiro não — e assim o painel é o
  mesmo para todo mundo.

Servidor: `GET /api/execucao`, em
`backend/.../apontamento/ExecucaoService.java`. Monta tudo em consultas de
tamanho fixo porque a tela recarrega sozinha a cada 20 segundos, e a ordem
dos cartões (`POR_URGENCIA`) é regra de negócio com teste próprio: parado
primeiro, depois quem tem gente trabalhando, depois o resto.

### Foto por serviço (V23)

`arquivo_os.os_item_id` cola a foto em **um serviço** da OS, e é nulável: a
foto de ENTRADA é do carro, não de serviço nenhum. `on delete set null` —
apagar um serviço lançado errado não leva embora a foto do motor aberto.

| Onde | O que aparece |
|---|---|
| linha do serviço, na OS | botão de câmera com contador |
| cartão "Fotos do serviço" | galeria agrupada por serviço |
| painel do mecânico | tira de miniaturas no cartão |
| prontuário | fotos daquela passagem |
| link do cliente | legenda com o nome do serviço |

A foto do serviço **nasce interna**. Quem libera ao cliente é quem trabalha no
carro (`PATCH /api/os/{os}/arquivos/{id}`), mesma regra do escopo do link: ele
é quem sabe se a foto do motor aberto ajuda ou assusta. Apagar
(`DELETE`) é da equipe, **menos a foto de ENTRADA**, que é prova e só a
gerência tira.

**Defeito antigo corrigido junto:** toda foto do sistema voltava **401**. O
caminho é protegido por token e as telas o punham no `src` de um `<img>`, que
não manda cabeçalho — o que aparecia era ícone de imagem quebrada, que todo
mundo lia como "ainda não subiu". Valia para a foto do checklist de entrada
desde o primeiro dia. Hoje os bytes vêm por `baixarArquivo()` e viram object
URL, liberado no unmount.

### A regra de quem vê dinheiro

`fluxo.mecanico_ve_valores` passou a ser aplicada **no servidor**, e não só na
tela: antes o JSON ia completo e só o React escondia. Hoje dono, gerente e
recepção veem; o mecânico recebe os campos nulos.
