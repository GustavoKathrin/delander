-- ---------------------------------------------------------------------------
-- A fundacao das etapas 2, 3 e 4: cotar peca, precificar mao de obra e
-- guardar prova do que o cliente aprovou.
--
-- Nada aqui cria estado novo de OS. As tres etapas que o dono descreveu
-- (mecanico lista -> dono cota -> dono precifica) acontecem todas com a OS
-- em EM_DIAGNOSTICO: e o mesmo carro mudando de mao, nao de lugar. Criar
-- status novos custaria mexer na maquina de estados, no check de status, no
-- patio, no quadro, no radar e em 19 testes -- para descrever algo que o
-- dado ja sabe dizer.
-- ---------------------------------------------------------------------------

-- 1. O lucro do servico, para a "tabela de mao de obra" do dono.
--
-- preco_sugerido e horas_padrao ja existem desde a V1: dos quatro campos que
-- ele pediu, dois estavam prontos. Falta o lucro -- e NAO a margem: margem e
-- lucro/preco, e guardar as duas coisas e guardar duas versoes da mesma
-- verdade, que um dia discordam. A tela calcula e mostra a margem; o banco
-- guarda so o que foi digitado.
--
-- Nulavel de proposito: o dono disse "nada obrigatorio, so o valor".
alter table catalogo_servico
    add column if not exists valor_lucro numeric(12, 2);

comment on column catalogo_servico.valor_lucro is
    'Quanto deste preco e lucro. Opcional. A margem (%) e derivada: lucro / preco_sugerido.';

-- 2. Prova do valor aprovado.
--
-- A OS ja guarda orcamento_respondido_em e orcamento_respondido_por, mas NAO
-- guarda QUAL valor foi aprovado -- e valor_total e derivado (pecas + mao de
-- obra - desconto), recalculado a cada peca que entra. Ou seja: hoje, seis
-- meses depois, nao existe prova do "voce autorizou R$ 1.180". Basta alguem
-- acrescentar uma peca para o passado mudar.
alter table ordem_servico
    add column if not exists valor_aprovado numeric(12, 2);

comment on column ordem_servico.valor_aprovado is
    'Fotografia do total no instante em que o cliente aprovou. Nao muda depois.';

-- 3. Como o valor da mao de obra e definido.
--
-- Padrao MANUAL, e nao AUTOMATICA, por um motivo concreto: a tabela de precos
-- do Delander ainda nao existe -- ele disse que esta migrando para ela e
-- ainda nao migrou. Com o catalogo vazio, AUTOMATICA soma zero e o orcamento
-- sai de graca. MANUAL deixa alguem digitar hoje, e no dia em que a tabela
-- estiver pronta e um clique na configuracao.
insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), o.id, 'fluxo.modo_mao_de_obra', 'MANUAL', 'TEXTO', 'FLUXO', now(), 'sistema'
  from oficina o
 where not exists (select 1 from configuracao x
                    where x.oficina_id = o.id
                      and x.chave = 'fluxo.modo_mao_de_obra');

-- 4. Quanto de desconto o balcao pode dar sozinho.
--
-- Em percentual, e nao em reais: desconto se negocia em percentual ("da 10%?")
-- e a porcentagem acompanha o tamanho do servico -- R$ 50 e esmola num motor
-- e absurdo numa troca de oleo.
--
-- Zero de fabrica: ninguem da desconto enquanto o dono nao disser quanto. O
-- dono (e o gerente) continuam podendo dar qualquer valor, como ja podiam.
insert into configuracao (id, oficina_id, chave, valor, tipo, grupo, atualizado_em, atualizado_por)
select gen_random_uuid(), o.id, 'fluxo.desconto_maximo_percentual', '0', 'INTEIRO', 'FLUXO', now(), 'sistema'
  from oficina o
 where not exists (select 1 from configuracao x
                    where x.oficina_id = o.id
                      and x.chave = 'fluxo.desconto_maximo_percentual');
