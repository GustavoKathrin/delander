-- =====================================================================
-- A ferramenta passou a se chamar Delander.
-- So troca quem ainda esta com o nome de fabrica: se a oficina ja
-- personalizou o nome, o valor dela e preservado.
-- =====================================================================

update configuracao
   set valor = 'Delander',
       atualizado_em = now(),
       atualizado_por = 'sistema'
 where chave = 'app.nome_oficina'
   and valor = 'Oficina Flow';

update oficina
   set nome = 'Delander',
       atualizado_em = now(),
       atualizado_por = 'sistema'
 where nome = 'Oficina Flow';
