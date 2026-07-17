-- ============================================================
-- MiseOn — Fase 1: Frente de Caixa (turnos de balcão)
-- Turno: abre com fundo de troco, recebe vendas do PDV,
-- registra sangrias/reforços e fecha com conferência.
-- ============================================================

create table if not exists public.caixa_turnos (
  id              uuid primary key default gen_random_uuid(),
  loja_id         uuid not null references public.lojas(id) on delete cascade,
  aberto_por      uuid references auth.users(id) on delete set null,
  aberto_por_nome text,
  fundo_troco     numeric(10,2) not null default 0,
  aberto_em       timestamptz not null default now(),
  fechado_em      timestamptz,
  fechado_por     uuid references auth.users(id) on delete set null,
  valor_esperado  numeric(10,2),   -- fundo + vendas dinheiro + reforços - sangrias (no fechamento)
  valor_contado   numeric(10,2),   -- o que foi contado na gaveta
  diferenca       numeric(10,2),   -- contado - esperado (quebra de caixa)
  observacao      text,
  status          text not null default 'ABERTO' check (status in ('ABERTO', 'FECHADO'))
);

create index if not exists idx_caixa_turnos_loja on public.caixa_turnos (loja_id, status, aberto_em desc);

create table if not exists public.caixa_movimentacoes (
  id        uuid primary key default gen_random_uuid(),
  loja_id   uuid not null references public.lojas(id) on delete cascade,
  turno_id  uuid not null references public.caixa_turnos(id) on delete cascade,
  tipo      text not null check (tipo in ('SANGRIA', 'REFORCO')),
  valor     numeric(10,2) not null check (valor > 0),
  motivo    text,
  user_id   uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_caixa_mov_turno on public.caixa_movimentacoes (turno_id);

alter table public.caixa_turnos enable row level security;
alter table public.caixa_movimentacoes enable row level security;

drop policy if exists adm_caixa_turnos on public.caixa_turnos;
create policy adm_caixa_turnos on public.caixa_turnos
  for all using (fn_meu_acesso(loja_id));

drop policy if exists adm_caixa_mov on public.caixa_movimentacoes;
create policy adm_caixa_mov on public.caixa_movimentacoes
  for all using (fn_meu_acesso(loja_id));
