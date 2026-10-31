-- Varios precos por peca, e nao um.
--
-- A secretaria liga para tres lugares. Guardar so o escolhido joga fora
-- exatamente a informacao que faz a proxima negociacao: "na vez passada o
-- Silva cobrou 180 e o Souza 210".
--
-- O preco escolhido continua sendo COPIADO para peca_os.valor_unitario e
-- peca_os.fornecedor. Nao e duplicacao por descuido: o total do orcamento ja
-- sai de peca_os e continua saindo de la, entao nada do que existe precisou
-- mudar. Esta tabela e o historico; peca_os e a decisao.

create table cotacao_peca (
    id               uuid primary key,
    oficina_id       uuid not null references oficina (id),
    peca_os_id       uuid not null references peca_os (id) on delete cascade,
    -- null quando foi um lugar avulso, fora do cadastro
    fornecedor_id    uuid references fornecedor (id),
    -- o nome no instante da cotacao: se o cadastro for renomeado ou apagado,
    -- a cotacao de seis meses atras ainda precisa dizer de quem era o preco
    fornecedor_nome  varchar(180) not null,
    valor_unitario   numeric(12, 2) not null,
    prazo_dias       integer,
    observacao       varchar(300),
    escolhida        boolean not null default false,
    criado_em        timestamptz not null default now(),
    criado_por       varchar(180),
    atualizado_em    timestamptz,
    atualizado_por   varchar(180)
);

create index ix_cotacao_peca on cotacao_peca (peca_os_id);

-- No maximo uma escolhida por peca. A regra vive no banco porque duas
-- escolhidas fariam o orcamento depender de qual veio primeiro na consulta.
create unique index ux_cotacao_escolhida
    on cotacao_peca (peca_os_id) where escolhida;
