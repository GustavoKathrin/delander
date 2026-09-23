-- =====================================================================
-- Delander - planta do patio arrumavel e cores da oficina
--
-- A grade se arrumava sozinha em ordem alfabetica. Agora o dono arruma como
-- e o chao de verdade: agrupa, estica, move os elevadores.
--
-- Coluna e linha NULAS = sem layout salvo. Nesse caso o patio volta a se
-- arrumar sozinho, que e exatamente como esta hoje — ninguem abre o sistema
-- depois desta migration e acha que quebrou.
-- =====================================================================

alter table box add column layout_coluna  integer;
alter table box add column layout_linha   integer;
alter table box add column layout_largura integer not null default 1;
alter table box add column layout_altura  integer not null default 1;

alter table box add constraint ck_box_layout_posicao check (
    (layout_coluna is null and layout_linha is null)
    or (layout_coluna >= 1 and layout_linha >= 1));

alter table box add constraint ck_box_layout_tamanho check (
    layout_largura between 1 and 6 and layout_altura between 1 and 3);

-- ------------------------------ aparencia -----------------------------

insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), o.id, c.chave, c.valor, c.tipo, 'APARENCIA', now(), 'sistema'
  from oficina o
 cross join (values
    -- quantas colunas a planta tem; posicao explicita precisa de numero fixo
    ('app.patio_colunas', '6',       'INTEIRO'),
    -- cor principal: menu ativo, botoes, links
    ('app.cor_marca',     '#2563eb', 'TEXTO'),
    -- destaque: AGENDAR CARRO e a faixa de seguranca
    ('app.cor_destaque',  '#eab308', 'TEXTO')
 ) as c(chave, valor, tipo)
 where not exists (select 1 from configuracao x
                    where x.oficina_id = o.id and x.chave = c.chave);
