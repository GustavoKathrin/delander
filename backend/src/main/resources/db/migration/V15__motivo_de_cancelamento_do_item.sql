-- Por que este servico nao vai ser feito.
--
-- Cancelar servico nunca teve motivo: o DELETE nao tinha corpo e o evento
-- gerado era fixo ("Servico removido: X"). Quem abria a OS uma semana depois
-- via o servico riscado e nao tinha como saber se o cliente desistiu, se a
-- peca nao existe mais, ou se alguem lancou errado.
--
-- Coluna e nao so evento, pelo mesmo motivo que `ordem_servico` ja tem o par:
-- o motivo precisa ser lido NA LINHA do servico, na ficha impressa e no link
-- do cliente. So no evento, a tela teria que varrer a linha do tempo e casar
-- por pedaco do texto — o que quebra assim que alguem edita a descricao.
--
-- Mesmos nomes e mesmo tamanho de ordem_servico (V1:205-206), para quem
-- conhece um reconhecer o outro.
alter table os_item add column if not exists cancelado_em        timestamptz;
alter table os_item add column if not exists motivo_cancelamento varchar(300);
