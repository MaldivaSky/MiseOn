-- ============================================================
-- MiseOn — RBAC por papel (admin | operador | garcom | entregador)
--
-- Antes desta migration, fn_meu_acesso(loja) concedia acesso total
-- a qualquer pessoa vinculada à loja: um entregador conseguia ler
-- faturamento, custo de insumos e as credenciais Efí da loja.
--
-- Escopo de cada papel:
--   admin      → tudo
--   operador   → operação + caixa + estoque; sem financeiro, custeio,
--                credenciais e gestão de equipe
--   garcom     → salão (mesas/comandas) + pedidos + cardápio (leitura)
--   entregador → pedidos e entregas; nada de gestão
-- ============================================================

-- ── 1. Papel vira valor controlado ──────────────────────────
do $$ begin
  alter table public.usuarios_loja
    add constraint usuarios_loja_papel_chk
    check (papel in ('admin', 'operador', 'garcom', 'entregador'));
exception when duplicate_object then null; end $$;

-- ── 2. Helpers ──────────────────────────────────────────────
create or replace function public.fn_meu_papel(p_loja uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.usuarios_loja
  where user_id = auth.uid() and loja_id = p_loja
  limit 1;
$$;

create or replace function public.fn_tem_papel(p_loja uuid, p_papeis text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_loja
    where user_id = auth.uid() and loja_id = p_loja and papel = any(p_papeis)
  );
$$;

create or replace function public.fn_sou_admin(p_loja uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_tem_papel(p_loja, array['admin']);
$$;

-- fn_meu_acesso continua existindo (qualquer vínculo com a loja) e
-- segue válido para as tabelas operacionais compartilhadas.
create or replace function public.fn_meu_acesso(p_loja uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_loja
    where user_id = auth.uid() and loja_id = p_loja
  );
$$;

-- ── 3. Credenciais de pagamento: somente admin ──────────────
drop policy if exists cred_acesso on public.loja_efi_credenciais;
create policy cred_admin on public.loja_efi_credenciais
  for all using (public.fn_sou_admin(loja_id))
  with check (public.fn_sou_admin(loja_id));

-- ── 4. Financeiro: somente admin ────────────────────────────
drop policy if exists adm_contas on public.contas;
create policy fin_contas_admin on public.contas
  for all using (public.fn_sou_admin(loja_id))
  with check (public.fn_sou_admin(loja_id));

drop policy if exists adm_lancamentos on public.lancamentos_financeiros;
drop policy if exists adm_lf on public.lancamentos_financeiros;
create policy fin_lancamentos_admin on public.lancamentos_financeiros
  for all using (public.fn_sou_admin(loja_id))
  with check (public.fn_sou_admin(loja_id));

-- ── 5. Custeio: somente admin ───────────────────────────────
drop policy if exists adm_config_custos on public.configuracoes_custo;
create policy custeio_config_admin on public.configuracoes_custo
  for all using (public.fn_sou_admin(loja_id))
  with check (public.fn_sou_admin(loja_id));

-- ── 6. Estoque e fichas: admin + operador ───────────────────
-- A baixa automática de estoque roda por triggers SECURITY DEFINER
-- (fn_baixar_estoque, fn_consumir_lotes_peps, fn_mov_criar_lote),
-- que ignoram RLS — restringir aqui não afeta o PDV.
drop policy if exists adm_insumos on public.insumos;
create policy estoque_insumos on public.insumos
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

drop policy if exists adm_mov on public.movimentacoes_estoque;
create policy estoque_mov on public.movimentacoes_estoque
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

drop policy if exists lotes_loja on public.lotes_estoque;
create policy estoque_lotes on public.lotes_estoque
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

drop policy if exists adm_fichas_preparos on public.fichas_preparos;
create policy estoque_fichas_preparos on public.fichas_preparos
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

drop policy if exists adm_producoes_preparo on public.producoes_preparo;
create policy estoque_producoes on public.producoes_preparo
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

drop policy if exists adm_ft on public.fichas_tecnicas;
create policy estoque_ft on public.fichas_tecnicas
  for all using (
    public.fn_tem_papel(
      (select loja_id from public.produtos where id = produto_id),
      array['admin', 'operador']
    )
  )
  with check (
    public.fn_tem_papel(
      (select loja_id from public.produtos where id = produto_id),
      array['admin', 'operador']
    )
  );

-- ── 7. Caixa: admin + operador ──────────────────────────────
drop policy if exists adm_caixa_turnos on public.caixa_turnos;
create policy caixa_turnos_rbac on public.caixa_turnos
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

drop policy if exists adm_caixa_mov on public.caixa_movimentacoes;
create policy caixa_mov_rbac on public.caixa_movimentacoes
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

-- ── 8. Salão: admin + operador + garcom ─────────────────────
drop policy if exists adm_mesas on public.mesas;
create policy salao_mesas on public.mesas
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador', 'garcom']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador', 'garcom']));

drop policy if exists adm_comandas on public.comandas;
create policy salao_comandas on public.comandas
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador', 'garcom']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador', 'garcom']));

-- ── 9. Cupons: todos leem, só admin gerencia ────────────────
drop policy if exists adm_cupons on public.cupons;
create policy cupons_le on public.cupons
  for select using (public.fn_meu_acesso(loja_id));
create policy cupons_admin on public.cupons
  for all using (public.fn_sou_admin(loja_id))
  with check (public.fn_sou_admin(loja_id));

-- ── 10. Configuração da loja: todos leem, só admin altera ───
drop policy if exists adm_lojas on public.lojas;
create policy lojas_le on public.lojas
  for select using (public.fn_meu_acesso(id));
create policy lojas_admin on public.lojas
  for all using (public.fn_sou_admin(id))
  with check (public.fn_sou_admin(id));

drop policy if exists adm_horarios on public.horarios_funcionamento;
create policy horarios_le on public.horarios_funcionamento
  for select using (public.fn_meu_acesso(loja_id));
create policy horarios_admin on public.horarios_funcionamento
  for all using (public.fn_sou_admin(loja_id))
  with check (public.fn_sou_admin(loja_id));

-- ── 11. Cardápio: todos leem, admin + operador editam ───────
drop policy if exists adm_prod on public.produtos;
create policy prod_le on public.produtos
  for select using (public.fn_meu_acesso(loja_id));
create policy prod_gestao on public.produtos
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

drop policy if exists adm_cat on public.categorias;
create policy cat_le on public.categorias
  for select using (public.fn_meu_acesso(loja_id));
create policy cat_gestao on public.categorias
  for all using (public.fn_tem_papel(loja_id, array['admin', 'operador']))
  with check (public.fn_tem_papel(loja_id, array['admin', 'operador']));

-- ── 12. Equipe: cada um vê o próprio vínculo; admin vê a loja ─
drop policy if exists adm_usuarios on public.usuarios_loja;
create policy equipe_proprio on public.usuarios_loja
  for select using (user_id = auth.uid());
create policy equipe_admin_le on public.usuarios_loja
  for select using (public.fn_sou_admin(loja_id));
-- Escrita continua exclusiva da edge function equipe-convidar
-- (service role), que já valida papel = admin antes de agir.
