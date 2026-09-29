-- A parada passa a saber de qual servico ela e.
--
-- Ate aqui existia no maximo UMA parada aberta por OS, garantida por indice
-- unico. O efeito pratico: dois mecanicos pausando dois servicos do mesmo
-- carro, com motivos diferentes, e o motivo do segundo era jogado fora em
-- silencio — o codigo so gravava a parada se nao houvesse outra aberta.
--
-- Isso era raro enquanto pausar exigia ir ao Painel do mecanico. Com o botao
-- de pausar na linha do servico, pausar servico a servico vira rotina do
-- balcao. Seria entregar um botao cujo proposito e registrar o motivo e que
-- descarta o motivo na metade dos casos.
alter table parada add column if not exists os_item_id uuid references os_item (id) on delete cascade;
create index if not exists ix_parada_item on parada (os_item_id);

-- O indice unico vira dois, e a diferenca entre eles e o que separa as duas
-- coisas que "parada" quer dizer:
--
--   os_item_id preenchido -> este SERVICO esta travado (esperando peca, etc.)
--   os_item_id nulo       -> o CARRO inteiro esta parado (a OS foi pausada)
--
-- As duas convivem: um carro pode estar parado por falta de aprovacao e ainda
-- ter um servico especifico esperando peca.
drop index if exists uk_parada_aberta;

create unique index if not exists uk_parada_aberta_item on parada (os_item_id)
    where fim is null and os_item_id is not null;

create unique index if not exists uk_parada_aberta_os on parada (ordem_servico_id)
    where fim is null and os_item_id is null;

-- Sem backfill de proposito: nao da para saber de qual servico era cada
-- parada antiga, e chutar poluiria o historico do Pareto para sempre. As
-- linhas existentes ficam com os_item_id nulo, ou seja, continuam sendo
-- paradas do carro — que e exatamente o que elas eram.
