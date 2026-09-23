-- =====================================================================
-- Delander - wiki da oficina
--
-- O livro da empresa: a solucao que deu certo num carro, escrita por quem
-- resolveu. Amarrada ao MODELO (para servir no proximo Civic 2014), e
-- opcionalmente ao carro, a OS onde apareceu e a leitura do scanner que
-- mostrou o sintoma.
-- =====================================================================

create table wiki_artigo (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    titulo            varchar(200) not null,
    corpo             text,

    -- a quem serve: modelo solto, para achar pelo carro do proximo cliente
    marca             varchar(60),
    modelo            varchar(80),
    motor             varchar(60),
    ano_de            integer,
    ano_ate           integer,
    tags              jsonb,

    -- de onde veio, quando veio de algum lugar
    veiculo_id        uuid references veiculo (id)        on delete set null,
    ordem_servico_id  uuid references ordem_servico (id)  on delete set null,
    leitura_id        uuid references leitura (id)        on delete set null,

    publicado         boolean     not null default true,
    criado_em         timestamptz not null default now(),
    criado_por        varchar(180),
    atualizado_em     timestamptz,
    atualizado_por    varchar(180),

    constraint ck_wiki_anos check (ano_de is null or ano_ate is null or ano_de <= ano_ate)
);

create index ix_wiki_modelo on wiki_artigo (oficina_id, lower(marca), lower(modelo));
create index ix_wiki_titulo on wiki_artigo (oficina_id, lower(titulo));
create index ix_wiki_tags   on wiki_artigo using gin (tags);

-- ------------------------------ fotos do artigo -----------------------
-- Mesma forma de arquivo_leitura, mais legenda e ordem. Sem oficina_id
-- duplicado seria impossivel autorizar o download sem carregar o artigo.

create table wiki_arquivo (
    id              uuid primary key,
    oficina_id      uuid not null references oficina (id),
    wiki_artigo_id  uuid references wiki_artigo (id) on delete cascade,
    nome_original   varchar(200) not null,
    caminho         varchar(300) not null,
    content_type    varchar(100),
    tamanho         bigint,
    legenda         varchar(300),
    ordem           integer     not null default 0,
    criado_em       timestamptz not null default now(),
    criado_por      varchar(180)
);
create index ix_wiki_arquivo       on wiki_arquivo (wiki_artigo_id, ordem);
create index ix_wiki_arquivo_orfao on wiki_arquivo (criado_em) where wiki_artigo_id is null;
