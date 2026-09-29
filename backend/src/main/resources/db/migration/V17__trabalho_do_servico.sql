-- O registro de trabalho passa a saber de qual servico ele fala.
--
-- "Tudo no carro e um servico, entao todo trabalho e em cima disso" — e o
-- registro nascia solto: um evento da OS, sem nenhuma ligacao com o item.
-- Na linha do tempo ele aparecia misturado com mudanca de status, atribuicao
-- e inicio de servico, sem dizer a que servico se referia. Com tres servicos
-- no mesmo carro, "desmontei a suspensao" nao dizia qual deles andou.
--
-- Nullable porque a maioria dos eventos continua sendo da OS inteira: recebeu
-- o veiculo, mudou de status, gerou link. So o trabalho e as acoes de servico
-- preenchem esta coluna.
alter table evento_os add column if not exists os_item_id uuid references os_item (id) on delete cascade;
create index if not exists ix_evento_item on evento_os (os_item_id);
