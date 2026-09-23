-- =====================================================================
-- Oficina Flow - schema inicial
-- Toda tabela de dominio carrega oficina_id (preparado para multi-oficina)
-- e colunas de auditoria (criado_em/criado_por/atualizado_em/atualizado_por).
-- =====================================================================

create table oficina (
    id              uuid primary key,
    nome            varchar(160) not null,
    logo_url        varchar(500),
    telefone        varchar(30),
    endereco        varchar(300),
    criado_em       timestamptz not null default now(),
    criado_por      varchar(180),
    atualizado_em   timestamptz,
    atualizado_por  varchar(180)
);

create table usuario (
    id              uuid primary key,
    oficina_id      uuid not null references oficina (id),
    nome            varchar(160) not null,
    email           varchar(180) not null,
    senha_hash      varchar(120) not null,
    papel           varchar(20)  not null,
    ativo           boolean      not null default true,
    criado_em       timestamptz  not null default now(),
    criado_por      varchar(180),
    atualizado_em   timestamptz,
    atualizado_por  varchar(180),
    constraint uk_usuario_email unique (email),
    constraint ck_usuario_papel check (papel in ('DONO', 'GERENTE', 'RECEPCAO', 'MECANICO'))
);

create table refresh_token (
    id          uuid primary key,
    usuario_id  uuid        not null references usuario (id) on delete cascade,
    token_hash  varchar(64) not null,
    expira_em   timestamptz not null,
    revogado    boolean     not null default false,
    criado_em   timestamptz not null default now(),
    constraint uk_refresh_token unique (token_hash)
);

-- ------------------------------ cadastros ---------------------------

create table especialidade (
    id              uuid primary key,
    oficina_id      uuid not null references oficina (id),
    nome            varchar(80) not null,
    cor             varchar(20) not null default '#64748b',
    ativo           boolean     not null default true,
    criado_em       timestamptz not null default now(),
    criado_por      varchar(180),
    atualizado_em   timestamptz,
    atualizado_por  varchar(180),
    constraint uk_especialidade_nome unique (oficina_id, nome)
);

create table box (
    id              uuid primary key,
    oficina_id      uuid not null references oficina (id),
    nome            varchar(60) not null,
    tipo            varchar(20) not null default 'BOX',
    ativo           boolean     not null default true,
    criado_em       timestamptz not null default now(),
    criado_por      varchar(180),
    atualizado_em   timestamptz,
    atualizado_por  varchar(180),
    constraint uk_box_nome unique (oficina_id, nome),
    constraint ck_box_tipo check (tipo in ('ELEVADOR', 'BOX', 'PATIO'))
);

create table motivo_parada (
    id                      uuid primary key,
    oficina_id              uuid not null references oficina (id),
    nome                    varchar(100) not null,
    categoria               varchar(20)  not null,
    bloqueia_execucao       boolean      not null default true,
    visivel_cliente_padrao  boolean      not null default false,
    ativo                   boolean      not null default true,
    criado_em               timestamptz  not null default now(),
    criado_por              varchar(180),
    atualizado_em           timestamptz,
    atualizado_por          varchar(180),
    constraint uk_motivo_parada_nome unique (oficina_id, nome),
    constraint ck_motivo_categoria check (categoria in
        ('PECA', 'APROVACAO', 'TERCEIRO', 'CLIENTE', 'INTERNO', 'PAGAMENTO'))
);

create table catalogo_servico (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    descricao         varchar(200) not null,
    especialidade_id  uuid references especialidade (id),
    horas_padrao      numeric(6, 2) not null default 1,
    preco_sugerido    numeric(12, 2),
    ativo             boolean       not null default true,
    criado_em         timestamptz   not null default now(),
    criado_por        varchar(180),
    atualizado_em     timestamptz,
    atualizado_por    varchar(180),
    constraint uk_catalogo_descricao unique (oficina_id, descricao)
);

create table funcionario (
    id              uuid primary key,
    oficina_id      uuid not null references oficina (id),
    usuario_id      uuid references usuario (id),
    nome            varchar(160)  not null,
    telefone        varchar(30),
    horas_por_dia   numeric(5, 2) not null default 8,
    custo_hora      numeric(12, 2),
    ativo           boolean       not null default true,
    criado_em       timestamptz   not null default now(),
    criado_por      varchar(180),
    atualizado_em   timestamptz,
    atualizado_por  varchar(180),
    constraint uk_funcionario_usuario unique (usuario_id)
);

create table funcionario_especialidade (
    funcionario_id    uuid not null references funcionario (id) on delete cascade,
    especialidade_id  uuid not null references especialidade (id) on delete cascade,
    primary key (funcionario_id, especialidade_id)
);

-- ------------------------------ clientes ----------------------------

