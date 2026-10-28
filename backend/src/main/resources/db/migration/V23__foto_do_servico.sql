-- ---------------------------------------------------------------------------
-- A foto deixa de ser "da OS" e passa a ser "deste servico".
--
-- A foto sempre existiu, mas presa a ordem inteira. Num carro com cinco
-- servicos isso nao responde a pergunta que o cliente faz: "e a correia,
-- como ficou?". Quatro fotos de motor aberto, nenhuma com nome.
--
-- Por que nulavel: a foto de ENTRADA e do carro, nao de servico nenhum --
-- ela e tirada antes de existir servico. E a foto de SAIDA e do carro
-- pronto. Forcar um servico ali seria inventar um dono para a foto.
--
-- on delete set null: apagar um servico lancado errado nao pode levar
-- embora a foto do motor aberto. A foto perde o rotulo e volta a ser do
-- carro, que e exatamente o que ela era antes desta coluna existir.
-- ---------------------------------------------------------------------------
alter table arquivo_os
    add column if not exists os_item_id uuid references os_item (id) on delete set null;

create index if not exists ix_arquivo_os_item on arquivo_os (os_item_id);

comment on column arquivo_os.os_item_id is
    'De qual servico da OS esta foto e. Nulo = foto do carro (entrada, saida, '
    'ou anexo geral da ordem).';
