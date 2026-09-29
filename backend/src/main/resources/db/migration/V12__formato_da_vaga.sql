-- Formato da vaga no patio, escolhido pelo dono.
--
-- Nao existe um formato certo: oficina de cinco vagas quer ver a foto do
-- carro e o nome do mecanico; oficina de vinte quer tudo na tela de uma vez;
-- e quem usa o patio como planta quer a vaga do tamanho do espaco real.
--
-- CARTAO e o padrao porque e o que ja estava no ar — ninguem abre o sistema
-- amanha e acha que mexeram na tela dele.
insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), o.id, 'app.patio_formato', 'CARTAO', 'TEXTO', 'APARENCIA', now(), 'sistema'
  from oficina o
 where not exists (select 1 from configuracao x
                    where x.oficina_id = o.id and x.chave = 'app.patio_formato');
