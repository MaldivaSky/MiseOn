-- Leads comerciais captados na landing page (Fase 1) e CRM do superadmin (Fase 4).
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  email text,
  segmento text not null default 'lanchonete'
    check (segmento in ('lanchonete','hamburgueria','restaurante','pizzaria','cozinha_industrial','outro')),
  cidade text,
  mensagem text,
  origem text not null default 'landing',
  status text not null default 'novo'
    check (status in ('novo','contatado','demo','convertido','descartado')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status, created_at desc);

alter table public.leads enable row level security;

-- Qualquer visitante pode deixar seu contato (sem ler nada de volta).
create policy leads_insert_publico on public.leads
  for insert to anon, authenticated
  with check (true);

-- Leitura/edição só para superadmin (plataforma_admins existe em produção).
create policy leads_superadmin_select on public.leads
  for select to authenticated
  using (public.fn_sou_superadmin());

create policy leads_superadmin_update on public.leads
  for update to authenticated
  using (public.fn_sou_superadmin())
  with check (public.fn_sou_superadmin());
