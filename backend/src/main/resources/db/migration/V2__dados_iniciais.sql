-- =====================================================================
-- Dados de bootstrap (sempre aplicados).
-- O usuario dono e os dados de demonstracao sao criados pela aplicacao
-- (ver CargaInicial / CargaDemo) porque dependem do encoder de senha
-- e de datas relativas a "hoje".
-- =====================================================================

insert into oficina (id, nome, telefone, criado_em, criado_por)
values ('00000000-0000-0000-0000-000000000001', 'Oficina Flow', '(11) 0000-0000', now(), 'sistema');

-- ------------------------------ especialidades ----------------------

insert into especialidade (id, oficina_id, nome, cor, criado_por)
values
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Motor',                '#dc2626', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Eletrica',             '#f59e0b', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Suspensao',            '#0ea5e9', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Freios',               '#7c3aed', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Cambio',               '#0d9488', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Ar-condicionado',      '#2563eb', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Funilaria e Pintura',  '#db2777', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Revisao Geral',        '#16a34a', 'sistema');

-- ------------------------------ boxes -------------------------------

insert into box (id, oficina_id, nome, tipo, criado_por)
values
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Elevador 1', 'ELEVADOR', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Elevador 2', 'ELEVADOR', 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Box 3',      'BOX',      'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Box 4',      'BOX',      'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Patio 1',    'PATIO',    'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Patio 2',    'PATIO',    'sistema');

-- ------------------------------ motivos de parada -------------------

