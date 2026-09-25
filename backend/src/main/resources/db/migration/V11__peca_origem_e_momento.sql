-- =====================================================================
-- Delander - a peca ganha origem e momento
--
-- Ate aqui toda peca era igual: o kit de embreagem que trava o carro no
-- elevador aparecia na mesma lista, na mesma cor, que o filtro que so
-- entra no fim do servico. Faltavam as duas coisas que dao sentido ao
-- resto:
--
--   origem             de onde ela vem — ja temos na prateleira, ou alguem
--                      precisa ir atras? So a segunda vira fila de compra.
--
--   momento_necessario quando ela faz falta. Nao e uma data que alguem
--                      digita: e "trava o inicio" ou "preciso antes de
--                      terminar". O prazo o sistema deriva da agenda do
--                      carro — a peca herda a urgencia de quem a espera.
--
-- Retrocompatibilidade: as pecas que ja existem viram COMPRAR + DURANTE,
-- que e exatamente o comportamento de hoje — continuam na fila e nao
-- travam nada. Ninguem abre o sistema amanha e acha que peca sumiu.
-- =====================================================================

alter table peca_os add column if not exists origem varchar(20) not null default 'COMPRAR';
alter table peca_os add column if not exists momento_necessario varchar(20) not null default 'DURANTE';

alter table peca_os add constraint ck_peca_origem
    check (origem in ('ESTOQUE', 'COMPRAR'));

alter table peca_os add constraint ck_peca_momento
    check (momento_necessario in ('INICIO', 'DURANTE'));

-- A fila de compras vai virar tela de trabalho diario, e hoje a consulta
-- que a alimenta (oficina + status) nao tem indice nenhum: varre a tabela.
create index if not exists ix_peca_fila on peca_os (oficina_id, origem, status);

comment on column peca_os.origem is
    'ESTOQUE = ja temos na oficina (entra so no orcamento). COMPRAR = entra na fila de compras.';
comment on column peca_os.momento_necessario is
    'INICIO = sem ela o servico nao comeca. DURANTE = da para comecar, precisa antes de terminar.';
