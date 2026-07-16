-- ============================================================
-- MiseOn — Equipe profissional + validade de preparos (OS)
-- 1) usuarios_loja ganha dados cadastrais (nome, contato,
--    tipo de contrato e data de criação do acesso)
-- 2) insumos (preparos) ganham validade em horas
-- 3) producoes_preparo: cada produção vira uma ordem de
--    serviço com lote, rendimento e vencimento
-- ============================================================

-- ── 1. Equipe ───────────────────────────────────────────────
alter table public.usuarios_loja
  add column if not exists nome text,
  add column if not exists telefone text,
  add column if not exists tipo_contrato text not null default 'CLT',
  add column if not exists criado_em timestamptz not null default now();

do $$ begin
  alter table public.usuarios_loja
    add constraint usuarios_loja_tipo_contrato_chk
    check (tipo_contrato in ('CLT', 'FREELANCE', 'PJ', 'TEMPORARIO'));
exception when duplicate_object then null; end $$;

-- ── 2. Validade dos preparos ────────────────────────────────
alter table public.insumos
  add column if not exists validade_horas numeric(8,2); -- null = não controla validade

-- ── 3. Lotes de produção (ordem de serviço da cozinha) ──────
create table if not exists public.producoes_preparo (
  id                   uuid primary key default gen_random_uuid(),
  loja_id              uuid not null references public.lojas(id) on delete cascade,
  preparo_id           uuid not null references public.insumos(id) on delete cascade,
  lotes                int not null default 1 check (lotes > 0),
  quantidade_produzida numeric(12,4) not null,
  produzido_em         timestamptz not null default now(),
  vence_em             timestamptz,               -- null = sem controle de validade
  status               text not null default 'ATIVO' check (status in ('ATIVO', 'DESCARTADO')),
  descartado_em        timestamptz,
  quantidade_descartada numeric(12,4)
);

create index if not exists idx_producoes_preparo_loja
  on public.producoes_preparo (loja_id, status, vence_em);

alter table public.producoes_preparo enable row level security;

drop policy if exists adm_producoes_preparo on public.producoes_preparo;
create policy adm_producoes_preparo on public.producoes_preparo
  for all using (fn_meu_acesso(loja_id));
