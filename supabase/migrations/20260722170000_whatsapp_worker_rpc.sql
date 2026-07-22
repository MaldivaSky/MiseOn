-- E2 (§6.3): claim atômico da fila whatsapp_eventos para o whatsapp-worker.
-- FOR UPDATE SKIP LOCKED impede processamento duplo entre isolates da Edge Function.

create or replace function fn_whatsapp_claim_eventos(
  p_loja_id uuid default null,
  p_limite  int  default 10
)
returns setof whatsapp_eventos
language sql
security definer
set search_path = public
as $$
  update whatsapp_eventos
     set status = 'PROCESSANDO'
   where id in (
     select id
       from whatsapp_eventos
      where status = 'PENDENTE'
        and (p_loja_id is null or loja_id = p_loja_id)
      order by criado_em
      limit p_limite
      for update skip locked
   )
  returning *;
$$;

-- Acesso exclusivo do worker (service_role); nunca expor para anon/authenticated
revoke all on function fn_whatsapp_claim_eventos(uuid, int) from public;
revoke all on function fn_whatsapp_claim_eventos(uuid, int) from anon;
revoke all on function fn_whatsapp_claim_eventos(uuid, int) from authenticated;
grant execute on function fn_whatsapp_claim_eventos(uuid, int) to service_role;
