-- ============================================================
-- MiseOn — Tabela de Verificação de E-mail (OTP)
-- ============================================================

create table if not exists public.email_verificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  novo_email text not null,
  codigo text not null,
  tentativas int default 0,
  expira_em timestamptz not null default (now() + interval '10 minutes'),
  usado boolean default false,
  criado_em timestamptz default now()
);

-- Ativa RLS: Acesso exclusivo via Service Role (Edge Functions)
alter table public.email_verificacoes enable row level security;

-- Nenhuma policy pública ou autenticada de leitura/escrita direta.
-- Somente o backend (service_role) acessa esta tabela.
