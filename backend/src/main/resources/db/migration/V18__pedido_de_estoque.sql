-- Pedido de peca para a prateleira, sem carro nenhum.
--
-- "Acabou o filtro, compra 10" nao tinha onde existir: `peca_os` exige OS
-- (`ordem_servico_id` e NOT NULL com FK), entao repor estoque obrigaria
-- alguem a inventar uma OS.
--
-- Tabela propria e nao afrouxar a FK de `peca_os`, por tres motivos:
--
-- 1. Todas as rotas de escrita de peca sao `/api/os/{osId}/pecas/...`. Peca
--    sem OS nao tem URL — precisaria de endpoints paralelos de qualquer jeito,
--    e o "reuso" seria so o da tabela.
-- 2. `montarPendente` desreferencia a OS em cinco pontos: numero, placa, nome
--    do cliente e as duas datas de onde sai o prazo.
-- 3. `momentoNecessario` (INICIO/DURANTE) so tem sentido contra a agenda de um
--    carro. Pedido de prateleira carregaria um campo de enfeite para sempre.
--
-- E, mais importante: a fila de compras ordena por urgencia derivada do carro,
-- e `comprarAte` nulo vai para o TOPO porque significa carro parado sem dia
-- marcado. Um pedido de prateleira entrando nessa lista pularia na frente de
-- carro parado — o contrario do certo. Sao duas listas.
create table pedido_estoque (
    id uuid primary key,
    oficina_id uuid not null references oficina (id),
    -- Nulo = peca que ainda nao esta no catalogo; vale pela descricao, como
    -- acontece com peca avulsa em peca_os.
    peca_catalogo_id uuid references peca_catalogo (id),
    descricao varchar(200) not null,
    quantidade numeric(10, 2) not null default 1,
    fornecedor varchar(160),
    status varchar(20) not null default 'SOLICITADA',
    previsao_chegada date,
    valor_unitario numeric(12, 2),
    observacao varchar(400),
    criado_em timestamptz,
    criado_por varchar(180),
    atualizado_em timestamptz,
    atualizado_por varchar(180),
    -- Reusa o vocabulario de StatusPeca; APLICADA nunca acontece aqui, porque
    -- peca de prateleira nao vai para carro nenhum ao chegar.
    constraint ck_pedido_estoque_status check (status in
        ('SOLICITADA', 'COMPRADA', 'RECEBIDA', 'CANCELADA'))
);

create index ix_pedido_estoque_oficina on pedido_estoque (oficina_id, status);