create table cliente (
    id                           uuid primary key,
    oficina_id                   uuid not null references oficina (id),
    nome                         varchar(160) not null,
    documento                    varchar(30),
    telefone                     varchar(30),
    email                        varchar(180),
    observacoes                  text,
    consentimento_contato        boolean not null default false,
    compartilhamento_habilitado  boolean,
    escopo_compartilhamento      jsonb,
    anonimizado                  boolean not null default false,
    ativo                        boolean not null default true,
    criado_em                    timestamptz not null default now(),
    criado_por                   varchar(180),
    atualizado_em                timestamptz,
    atualizado_por               varchar(180)
);
create index ix_cliente_nome on cliente (oficina_id, lower(nome));
create index ix_cliente_telefone on cliente (oficina_id, telefone);
create index ix_cliente_documento on cliente (oficina_id, documento);

create table veiculo (
    id              uuid primary key,
    oficina_id      uuid not null references oficina (id),
    cliente_id      uuid not null references cliente (id),
    placa           varchar(10) not null,
    marca           varchar(60),
    modelo          varchar(80),
    ano             integer,
    cor             varchar(40),
    km              integer,
    chassi          varchar(40),
    observacoes     text,
    ativo           boolean     not null default true,
    criado_em       timestamptz not null default now(),
    criado_por      varchar(180),
    atualizado_em   timestamptz,
    atualizado_por  varchar(180),
    constraint uk_veiculo_placa unique (oficina_id, placa)
);
create index ix_veiculo_cliente on veiculo (cliente_id);

create table veiculo_proprietario_hist (
    id          uuid primary key,
    veiculo_id  uuid not null references veiculo (id) on delete cascade,
    cliente_id  uuid not null references cliente (id),
    inicio      timestamptz not null default now(),
    fim         timestamptz
);
create index ix_veiculo_hist on veiculo_proprietario_hist (veiculo_id);

-- ------------------------------ ordem de servico --------------------

create sequence os_numero_seq start with 1000 increment by 1;

