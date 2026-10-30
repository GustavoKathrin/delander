# Plano: nota fiscal, painel e acabamento

Levantado em 30/10/2026 com dez agentes de pesquisa, cada frente conferida
por um cético que tentou derrubá-la. **Os cinco céticos derrubaram alguma
coisa.** Este documento guarda o que sobreviveu à checagem e marca o que
ainda está em aberto — misturar os dois é o que faz um plano virar decisão
errada três meses depois.

---

## 1. A parte fiscal

### 1.1 O que é fato (conferido na fonte, resistiu ao cético)

**A oficina emite DOIS documentos por ordem de serviço, não um.**

| O quê | Documento | Imposto | Onde |
|---|---|---|---|
| Mão de obra / serviço | NFS-e | ISS | municipal → agora nacional |
| Peça | NF-e (55) ou NFC-e (65) | ICMS | estadual (SEF/MG) |

A LC 116/2003 separa os dois, e é proibido emitir NFS-e para operação sujeita
a ICMS. Não dá para "resolver tudo com uma nota".

**Prazo que já está correndo:**

- **Montes Claros/MG** tornou a NFS-e Nacional obrigatória **desde
  01/01/2026** (Portaria/Finanças nº 05, de 14/10/2025). O emissor municipal
  antigo deixou de existir.
- **Resolução CGSN nº 191/2026** (DOU 10/08/2026): ME e EPP do Simples
  Nacional passam a emitir NFS-e **exclusivamente pelo Emissor Nacional** —
  Web ou API — **a partir de 01/11/2026**. Até 31/10 ainda valia o sistema
  municipal.

Ou seja: isso não é um recurso que a gente vai acrescentar. É uma obrigação
que começou, e que existe com ou sem o nosso sistema.

**Sem certificado digital e-CNPJ A1 (arquivo .pfx/.p12) não há integração por
API.** Não existe procuração eletrônica funcional, e A3 em token não serve
para servidor. Custo: R$ 165 a R$ 280/ano.

### 1.2 O que dá para testar esta semana, de graça

**Emissor Nacional em produção restrita** —
`https://www.producaorestrita.nfse.gov.br/EmissorNacional/Login` — aceita
login por conta **gov.br**, sem certificado e sem credenciamento. As notas
não têm validade jurídica. Serve para entender o leiaute e os campos antes de
escrever uma linha de código.

### 1.3 O que ficou EM ABERTO (não feche ainda)

O cético derrubou o eixo da recomendação de fornecedor:

- **Focus NFe não tem homologação isolada.** `homologacao.focusnfe.com.br` e
  `api.focusnfe.com.br` são CNAME para **o mesmo balanceador AWS**. O
  argumento "o host separado protege de emitir nota de verdade por engano" é
  falso. **Consequência para o nosso código: a trava tem que ser nossa** —
  variável de ambiente explícita, faixa visível na tela em homologação, e
  recusa de emitir em produção sem habilitação deliberada.
- **Duas opções nunca foram avaliadas** e precisam entrar antes de assinar:
  **Brasil NFe** (Ipatinga/MG, mesmo estado, emissão sem teto por menos de
  R$ 100/mês) e **ACBr API** (modelo anual, franquia de 1.000 emissões,
  créditos não expiram).
- **Nuvem Fiscal está morta** — domínio não resolve mais e há comunicado de
  desativação de 22/04/2026. Se aparecer em comparativo de 2025, é por isso.
- Na Focus, **nota recebida também consome o pacote** de 100 documentos.

**Candidato atual, não decisão:** Focus NFe Solo, R$ 94,90/mês, 100
documentos, 30 dias de teste, cobre NFS-e e NF-e no mesmo contrato.

### 1.4 Perguntas que só a oficina responde

1. É ME/EPP do **Simples Nacional**? *(decide se o prazo de 01/11 já pegou)*
2. Tem **certificado A1** em arquivo? De que ano?
3. O CNPJ está **autorizado no CNC** da Prefeitura de Montes Claros?
4. Tem **Inscrição Estadual** ativa e credenciamento NF-e no SPED MG?
   *(sem isso, só dá para emitir nota de mão de obra)*
5. **Quantas notas por mês?** *(decide se 100 documentos bastam)*
6. As peças que estão no estoque **têm nota de entrada**? Compra de
   particular ou desmanche? *(se sim, a oficina precisa emitir nota de
   entrada, e isso é outra tela)*
7. Quem é o **contador** e ele valida o código de serviço municipal, o NBS e
   a alíquota de ISS? *(errar esse campo faz a prefeitura rejeitar)*

---

## 2. O acabamento

### 2.1 O que foi medido, não opinado

O CSS renderizado dos sistemas de referência (Tekmetric, Shopmonkey,
Shop-Ware, Mitchell 1) em 30/10/2026 mostra o mesmo padrão nos quatro:

- **uma** cor de acento — e ela aparece em cerca de **5% dos nós de texto**;
- **uma ou duas** famílias tipográficas;
- tinta quase-preta, **nunca `#000`** — azulada, tipo `#1D2030`;
- raio de canto **pequeno, 4 a 6px**;
- verde/amarelo/vermelho existem **só como severidade**. No Tekmetric a cor
  até ordena a lista — ela não decora, ela classifica.

O oposto de "infantil e colorido" não é "sem cor". É **cor escassa e
semântica**.

**Não copiar o site de marketing deles** — é deliberadamente berrante, e é
exatamente o registro que o dono recusou. O produto por dentro é sóbrio.

