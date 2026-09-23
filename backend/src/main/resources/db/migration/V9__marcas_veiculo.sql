-- =====================================================================
-- Delander - a lista de marcas que a oficina atende
--
-- Digitar "Honda" a cada carro novo e lento e produz acervo sujo: "honda",
-- "HONDA", "Hnoda" viram tres marcas diferentes na hora de achar a leitura
-- de um Civic. Uma lista escolhida resolve os dois problemas de uma vez.
--
-- Tabela propria seria o padrao da casa (especialidade, motivo_parada), mas
-- marca nao tem atributo nenhum alem do nome, nao se relaciona com ninguem e
-- nao precisa de historico. Uma configuracao de texto com a lista separada
-- por virgula carrega exatamente a informacao que existe — e a tela de
-- Cadastros edita como fichas, nao como texto cru.
--
-- A lista e um ponto de partida, nao uma regra: a tela deixa incluir, tirar
-- e reordenar, e o campo continua aceitando marca fora da lista (moto,
-- caminhao, importado). Oficina que recusa um carro porque a marca nao
-- estava no combo e uma oficina pior.
-- =====================================================================

insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), o.id, 'cadastro.marcas_veiculo',
       'Chevrolet,Volkswagen,Fiat,Ford,Toyota,Honda,Hyundai,Renault,Jeep,Nissan,'
       || 'Peugeot,Citroen,Mitsubishi,Kia,Chery,Suzuki,BMW,Mercedes-Benz,Audi,'
       || 'Land Rover,Volvo,RAM,Mini,BYD,GWM,JAC',
       'TEXTO', 'CADASTROS', now(), 'sistema'
  from oficina o
 where not exists (select 1 from configuracao c
                    where c.oficina_id = o.id and c.chave = 'cadastro.marcas_veiculo');
