-- =====================================================================
-- Delander - o orcamento aprovado vira um estado de verdade
--
-- O fluxo pedido pela oficina e: agenda -> diagnostico -> orcamento ->
-- aprovacao do cliente -> execucao. Faltava o degrau entre "o cliente
-- aprovou" e "o mecanico comecou": sem ele, aprovar tinha que jogar o
-- carro direto em EM_EXECUCAO, e a OS passava a mentir — dizia que havia
-- alguem trabalhando no carro quando ele so estava liberado para comecar.
--
-- Tambem guardamos QUEM respondeu pelo cliente e QUANDO. Aprovacao de
-- orcamento e dinheiro: seis meses depois, "voce autorizou" e uma
-- conversa que precisa de data e nome, nao de memoria.
-- =====================================================================

alter table ordem_servico drop constraint ck_os_status;

alter table ordem_servico add constraint ck_os_status check (status in
    ('RECEBIDO', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'ORCAMENTO_APROVADO',
     'AGENDADO', 'EM_EXECUCAO', 'PAUSADO', 'PRONTO_AGUARDANDO_RETIRADA',
     'ENTREGUE', 'CANCELADO'));

alter table ordem_servico add column if not exists orcamento_respondido_em timestamptz;
alter table ordem_servico add column if not exists orcamento_respondido_por varchar(120);
-- Guarda o "nao" tambem: orcamento reprovado e informacao de negocio (o
-- preco espantou o cliente), e apagar isso esconde o motivo da perda.
alter table ordem_servico add column if not exists orcamento_recusa_motivo varchar(300);

comment on column ordem_servico.orcamento_respondido_em is
    'Quando o cliente respondeu ao orcamento (aprovando ou recusando).';