create table ordem_servico (
    id                    uuid primary key,
    oficina_id            uuid   not null references oficina (id),
    numero                bigint not null,
    cliente_id            uuid   not null references cliente (id),
    veiculo_id            uuid   not null references veiculo (id),
    queixa                text,
    diagnostico           text,
    prioridade            varchar(20) not null default 'NORMAL',
    status                varchar(30) not null,
    box_id                uuid references box (id),
    data_agendada         date,
    previsao_entrega      date,
    km_entrada            integer,
    entrada_em            timestamptz not null default now(),
    aprovado_em           timestamptz,
    inicio_execucao_em    timestamptz,
    pronto_em             timestamptz,
    entregue_em           timestamptz,
    cancelado_em          timestamptz,
    motivo_cancelamento   varchar(300),
    valor_pecas           numeric(12, 2) not null default 0,
    valor_mao_obra        numeric(12, 2) not null default 0,
    desconto              numeric(12, 2) not null default 0,
    criado_em             timestamptz not null default now(),
    criado_por            varchar(180),
    atualizado_em         timestamptz,
    atualizado_por        varchar(180),
    constraint uk_os_numero unique (oficina_id, numero),
    constraint ck_os_prioridade check (prioridade in ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE')),
    constraint ck_os_status check (status in
        ('RECEBIDO', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'AGENDADO', 'EM_EXECUCAO',
         'PAUSADO', 'PRONTO_AGUARDANDO_RETIRADA', 'ENTREGUE', 'CANCELADO'))
);
create index ix_os_status on ordem_servico (oficina_id, status);
create index ix_os_data_agendada on ordem_servico (oficina_id, data_agendada);
create index ix_os_veiculo on ordem_servico (veiculo_id);
create index ix_os_cliente on ordem_servico (cliente_id);

create table os_item (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    ordem_servico_id  uuid not null references ordem_servico (id) on delete cascade,
    descricao         varchar(240)  not null,
    especialidade_id  uuid references especialidade (id),
    horas_estimadas   numeric(6, 2) not null default 1,
    funcionario_id    uuid references funcionario (id),
    status            varchar(20)   not null default 'PENDENTE',
    valor             numeric(12, 2),
    ordem             integer       not null default 0,
    criado_em         timestamptz   not null default now(),
    criado_por        varchar(180),
    atualizado_em     timestamptz,
    atualizado_por    varchar(180),
    constraint ck_os_item_status check (status in
        ('PENDENTE', 'EM_EXECUCAO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO'))
);
create index ix_os_item_os on os_item (ordem_servico_id);
create index ix_os_item_funcionario on os_item (funcionario_id, status);

create table apontamento (
    id                          uuid primary key,
    oficina_id                  uuid not null references oficina (id),
    ordem_servico_id            uuid not null references ordem_servico (id) on delete cascade,
    os_item_id                  uuid not null references os_item (id) on delete cascade,
    funcionario_id              uuid not null references funcionario (id),
    inicio                      timestamptz not null,
    fim                         timestamptz,
    horas_estimadas_informadas  numeric(6, 2),
    observacao                  varchar(400),
    encerrado_automaticamente   boolean not null default false,
    criado_em                   timestamptz not null default now(),
    criado_por                  varchar(180),
    atualizado_em               timestamptz,
    atualizado_por              varchar(180)
);
create index ix_apontamento_os on apontamento (ordem_servico_id);
create index ix_apontamento_funcionario on apontamento (funcionario_id, inicio);
-- um item nunca pode ter dois apontamentos abertos ao mesmo tempo
create unique index uk_apontamento_aberto_item on apontamento (os_item_id) where fim is null;

create table parada (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    ordem_servico_id  uuid not null references ordem_servico (id) on delete cascade,
    motivo_parada_id  uuid not null references motivo_parada (id),
    inicio            timestamptz not null,
    fim               timestamptz,
    descricao         varchar(400),
    visivel_cliente   boolean not null default false,
    criado_em         timestamptz not null default now(),
    criado_por        varchar(180),
    atualizado_em     timestamptz,
    atualizado_por    varchar(180)
);
create index ix_parada_os on parada (ordem_servico_id);
create unique index uk_parada_aberta on parada (ordem_servico_id) where fim is null;

create table peca_os (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    ordem_servico_id  uuid not null references ordem_servico (id) on delete cascade,
    descricao         varchar(200)  not null,
    quantidade        numeric(10, 2) not null default 1,
    fornecedor        varchar(160),
    status            varchar(20)   not null default 'SOLICITADA',
    previsao_chegada  date,
    valor_unitario    numeric(12, 2),
    criado_em         timestamptz   not null default now(),
    criado_por        varchar(180),
    atualizado_em     timestamptz,
    atualizado_por    varchar(180),
    constraint ck_peca_status check (status in
        ('SOLICITADA', 'COMPRADA', 'RECEBIDA', 'APLICADA', 'CANCELADA'))
);
create index ix_peca_os on peca_os (ordem_servico_id);

create table checklist_item (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    ordem_servico_id  uuid not null references ordem_servico (id) on delete cascade,
    descricao         varchar(200) not null,
    ok                boolean,
    observacao        varchar(300),
    ordem             integer not null default 0
);
create index ix_checklist_os on checklist_item (ordem_servico_id);

create table arquivo_os (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    ordem_servico_id  uuid not null references ordem_servico (id) on delete cascade,
    nome_original     varchar(200) not null,
    caminho           varchar(300) not null,
    content_type      varchar(100),
    tamanho           bigint,
    momento           varchar(20) not null default 'EXECUCAO',
    visivel_cliente   boolean not null default false,
    criado_em         timestamptz not null default now(),
    criado_por        varchar(180),
    constraint ck_arquivo_momento check (momento in ('ENTRADA', 'EXECUCAO', 'SAIDA'))
);
create index ix_arquivo_os on arquivo_os (ordem_servico_id);

create table evento_os (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    ordem_servico_id  uuid not null references ordem_servico (id) on delete cascade,
    tipo              varchar(60) not null,
    descricao         varchar(400),
    dados             jsonb,
    autor             varchar(180),
    visivel_cliente   boolean not null default true,
    criado_em         timestamptz not null default now()
);
create index ix_evento_os on evento_os (ordem_servico_id, criado_em);

-- ------------------------------ compartilhamento --------------------

create table compartilhamento_os (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    ordem_servico_id  uuid not null references ordem_servico (id) on delete cascade,
    -- token_hash e a chave de busca; token guarda o valor para o dono reenviar
    -- o mesmo link ao cliente sem invalidar o que ja foi compartilhado.
    token_hash        varchar(64) not null,
    token             varchar(64) not null,
    escopo            jsonb,
    pin               varchar(10),
    expira_em         timestamptz,
    ativo             boolean not null default true,
    total_acessos     integer not null default 0,
    ultimo_acesso_em  timestamptz,
    criado_em         timestamptz not null default now(),
    criado_por        varchar(180),
    atualizado_em     timestamptz,
    atualizado_por    varchar(180),
    constraint uk_compartilhamento_token unique (token_hash)
);
create index ix_compartilhamento_os on compartilhamento_os (ordem_servico_id);

create table acesso_compartilhamento (
    id                   uuid primary key,
    compartilhamento_id  uuid not null references compartilhamento_os (id) on delete cascade,
    quando               timestamptz not null default now(),
    ip                   varchar(60),
    user_agent           varchar(300)
);
create index ix_acesso_compartilhamento on acesso_compartilhamento (compartilhamento_id, quando);

-- ------------------------------ configuracao ------------------------

create table configuracao (
    id              uuid primary key,
    oficina_id      uuid not null references oficina (id),
    chave           varchar(100) not null,
    valor           text,
    tipo            varchar(20)  not null,
    grupo           varchar(40)  not null,
    atualizado_em   timestamptz,
    atualizado_por  varchar(180),
    constraint uk_configuracao_chave unique (oficina_id, chave),
    constraint ck_configuracao_tipo check (tipo in ('BOOLEAN', 'INTEIRO', 'DECIMAL', 'TEXTO', 'JSON', 'HORA'))
);
