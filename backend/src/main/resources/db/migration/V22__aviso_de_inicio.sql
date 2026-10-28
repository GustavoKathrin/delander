-- ---------------------------------------------------------------------------
-- "Comecei o seu carro" -- agora ou depois.
--
-- O dono foi claro sobre o porque: quando o mecanico aceita o servico, as
-- vezes o aviso ao cliente deve sair na hora e as vezes nao. Se nao sair, o
-- cliente NAO pode ver a data em que o carro comecou a ser mexido. "Temos
-- que proteger sempre a oficina."
--
-- Por que uma coluna e nao so "nao emitir o evento": porque alguem precisa
-- lembrar que o aviso ficou pendente. Sem isto, "depois" vira "nunca" e o
-- cliente descobre o andamento do carro sozinho, ligando.
-- ---------------------------------------------------------------------------
alter table ordem_servico
    add column if not exists aviso_inicio_pendente boolean not null default false;

comment on column ordem_servico.aviso_inicio_pendente is
    'O servico comecou e o cliente ainda nao foi avisado, por escolha de quem iniciou. '
    'Enquanto for true, o evento de inicio nao vai para o link do cliente -- '
    'nem o evento, nem a data dentro dele.';
