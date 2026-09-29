-- Catalogo de pecas com saldo de estoque.
--
-- Ate aqui peca era texto livre na linha da OS: "kit de embreagem" digitado
-- de novo a cada carro, sem preco de referencia e sem nocao do que a oficina
-- tem na prateleira. O campo `origem = ESTOQUE` dizia "temos aqui" na palavra
-- do mecanico, e nada conferia.
--
-- O catalogo resolve as duas pontas: a peca passa a ter um cadastro (com
-- preco sugerido) e um saldo, que sobe quando uma compra chega e desce quando
-- a peca vai para um carro.
create table peca_catalogo (
    id uuid primary key,
    oficina_id uuid not null references oficina (id),
    codigo varchar(60),
    descricao varchar(200) not null,
    fabricante varchar(120),
    valor_sugerido numeric(12, 2),
    -- Fracionario porque oficina compra oleo em litro e junta em metro.
    quantidade_estoque numeric(10, 2) not null default 0,
    -- Abaixo disto a peca aparece como "acabando" para quem compra.
    estoque_minimo numeric(10, 2) not null default 0,
    ativo boolean not null default true,
    criado_em timestamptz,
    criado_por varchar(180),
    atualizado_em timestamptz,
    atualizado_por varchar(180),
    -- Saldo negativo nao existe: se a peca acabou, ela acabou. Sem isto um
    -- erro de baixa deixaria o catalogo dizendo "-3 na prateleira".
    constraint ck_peca_catalogo_estoque check (quantidade_estoque >= 0)
);

create index ix_peca_catalogo_oficina on peca_catalogo (oficina_id, ativo);

-- O codigo do fabricante e o jeito de nao cadastrar a mesma peca duas vezes.
-- Parcial porque codigo e opcional: peca sem codigo nao concorre com nenhuma.
create unique index ux_peca_catalogo_codigo on peca_catalogo (oficina_id, lower(codigo))
    where codigo is not null;

-- A linha da OS aponta para o catalogo quando a peca e de la.
--
-- Nullable de proposito, e assim continua: a peca avulsa — aquela que a
-- oficina comprou uma vez para um carro e nao quer no catalogo — segue valendo
-- pela descricao. Obrigar catalogo faria o mecanico cadastrar lixo para
-- conseguir registrar o que ele acabou de ver no carro.
alter table peca_os add column if not exists peca_catalogo_id uuid references peca_catalogo (id);
create index if not exists ix_peca_os_catalogo on peca_os (peca_catalogo_id);
