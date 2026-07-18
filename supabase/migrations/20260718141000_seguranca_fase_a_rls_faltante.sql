-- ============================================================
-- Segurança — FASE A (complemento): tabelas sem RLS + hardening
-- Detectado pelo advisor após a fase A. Mesma classe do achado 6
-- (exposição cross-tenant). historico_pedidos e fichas_preparos
-- estavam com RLS DESABILITADA.
-- ============================================================

-- historico_pedidos: log de status. Escrito por trigger SECURITY DEFINER
-- (RLS não afeta a escrita). Leitura só da loja dona + cliente dono.
alter table historico_pedidos enable row level security;
drop policy if exists adm_historico on historico_pedidos;
create policy adm_historico on historico_pedidos for all to public
  using (fn_meu_acesso((select loja_id from pedidos where id = pedido_id)));
drop policy if exists cliente_historico on historico_pedidos;
create policy cliente_historico on historico_pedidos for select to public
  using (pedido_id in (select id from pedidos where cliente_user_id = auth.uid()));

-- fichas_preparos: receita/custo interno da loja. Só a loja dona.
alter table fichas_preparos enable row level security;
drop policy if exists adm_fichas_preparos on fichas_preparos;
create policy adm_fichas_preparos on fichas_preparos for all to public
  using (fn_meu_acesso(loja_id)) with check (fn_meu_acesso(loja_id));

-- fn_recalcular_pedido só é chamada pelas edge functions (service_role).
revoke execute on function fn_recalcular_pedido(uuid) from anon, authenticated;
