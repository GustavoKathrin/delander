-- Numeracao por oficina, numa tabela que a nota fiscal vai reusar.
--
-- Hoje o numero da OS sai de `os_numero_seq`, uma sequence GLOBAL (V1:184),
-- enquanto a constraint e `unique (oficina_id, numero)`. Com uma oficina so,
-- inofensivo. Com duas, os numeros intercalam: a oficina A ve 1000, 1002, 1005
-- e nunca entende o que aconteceu com 1001 — que foi para a oficina B.
--
-- A tabela nasce agora, e nao junto com a nota fiscal, por um motivo: numeracao
-- fiscal e o mesmo problema com consequencia pior. A SEFAZ rejeita numero
-- repetido, e numero que faltou exige pedido de inutilizacao. Consertar aqui,
-- onde o erro so confunde, e o ensaio de onde o erro custa dinheiro.
--
-- `serie` nao serve para nada na OS e fica em 1. Ela existe desde ja porque
-- nota fiscal e numerada por serie, e acrescentar coluna a uma tabela de
-- numeracao depois de haver nota emitida e a migration que ninguem quer
-- escrever.
create table sequencia (
    oficina_id uuid not null references oficina (id),
    tipo varchar(20) not null,
    serie integer not null default 1,
    -- O proximo a entregar, nao o ultimo entregue: evita o "zero ou um"
    -- na primeira alocacao.
    proximo bigint not null,
    atualizado_em timestamptz not null default now(),
    primary key (oficina_id, tipo, serie)
);

-- Cada oficina continua de onde estava, em vez de voltar para 1000 e colidir
-- com o que ja existe. O `999 + 1` para quem nao tem OS nenhuma reproduz o
-- `start with 1000` da sequence antiga.
insert into sequencia (oficina_id, tipo, serie, proximo)
select o.id, 'OS', 1, coalesce(max(os.numero), 999) + 1
  from oficina o
  left join ordem_servico os on os.oficina_id = o.id
 group by o.id;

-- A sequence antiga fica onde esta. Derrubar agora nao ganha nada, e um
-- rollback ficaria sem para onde voltar justamente no caminho que cria OS.

-- Trava de concorrencia no catalogo de pecas.
--
-- Duas baixas simultaneas na mesma peca liam o mesmo saldo e uma sobrescrevia
-- a outra: o estoque perdia a baixa de quem gravou primeiro, em silencio.
-- Nenhuma entidade do projeto tinha @Version. Aqui a disputa e real, porque
-- duas pessoas mexem na mesma prateleira ao mesmo tempo — e e o saldo que a
-- Etapa 3 vai transformar em consequencia de movimento, entao ele precisa
-- estar certo antes.
alter table peca_catalogo add column if not exists versao bigint not null default 0;