insert into motivo_parada (id, oficina_id, nome, categoria, bloqueia_execucao, visivel_cliente_padrao, criado_por)
values
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Falta de peca',                    'PECA',       true,  true,  'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Peca em transporte',               'PECA',       true,  true,  'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Aguardando aprovacao do cliente',  'APROVACAO',  true,  true,  'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Aguardando servico de terceiro',   'TERCEIRO',   true,  true,  'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Aguardando pagamento',             'PAGAMENTO',  true,  false, 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Mecanico realocado',               'INTERNO',    true,  false, 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Fim do turno',                     'INTERNO',    false, false, 'sistema'),
 (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Cliente pediu para aguardar',      'CLIENTE',    true,  true,  'sistema');

-- ------------------------------ catalogo de servicos ----------------

insert into catalogo_servico (id, oficina_id, descricao, especialidade_id, horas_padrao, preco_sugerido, criado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000001', d.descricao, e.id, d.horas, d.preco, 'sistema'
from (values
    ('Troca de oleo e filtros',            'Revisao Geral',       0.75,  180.00),
    ('Revisao completa (30 itens)',        'Revisao Geral',       3.00,  450.00),
    ('Diagnostico eletronico (scanner)',   'Eletrica',            1.00,  150.00),
    ('Troca de pastilhas de freio',        'Freios',              1.50,  220.00),
    ('Troca de discos e pastilhas',        'Freios',              2.50,  480.00),
    ('Troca de amortecedores (par)',       'Suspensao',           3.00,  520.00),
    ('Alinhamento e balanceamento',        'Suspensao',           1.00,  140.00),
    ('Troca de correia dentada',           'Motor',               4.00,  780.00),
    ('Retifica de motor',                  'Motor',              24.00, 4800.00),
    ('Troca de embreagem',                 'Cambio',              6.00, 1200.00),
    ('Troca de oleo do cambio automatico', 'Cambio',              2.00,  650.00),
    ('Higienizacao do ar-condicionado',    'Ar-condicionado',     1.50,  190.00),
    ('Recarga de gas do ar-condicionado',  'Ar-condicionado',     1.00,  280.00),
    ('Troca de bateria',                   'Eletrica',            0.50,   90.00),
    ('Reparo de chicote eletrico',         'Eletrica',            3.00,  380.00),
    ('Polimento e cristalizacao',          'Funilaria e Pintura', 4.00,  600.00)
) as d(descricao, especialidade, horas, preco)
join especialidade e
  on e.nome = d.especialidade
 and e.oficina_id = '00000000-0000-0000-0000-000000000001';

-- ------------------------------ configuracoes -----------------------

insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000001', c.chave, c.valor, c.tipo, c.grupo, now(), 'sistema'
from (values
    -- CAPACIDADE: quanto a oficina aguenta
    ('capacidade.horas_uteis_por_dia',              '8',                 'DECIMAL', 'CAPACIDADE'),
    ('capacidade.dias_funcionamento',               '[1,2,3,4,5,6]',     'JSON',    'CAPACIDADE'),
    ('capacidade.hora_abertura',                    '08:00',             'HORA',    'CAPACIDADE'),
    ('capacidade.hora_fechamento',                  '18:00',             'HORA',    'CAPACIDADE'),
    ('capacidade.max_carros_por_dia',               '4',                 'INTEIRO', 'CAPACIDADE'),
    ('capacidade.max_carros_por_semana',            '20',                'INTEIRO', 'CAPACIDADE'),
    ('capacidade.max_carros_por_mes',               '70',                'INTEIRO', 'CAPACIDADE'),
    ('capacidade.limitar_por_horas',                'true',              'BOOLEAN', 'CAPACIDADE'),
    ('capacidade.limitar_por_boxes',                'true',              'BOOLEAN', 'CAPACIDADE'),
    ('capacidade.limitar_por_quantidade',           'true',              'BOOLEAN', 'CAPACIDADE'),
    ('capacidade.permitir_overbooking',             'false',             'BOOLEAN', 'CAPACIDADE'),
    ('capacidade.percentual_overbooking',           '10',                'INTEIRO', 'CAPACIDADE'),

    -- FLUXO: o que o sistema exige e quem pode o que
    ('fluxo.exigir_diagnostico',                    'false',             'BOOLEAN', 'FLUXO'),
    ('fluxo.exigir_aprovacao_orcamento',            'true',              'BOOLEAN', 'FLUXO'),
    ('fluxo.exigir_checklist_entrada',              'false',             'BOOLEAN', 'FLUXO'),
    ('fluxo.exigir_fotos_entrada',                  'false',             'BOOLEAN', 'FLUXO'),
    ('fluxo.permitir_multiplos_mecanicos_por_os',   'true',              'BOOLEAN', 'FLUXO'),
    ('fluxo.permitir_apontamento_simultaneo',       'false',             'BOOLEAN', 'FLUXO'),
    ('fluxo.exigir_estimativa_ao_iniciar',          'true',              'BOOLEAN', 'FLUXO'),
    ('fluxo.exigir_motivo_ao_pausar',               'true',              'BOOLEAN', 'FLUXO'),
    ('fluxo.mecanico_pode_criar_os',                'false',             'BOOLEAN', 'FLUXO'),
    ('fluxo.mecanico_pode_realocar',                'false',             'BOOLEAN', 'FLUXO'),
    ('fluxo.mecanico_ve_valores',                   'false',             'BOOLEAN', 'FLUXO'),
    ('fluxo.fechar_apontamento_esquecido',          'true',              'BOOLEAN', 'FLUXO'),
    ('fluxo.hora_fechamento_automatico',            '18:30',             'HORA',    'FLUXO'),

    -- COMPARTILHAMENTO: o que o dono do carro ve no link publico
    ('compartilhamento.ativo_global',               'true',              'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.gerar_automatico_ao_iniciar','true',              'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.dias_validade',              '30',                'INTEIRO', 'COMPARTILHAMENTO'),
    ('compartilhamento.exigir_pin',                 'false',             'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.mostrar_itens',              'true',              'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.mostrar_valores',            'false',             'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.mostrar_nome_mecanico',      'false',             'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.mostrar_paradas',            'true',              'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.mostrar_motivo_parada',      'true',              'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.mostrar_previsao_entrega',   'true',              'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.mostrar_fotos',              'false',             'BOOLEAN', 'COMPARTILHAMENTO'),
    ('compartilhamento.mostrar_tempo_trabalhado',   'true',              'BOOLEAN', 'COMPARTILHAMENTO'),

    -- ALERTAS: o que acende a luz vermelha no quadro
    ('alertas.dias_sem_movimentacao',               '3',                 'INTEIRO', 'ALERTAS'),
    ('alertas.dias_pronto_sem_retirada',            '2',                 'INTEIRO', 'ALERTAS'),
    ('alertas.percentual_estouro_estimativa',       '20',                'INTEIRO', 'ALERTAS'),
    ('alertas.dias_antes_previsao',                 '1',                 'INTEIRO', 'ALERTAS'),

    -- APARENCIA
    ('app.nome_oficina',                            'Oficina Flow',      'TEXTO',   'APARENCIA'),
    ('app.modo_tv',                                 'true',              'BOOLEAN', 'APARENCIA')
) as c(chave, valor, tipo, grupo);
