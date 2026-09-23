-- =====================================================================
-- Delander - elevador como recurso de verdade
--
-- Ate aqui "Elevador 1" era so uma linha em box com tipo = 'ELEVADOR': o
-- sistema nao sabia que um carro PRECISA do elevador nem por quanto tempo.
-- A vaga e ocupada por DIA (o carro dorme na oficina); o elevador, nao —
-- um alinhamento de 1h nao pode travar o elevador das 8h as 18h. Dai a
-- reserva com horario e duracao.
-- =====================================================================

alter table ordem_servico    add column precisa_elevador boolean not null default false;
alter table catalogo_servico add column exige_elevador   boolean not null default false;

create index ix_os_precisa_elevador on ordem_servico (oficina_id)
    where precisa_elevador;

-- De qual servico do catalogo o item saiu. Sem isso nao da para somar quantas
-- horas de ELEVADOR a OS precisa (o item so copiava descricao, horas e valor).
-- De quebra, permite comparar no futuro a estimativa do catalogo com o tempo
-- que o servico realmente levou.
alter table os_item add column catalogo_servico_id uuid references catalogo_servico (id);
create index ix_os_item_catalogo on os_item (catalogo_servico_id);

-- ------------------------------ reserva do elevador -------------------

create table reserva_elevador (
    id                uuid primary key,
    oficina_id        uuid not null references oficina (id),
    box_id            uuid not null references box (id),
    ordem_servico_id  uuid not null references ordem_servico (id) on delete cascade,
    inicio_previsto   timestamptz   not null,
    horas_previstas   numeric(6, 2) not null default 1,
    inicio_real       timestamptz,
    fim_real          timestamptz,
    status            varchar(20)   not null default 'RESERVADO',
    observacao        varchar(300),
    criado_em         timestamptz   not null default now(),
    criado_por        varchar(180),
    atualizado_em     timestamptz,
    atualizado_por    varchar(180),
    constraint ck_reserva_elevador_status
        check (status in ('RESERVADO', 'EM_USO', 'CONCLUIDO', 'CANCELADO')),
    constraint ck_reserva_elevador_horas
        check (horas_previstas > 0)
);

-- UM carro por elevador por vez, garantido pelo banco e nao pelo servico.
-- Mesmo recurso que a V1 ja usa em uk_apontamento_aberto_item e uk_parada_aberta.
create unique index uk_elevador_em_uso on reserva_elevador (box_id)
    where status = 'EM_USO';

-- Uma OS nao pode ter duas reservas vivas ao mesmo tempo.
create unique index uk_reserva_elevador_os_viva on reserva_elevador (ordem_servico_id)
    where status in ('RESERVADO', 'EM_USO');

create index ix_reserva_elevador_agenda on reserva_elevador (oficina_id, inicio_previsto)
    where status in ('RESERVADO', 'EM_USO');

-- ------------------------------ parametro de quantidade ---------------

-- Nasce com a contagem real de elevadores da oficina, nao com um chute.
insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), o.id, 'capacidade.qtd_elevadores',
       (select count(*)::text
          from box b
         where b.oficina_id = o.id
           and b.tipo = 'ELEVADOR'
           and b.ativo),
       'INTEIRO', 'CAPACIDADE', now(), 'sistema'
  from oficina o
 where not exists (select 1
                     from configuracao c
                    where c.oficina_id = o.id
                      and c.chave = 'capacidade.qtd_elevadores');

-- ------------------------------ servicos que sobem o carro ------------

-- Padrao de fabrica apenas: quem sabe se o servico sobe o carro e a oficina,
-- e a marcacao e editavel no catalogo.
update catalogo_servico set exige_elevador = true
 where descricao in ('Troca de oleo e filtros',
                     'Revisao completa (30 itens)',
                     'Troca de pastilhas de freio',
                     'Troca de discos e pastilhas',
                     'Troca de amortecedores (par)',
                     'Alinhamento e balanceamento',
                     'Troca de embreagem',
                     'Troca de oleo do cambio automatico',
                     'Retifica de motor');
