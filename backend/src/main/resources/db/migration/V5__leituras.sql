-- =====================================================================
-- Delander - leituras do scanner
--
-- Achar o valor de MAP, MAF ou ECT de um Civic 2014 hoje significa plugar o
-- scanner de novo. O relatorio em PDF ja tem esses dados; aqui eles viram
-- tabela, ligados ao CARRO (placa) e ao MODELO (marca/modelo/ano/motor), que
-- e o que faz a leitura de um Civic servir para outro Civic.
--
-- Privacidade: de proposito NAO existe coluna para VIN, nome ou telefone do
-- cliente, nem numero de serie do aparelho. O que nao tem coluna nao vaza.
-- =====================================================================

-- O motor e o que a oficina procura junto com o modelo ("Civic 2.0 flex").
alter table veiculo add column motor varchar(60);

create table leitura (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    veiculo_id        uuid references veiculo (id),

    -- copia do modelo no momento da leitura: o carro pode ser recadastrado,
    -- e a leitura precisa continuar achavel por "Civic 2014"
    marca             varchar(60),
    modelo            varchar(80),
    ano               integer,
    motor             varchar(60),

    tipo              varchar(20)  not null default 'ANOMALIA',
    condicao          varchar(160),
    descricao         text,

    -- o que o PDF nao diz e so quem estava no carro sabe
    motor_ligado      boolean      not null default false,
    ignicao_ligada    boolean      not null default true,

    origem            varchar(10)  not null default 'MANUAL',
    situacao          varchar(20)  not null default 'COMPLETA',

    ferramenta        varchar(120),
    ferramenta_versao varchar(40),
    numero_relatorio  varchar(60),
    momento_teste     timestamptz,
    km                integer,

    ordem_servico_id  uuid references ordem_servico (id) on delete set null,

    criado_em         timestamptz not null default now(),
    criado_por        varchar(180),
    atualizado_em     timestamptz,
    atualizado_por    varchar(180),

    constraint ck_leitura_tipo     check (tipo in ('OFICIAL', 'ANOMALIA')),
    constraint ck_leitura_origem   check (origem in ('PDF', 'MANUAL', 'EMAIL')),
    constraint ck_leitura_situacao check (situacao in ('PENDENTE', 'COMPLETA')),
    -- so leitura pendente (entrada automatica) pode estar sem carro
    constraint ck_leitura_veiculo  check (situacao = 'PENDENTE' or veiculo_id is not null),
    -- anomalia sem condicao nao serve para nada: "leitura ruim" nao e informacao
    constraint ck_leitura_anomalia check (situacao = 'PENDENTE' or tipo <> 'ANOMALIA'
                                          or condicao is not null)
);

create index ix_leitura_veiculo  on leitura (veiculo_id, tipo);
create index ix_leitura_busca    on leitura (oficina_id, lower(marca), lower(modelo), ano);
create index ix_leitura_pendente on leitura (oficina_id) where situacao = 'PENDENTE';

-- Exatamente UMA leitura oficial por carro, garantida pelo banco.
create unique index uk_leitura_oficial on leitura (veiculo_id)
    where tipo = 'OFICIAL' and situacao = 'COMPLETA';

-- O mesmo relatorio do scanner nunca entra duas vezes.
create unique index uk_leitura_relatorio on leitura (oficina_id, numero_relatorio)
    where numero_relatorio is not null;

-- ------------------------------ modulos e itens -----------------------
-- Sem oficina_id e sem auditoria: sao filhos que so existem dentro de uma
-- leitura, como veiculo_proprietario_hist e acesso_compartilhamento na V1.

create table leitura_modulo (
    id          uuid primary key,
    leitura_id  uuid not null references leitura (id) on delete cascade,
    nome        varchar(80)  not null,
    caminho     varchar(400),
    ordem       integer      not null default 0
);
create index ix_leitura_modulo on leitura_modulo (leitura_id, ordem);

create table leitura_item (
    id                uuid primary key,
    leitura_modulo_id uuid not null references leitura_modulo (id) on delete cascade,
    ordem             integer not null default 0,
    -- o "NO." do relatorio; tem buracos (1, 2, 3, 5, 6...)
    numero            integer,
    nome              varchar(200) not null,
    -- texto: o scanner mostra "ON", "-", "Ligado" alem de numero
    valor             varchar(60),
    -- o mesmo valor em numero, quando da para converter, para comparar depois
    valor_num         numeric(14, 4),
    minimo            numeric(14, 4),
    maximo            numeric(14, 4),
    unidade           varchar(20)
);
create index ix_leitura_item      on leitura_item (leitura_modulo_id, ordem);
create index ix_leitura_item_nome on leitura_item (lower(nome));

-- ------------------------------ PDF de origem -------------------------
-- arquivo_os exige ordem_servico_id, e leitura pode nao ter OS. Tabela
-- propria em vez de afrouxar aquela FK, que tem tres chamadores.

create table arquivo_leitura (
    id            uuid primary key,
    oficina_id    uuid not null references oficina (id),
    -- nulo = enviado na previa e ainda nao confirmado; um job limpa os orfaos
    leitura_id    uuid references leitura (id) on delete cascade,
    nome_original varchar(200) not null,
    caminho       varchar(300) not null,
    content_type  varchar(100),
    tamanho       bigint,
    criado_em     timestamptz not null default now(),
    criado_por    varchar(180)
);
create index ix_arquivo_leitura       on arquivo_leitura (leitura_id);
create index ix_arquivo_leitura_orfao on arquivo_leitura (criado_em) where leitura_id is null;
