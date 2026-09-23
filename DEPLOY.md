# Subir o Delander na internet, de graça

Dá. Sem cartão de crédito, sem prazo de validade, com HTTPS.

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
   disso espera **cerca de 1 minuto**. Para demonstrar, tudo bem — mande o link e abra
   antes. Para a oficina usar todo dia, não serve: aí é o plano pago (~US$ 7/mês).
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
