-- Itens do checklist de entrada.
--
-- Ate agora o checklist so nascia se quem abria a OS mandasse a lista no
-- corpo da requisicao — e ninguem mandava. Resultado: a tabela sempre vazia,
-- a tela do checklist sempre escondida, e a trava de "nao inicia sem
-- checklist" nunca disparando, porque ela sai cedo quando nao ha itens.
--
-- A lista vira configuracao, no mesmo padrao de cadastro.marcas_veiculo:
-- texto separado por virgula. Cada oficina confere o que quiser; estes sao
-- os itens que protegem a oficina de reclamacao de avaria pre-existente.
insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), o.id, 'cadastro.itens_checklist_entrada',
       'Riscos e amassados na lataria,'
       || 'Para-brisa e vidros,'
       || 'Faróis e lanternas,'
       || 'Estado dos pneus,'
       || 'Calotas e rodas,'
       || 'Retrovisores,'
       || 'Nível de combustível,'
       || 'Objetos deixados no carro,'
       || 'Estepe e macaco',
       'TEXTO', 'CADASTROS', now(), 'sistema'
  from oficina o
 where not exists (select 1 from configuracao x
                    where x.oficina_id = o.id
                      and x.chave = 'cadastro.itens_checklist_entrada');

-- A consulta que acha a foto de entrada de um carro roda em toda abertura de
-- OS (para apagar a da visita anterior) e em toda tentativa de iniciar o
-- servico. Sem indice ela varre arquivo_os inteira.
create index if not exists ix_arquivo_momento on arquivo_os (ordem_servico_id, momento);
