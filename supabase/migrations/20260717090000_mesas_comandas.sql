-- ============================================================
-- MiseOn — Fase 2: Mesas, QR e Comandas (salão)
--
-- Modelo: cada "rodada" de pedido numa mesa é um `pedidos` normal
-- (tipo_pedido='SALAO'), amarrado a uma `comandas` aberta da mesa —
-- assim KDS, estoque (ficha técnica), impressão e Financeiro
-- continuam funcionando sem nenhuma mudança (100% reuso).
-- O fechamento da comanda gera um `pagamentos` por pedido da
-- comanda (mesmo padrão já usado em qualquer venda), então
-- não é preciso mexer no schema/RLS de pagamentos.
-- ============================================================

create table if not exists public.mesas (
  id        uuid primary key default gen_random_uuid(),
  loja_id   uuid not null references public.lojas(id) on delete cascade,
  numero    int not null,
  nome      text,                 -- opcional: "Varanda 2", "Balcão bar"
  capacidade int,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (loja_id, numero)
);

create table if not exists public.comandas (
  id                uuid primary key default gen_random_uuid(),
  loja_id           uuid not null references public.lojas(id) on delete cascade,
  mesa_id           uuid not null references public.mesas(id) on delete cascade,
  status            text not null default 'ABERTA' check (status in ('ABERTA', 'FECHADA')),
  taxa_servico_pct  numeric(5,2) not null default 0,   -- snapshot da config da loja na abertura
  valor_servico     numeric(10,2) not null default 0,  -- calculado no fechamento
  metodo_pagamento  text,                              -- snapshot: PIX | CREDITO | DEBITO | DINHEIRO | MISTO
  aberta_em         timestamptz not null default now(),
  fechada_em        timestamptz,
  fechada_por       uuid references auth.users(id) on delete set null
);

create index if not exists idx_comandas_mesa_status on public.comandas (mesa_id, status);
create index if not exists idx_comandas_loja_status on public.comandas (loja_id, status);

-- Pedido pertence (opcionalmente) a uma comanda de mesa. mesa_numero é
-- snapshot para exibir no KDS/painel sem precisar de join a cada poll.
alter table public.pedidos add column if not exists comanda_id uuid references public.comandas(id) on delete set null;
alter table public.pedidos add column if not exists mesa_numero int;
create index if not exists idx_pedidos_comanda on public.pedidos (comanda_id);

-- Taxa de serviço padrão sugerida ao abrir uma comanda (editável no fechamento)
alter table public.lojas add column if not exists taxa_servico_padrao_pct numeric(5,2) not null default 0;

alter table public.mesas    enable row level security;
alter table public.comandas enable row level security;

-- Público (cliente com QR na mesa): vê mesas ativas, abre e lê comandas —
-- mesmo modelo de confiança já usado em pedidos (pub_cria_pedido WITH CHECK true).
drop policy if exists pub_mesas on public.mesas;
create policy pub_mesas on public.mesas for select using (ativo);

drop policy if exists pub_comanda_cria on public.comandas;
create policy pub_comanda_cria on public.comandas for insert with check (true);

drop policy if exists pub_comanda_le on public.comandas;
create policy pub_comanda_le on public.comandas for select using (true);

-- Gestão (loja dona)
drop policy if exists adm_mesas on public.mesas;
create policy adm_mesas on public.mesas for all using (fn_meu_acesso(loja_id));

drop policy if exists adm_comandas on public.comandas;
create policy adm_comandas on public.comandas for all using (fn_meu_acesso(loja_id));

-- Realtime no Mapa de Mesas
alter publication supabase_realtime add table public.comandas;
