-- ============================================================
-- Hotfix 2026-07-18 — Regularização pós-incidente
-- ============================================================
-- 1) Schema drift: colunas de assinatura existem em produção mas
--    não constavam em nenhuma migration (o motor de bloqueio do
--    AdminLayout as lia sem trazer no select — causa do incidente
--    do redirect para /admin/assinatura). Idempotente: no-op onde
--    já existem.
-- 2) Re-aplica fn_creditar_cashback corrigida: a migration da
--    fase 3 (20260717150000) foi editada APÓS ser aplicada em
--    produção, então o banco ainda rodava a versão antiga.
-- 3) Bug multi-tenant de dinheiro: cashback_saldos tinha PK em
--    (cliente_id) apenas, e o UPSERT usava ON CONFLICT (cliente_id).
--    Um cliente com saldo na loja A que comprasse na loja B teria o
--    crédito somado no saldo da loja A (loja_id nunca é atualizado
--    no UPDATE) — dinheiro creditado na loja errada. PK vira
--    (cliente_id, loja_id) e o conflito acompanha. Dados antigos
--    são seguros: cliente_id único implica (cliente_id, loja_id)
--    único, então a troca de PK não viola nada existente.

-- ── 1. Assinatura (drift) ────────────────────────────────────
alter table public.lojas
  add column if not exists status_assinatura text;

alter table public.lojas
  add column if not exists vencimento_assinatura timestamptz;

-- ── 2/3. Cashback: PK por loja + função corrigida ───────────
alter table public.cashback_saldos
  drop constraint if exists cashback_saldos_pkey;

alter table public.cashback_saldos
  add primary key (cliente_id, loja_id);

create or replace function fn_creditar_cashback(p_pedido_id uuid) returns void as $$
declare
  v_loja uuid; v_cliente uuid; v_subtotal numeric; v_taxa numeric; v_desconto numeric; v_pct numeric; v_credito numeric;
begin
  select p.loja_id, p.cliente_id, p.subtotal, p.taxa_entrega, p.desconto
    into v_loja, v_cliente, v_subtotal, v_taxa, v_desconto
  from pedidos p where p.id = p_pedido_id;

  if v_cliente is null then return; end if;

  select cashback_pct into v_pct from lojas where id = v_loja;
  if v_pct is null or v_pct <= 0 then return; end if;

  -- Base: valor pré-cashback (subtotal + entrega - desconto).
  -- coalesce defensivo: colunas são NOT NULL, mas não custa nada.
  v_credito := round((coalesce(v_subtotal,0) + coalesce(v_taxa,0) - coalesce(v_desconto,0)) * v_pct / 100, 2);
  if v_credito is null or v_credito <= 0 then return; end if;

  insert into cashback_saldos (cliente_id, loja_id, saldo)
  values (v_cliente, v_loja, v_credito)
  on conflict (cliente_id, loja_id) do update
    set saldo = cashback_saldos.saldo + v_credito, atualizado_em = now();

  insert into cashback_movimentos (loja_id, cliente_id, pedido_id, tipo, valor)
  values (v_loja, v_cliente, p_pedido_id, 'CREDITO', v_credito);
end; $$ language plpgsql security definer;
