-- De quem a oficina compra peca.
--
-- Existe por causa da cotacao: a secretaria liga para tres lugares, anota o
-- preco de cada um e escolhe. Sem cadastro, o nome era digitado de novo a cada
-- peca, e "Auto Pecas Silva", "autopecas silva" e "Silva" viravam tres
-- fornecedores diferentes na hora de comparar o historico de preco.
--
-- Quase tudo e opcional de proposito: o que a oficina tem na mao no comeco e
-- um nome e um telefone. Exigir CNPJ e endereco so faria o cadastro ficar
-- vazio e a secretaria continuar anotando no papel.

create table fornecedor (
    id                  uuid primary key,
    oficina_id          uuid not null references oficina (id),
    nome                varchar(180) not null,
    especialidade       varchar(200),
    telefone            varchar(40),
    -- so digitos: o link do WhatsApp nao aceita parentese nem traco, e
    -- normalizar na entrada evita adivinhar na hora de montar o link
    whatsapp            varchar(40),
    email               varchar(180),
    cnpj                varchar(20),
    cidade              varchar(120),
    -- quantos dias costuma levar. Nao e promessa: e a media do que ja
    -- aconteceu, e serve para a cotacao mostrar "mais barato, chega depois"
    prazo_dias_tipico   integer,
    observacao          varchar(500),
    ativo               boolean not null default true,
    criado_em           timestamptz not null default now(),
    criado_por          varchar(180),
    atualizado_em       timestamptz,
    atualizado_por      varchar(180)
);

create index ix_fornecedor_oficina on fornecedor (oficina_id, nome);
