-- ---------------------------------------------------------------------------
-- Entrar com nome de usuario, nao so com e-mail.
--
-- Mecanico de oficina nao tem e-mail corporativo, e digitar
-- "tonny@delander.com.br" num tablet engordurado, de luva, e pedir erro. O
-- login vira o apelido que ja se usa no balcao: "tonny", "kevim".
--
-- O e-mail CONTINUA valendo para entrar. Ninguem e obrigado a decorar nada
-- novo, e quem ja entrava com e-mail nao percebe a mudanca.
-- ---------------------------------------------------------------------------

alter table usuario add column login varchar(40);

-- Quem ja existe ganha um login derivado do e-mail: o pedaco antes do @, sem
-- acento nem pontuacao estranha. Se dois e-mails diferentes derem o mesmo
-- apelido (joao@a.com e joao@b.com), o segundo recebe um numero no fim --
-- feio, mas unico, e o dono renomeia depois em Funcionarios.
update usuario u
set login = calculado.apelido
from (
    select id,
           case when ordem = 1 then base else base || ordem::text end as apelido
    from (
        select id,
               nullif(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), '') as base,
               row_number() over (
                   partition by nullif(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), '')
                   order by criado_em, id
               ) as ordem
        from usuario
    ) bruto
    where base is not null
) calculado
where u.id = calculado.id;

-- Quem sobrou sem base utilizavel (e-mail so com simbolos) fica com o id curto.
update usuario
set login = 'user' || substr(replace(id::text, '-', ''), 1, 8)
where login is null;

alter table usuario alter column login set not null;

-- Unico ignorando maiusculas: "Tonny" e "tonny" sao a mesma pessoa, e deixar
-- os dois existirem criaria duas contas que ninguem distingue na tela.
create unique index uk_usuario_login on usuario (lower(login));
