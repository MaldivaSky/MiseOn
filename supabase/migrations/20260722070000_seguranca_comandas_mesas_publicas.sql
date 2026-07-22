-- ============================================================
-- MiseOn — Segurança: fim do vazamento público de comandas e mesas
--
-- Problema:
--   pub_comanda_le   SELECT USING (true)  → qualquer anônimo lia as
--   comandas de TODAS as lojas (vazamento entre tenants).
--   pub_comanda_cria INSERT WITH CHECK (true) → qualquer anônimo abria
--   comanda em qualquer loja/mesa.
--   pub_mesas        SELECT USING (ativo) → expunha id/loja_id de todas
--   as mesas ativas de todos os tenants (facilitava a enumeração acima).
--
-- Solução (mesmo padrão já aplicado a pedidos em
-- 20260718140000_seguranca_fase_a.sql com fn_acompanhar_pedido):
--   o fluxo do QR passa por RPCs SECURITY DEFINER que validam a
--   entrada e retornam só o necessário; as policies públicas diretas
--   são removidas. O acesso da equipe (salao_comandas / salao_mesas
--   via fn_tem_papel) não é alterado.
-- ============================================================

-- ── [1] Mesa do QR: resolve slug da loja + número → dados públicos da mesa ──
-- Retorna no máximo UMA mesa ativa da loja ativa. Não enumerável em massa:
-- exige o slug exato da loja e o número exato da mesa (conteúdo do QR).
create or replace function public.fn_mesa_publica(p_slug text, p_numero int)
returns table (id uuid, loja_id uuid, numero int, nome text, capacidade int, ativo boolean, criado_em timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select m.id, m.loja_id, m.numero, m.nome, m.capacidade, m.ativo, m.criado_em
  from mesas m
  join lojas l on l.id = m.loja_id
  where l.slug = p_slug
    and l.ativo
    and m.numero = p_numero
    and m.ativo
  limit 1;
$$;

grant execute on function public.fn_mesa_publica(text, int) to anon, authenticated;

-- ── [2] Comanda da mesa: obtém a ABERTA ou cria uma nova ──
-- Substitui o SELECT + INSERT direto que o cliente via QR (e o garçom no
-- PDV) faziam em public.comandas. Valida que a mesa existe, pertence à
-- loja informada e está ativa — impossível abrir/ler comanda de outro tenant.
create or replace function public.fn_comanda_aberta_mesa(p_loja_id uuid, p_mesa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comanda uuid;
  v_taxa    numeric;
begin
  if not exists (
    select 1 from mesas
    where id = p_mesa_id and loja_id = p_loja_id and ativo
  ) then
    raise exception 'Mesa inválida ou inativa para esta loja';
  end if;

  select c.id into v_comanda
  from comandas c
  where c.mesa_id = p_mesa_id
    and c.loja_id = p_loja_id
    and c.status = 'ABERTA'
  order by c.aberta_em desc
  limit 1;

  if v_comanda is not null then
    return v_comanda;
  end if;

  select coalesce(l.taxa_servico_padrao_pct, 0) into v_taxa
  from lojas l where l.id = p_loja_id;

  insert into comandas (loja_id, mesa_id, taxa_servico_pct)
  values (p_loja_id, p_mesa_id, coalesce(v_taxa, 0))
  returning id into v_comanda;

  return v_comanda;
end;
$$;

grant execute on function public.fn_comanda_aberta_mesa(uuid, uuid) to anon, authenticated;

-- ── [3] Remove o acesso público direto às tabelas ──
-- Equipe (admin/operador/garcom) continua coberta por salao_comandas e
-- salao_mesas (fn_tem_papel). Cliente via QR usa apenas os RPCs acima.
drop policy if exists pub_comanda_le   on public.comandas;
drop policy if exists pub_comanda_cria on public.comandas;
drop policy if exists pub_mesas        on public.mesas;
