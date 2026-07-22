-- ============================================================
-- MiseOn — Drenagem da fila com escopo de loja
--
-- O agendador externo roda uma vez por dia (limite do plano Hobby da
-- Vercel), o que é rede de segurança, não entrega. "Seu pedido saiu
-- para entrega" chegando no dia seguinte não serve.
--
-- Por isso o painel aberto na loja cutuca a fila periodicamente. Essa
-- chamada é autenticada pelo usuário logado, não por token de worker —
-- então ela só pode drenar a própria loja. Daí o parâmetro opcional.
-- ============================================================

drop function if exists public.fn_email_reservar(int);

create or replace function public.fn_email_reservar(
  p_limite int default 20,
  p_loja   uuid default null
)
returns setof public.email_fila
language sql
security definer
set search_path = public
as $$
  update public.email_fila f
  set status = 'ENVIANDO', atualizado_em = now()
  where f.id in (
    select id from public.email_fila
    where status = 'PENDENTE'
      and agendado_para <= now()
      and (p_loja is null or loja_id = p_loja)
    order by criado_em
    limit p_limite
    for update skip locked
  )
  returning f.*;
$$;