### 2.2 No Brasil

Nove sistemas reais levantados (dez nomes do meu palpite inicial **não
existem** como produto). O padrão do painel brasileiro é estreito: dinheiro
do mês, contagem de OS na oficina, agenda do dia. O resto é invenção de cada
um.

- **MecânicaPRO** e **OficinaTop** têm interface genuinamente contemporânea.
- **Oficina Integrada** é o arquétipo do que o dono reclamou: mockup de iMac,
  Porsche prateado dentro da tela, faixas diagonais amarelas.
- **Actana** passou batido na primeira varredura e é o mais relevante para a
  frente fiscal — é o único que amarra explicitamente NFS-e para o serviço e
  NF-e/NFC-e para a peça.

Preços conferidos: OficinaTop 0 / 119,90 / 149,90 / 249,90 · MecânicaPRO
70 / 90 / 120 / 150 · Wüst Básico 79,90 (com NFS-e inclusa).

---

## 3. O painel inicial

### 3.1 A regra

Few (Perceptual Edge, 2007) e a NN/g convergem: **painel não é vitrine de
número, é lista de exceção com ação atrelada.** Se não dá para nomear a
decisão que o número destrava, aquilo é relatório, não painel.

**O /painel de hoje é analítico, não operacional.** Permanência média, Pareto
de paradas, entra × sai de 8 semanas, seletor de 7/30/90 dias — isso responde
*"por que o pátio não esvazia"* uma vez por mês. Não responde *"o que eu faço
agora"*.

### 3.2 A proposta: três faixas

**Topo — exceções que pedem ação** *(e cada uma leva à lista já filtrada, com
o botão da ação na linha)*

- travado, por frente (peça, aprovação, mecânico)
- orçamento enviado sem resposta
- risco de estourar a previsão
- aprovado e ainda sem mecânico
- pronto e não retirado

**Meio — estado da oficina**

- cronômetros rodando × gente disponível
- tira das 6 vagas (ocupação e fila, **dentro do painel**)
- primeira folga de verdade

**Pé — uma única linha de dinheiro.**

O painel analítico de hoje **não se joga fora**: vira a aba "Revisão do mês".

A tela inicial deixa de ser `/patio` e passa a ser `/painel`.

### 3.3 O pátio — veredito honesto: não tenho

Dois dos cinco céticos derrubaram a análise do pátio. Um dos agentes nem
sabia que o 3D já tinha sido revertido, e tratou o pátio atual como planta
plana — quando ele já é inclinado em CSS. **A pesquisa não me deu base para
decidir.**

O que sobreviveu: o **OficinaTop coloca ocupação e fila como bloco dentro do
painel**, não como tela separada. Isso é compatível com o que o próprio dono
disse — *"a ideia do pátio é só uma visão rápida, ver se está cheio"*.

**Posição, para ele contestar:** a tira de ocupação vai para o painel; o pátio
continua existindo como tela só se tiver uma função que a tira não cobre —
mover carro de vaga e arrumar a planta. Se não for usado para isso, é tela a
menos.

---

## 4. O diferencial

Não é preço, não é pátio, não é quadro kanban. **Já está no código e ninguém
está usando.**

O sistema tem um leitor de relatório de scanner Autel que vira dado
estruturado — módulo, parâmetro, valor, mínimo, máximo, unidade, e a marca de
quem saiu da faixa — e uma wiki por marca/modelo/motor/faixa de ano, ligada ao
veículo, à OS e à leitura.

**Nenhum concorrente faz isso.** Shopmonkey, Tekmetric, Oficina Digital — são
sistemas de cobrança com fluxo em cima. Registram o que aconteceu para
faturar. Nenhum lê o carro.

**O diferencial é: a oficina que lembra.**

- Abriu OS de um modelo com um sintoma → *neste modelo, nas últimas N vezes
  aqui: estas peças, estas horas reais, e foi isto que deu errado.*
- A estimativa de horas deixa de vir do catálogo e passa a vir do **histórico
  medido desta oficina**.
- A leitura do scanner deixa de ser PDF anexado e vira fato procurável.

Cresce sozinho com o uso, é dos carros e dos clientes **deles**, e não se
copia baixando preço.

E passa na régua do próprio dono — *"precisa mesmo disso?"*: encurta o
**diagnóstico**, que é a parte cara e imprevisível do serviço.

---

## 5. Ordem de execução

**Agora, sem depender de resposta de ninguém**

1. Direção visual aplicada: uma cor de acento, tinta azulada, raio 6px, cor
   só como severidade. Mantendo Archivo/Inter e as configurações.
2. `/painel` como tela inicial, nas três faixas. Analítico vira aba.
3. Etapa 2 enxuta: tirar preço e "comprar/tem" do mecânico, e o aviso de peça
   parecida.

**Depois, conforme o fluxo já combinado em [FLUXO.md](FLUXO.md)**

4. Cadastro de fornecedores → tela de cotação → mão de obra → aprovação com
   WhatsApp → agendar execução → etapa de serviço.

**Fiscal, em paralelo e sem bloquear o resto**

5. Testar o Emissor Nacional em produção restrita (de graça, hoje).
6. Fechar fornecedor **depois** de avaliar Brasil NFe e ACBr API.
7. Escrever a emissão atrás de uma interface própria — trocar de fornecedor
   sem mexer no resto do sistema. E a trava de ambiente é nossa, não deles.

**Regra que vale para tudo, dita pelo dono:** cada coisa precisa responder
*por que existe*. Se não responde, não entra.
