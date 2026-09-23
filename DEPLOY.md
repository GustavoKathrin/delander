# Subir o Delander na internet, de graça

Dá. Sem cartão de crédito, sem prazo de validade, com HTTPS.

**A pilha:** **Neon** (banco Postgres) + **Render** (a aplicação). Duas contas, e o
deploy é uma imagem só — a tela e a API saem da mesma origem, porque o front chama
`/api` relativo. Foi por isso que o `Dockerfile` da raiz existe: ele compila o front e
o embute no jar. Um serviço em vez de dois, sem CORS e sem URL de API para configurar.

## Por que estes dois

| | Escolhido | Por quê |
|---|---|---|
| Banco | **Neon** | 0,5 GB e 100 CU-horas/mês, **sem prazo e sem apagar dado**. Dorme quando ninguém usa e acorda sozinho. O Postgres grátis do Render expira; o do **Supabase pausa depois de 7 dias** sem acesso — ruim para um sistema que fica dias parado |
| Aplicação | **Render** | Plano grátis de verdade, **sem cartão**, 750 h/mês, aceita Docker e lê o `render.yaml` daqui. Fly.io e Railway hoje pedem cartão |
| Tela | (junto) | Embutida no jar. Vercel/Cloudflare seriam ótimos, mas exigiriam trocar o `/api` relativo por URL absoluta + CORS — mais peça para quebrar, de graça |

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

### 2. Banco no Neon

1. [console.neon.tech](https://console.neon.tech) → entrar com GitHub ou Google
2. **Create project** → nome `delander`, região mais perto do Brasil
   (*AWS us-east-1* costuma ser a menor latência disponível no grátis)
3. Copie a **connection string**. Ela vem assim:

```
postgresql://meu_usuario:minha_senha@ep-algo-123.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Aqui é onde esse tipo de deploy quebra.** O Java não aceita essa URL inteira: usuário
e senha vão separados, e o prefixo é `jdbc:`. Parta em três:

| Variável | Valor |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://ep-algo-123.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | `meu_usuario` |
| `SPRING_DATASOURCE_PASSWORD` | `minha_senha` |

Ou seja: troque `postgresql://` por `jdbc:postgresql://` e **apague o
`usuario:senha@`** do meio. O `?sslmode=require` fica — sem ele o Neon recusa a conexão.

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

## Depois

- **Deploy automático** já está ligado (`autoDeployTrigger: commit`): `git push` sobe.
- **Tirar o sono e ganhar disco** é o plano Starter do Render (~US$ 7/mês). É o único
  jeito de PDF e foto sobreviverem, e de o primeiro clique ser instantâneo.
- **Domínio próprio** (`oficina.com.br`) o Render aceita de graça, com HTTPS.
