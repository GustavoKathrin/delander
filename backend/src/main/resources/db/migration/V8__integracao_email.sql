-- =====================================================================
-- Delander - entrada de leituras por e-mail
--
-- O scanner do tablet manda o relatorio por e-mail. Ate aqui alguem tinha
-- que abrir a caixa, baixar o PDF e importar na mao. Estas chaves ligam o
-- caminho automatico.
--
-- O que NAO esta aqui, de proposito: host, usuario e senha da caixa. O
-- endpoint /api/configuracoes/mapa devolve todo valor em texto claro para
-- qualquer usuario autenticado — guardar a senha aqui seria entrega-la a
-- cada mecanico. Credencial vai por variavel de ambiente (APP_IMAP_*).
--
-- Nasce DESLIGADO. Sem alguem ligar, o job nao abre conexao nenhuma.
-- =====================================================================

insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), o.id, c.chave, c.valor, c.tipo, 'INTEGRACAO', now(), 'sistema'
  from oficina o
 cross join (values
    ('integracao.email_leituras_ativo',  'false',                   'BOOLEAN'),
    -- so entra e-mail cujo assunto contenha este texto
    ('integracao.email_assunto',         'RELATORIO DE DIAGNOSTICO', 'TEXTO'),
    -- vazio = ninguem. Lista de remetentes separada por virgula.
    ('integracao.email_remetentes',      '',                        'TEXTO'),
    ('integracao.email_intervalo_minutos', '15',                    'INTEIRO'),
    ('integracao.email_pasta',           'INBOX',                   'TEXTO')
 ) as c(chave, valor, tipo)
 where not exists (select 1 from configuracao x
                    where x.oficina_id = o.id and x.chave = c.chave);
