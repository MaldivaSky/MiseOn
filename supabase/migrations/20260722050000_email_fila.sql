-- ============================================================
-- MiseOn — Fila de e-mail transacional e de marketing
--
-- Problema que resolve: a implementação anterior só conseguia enviar
-- para o usuário logado (user.email do JWT). Cliente final não tem
-- conta no sistema e webhook de pagamento não tem JWT, então os
-- e-mails mais importantes eram impossíveis de disparar.
--
-- Aqui o envio passa a ser consequência de evento de negócio:
-- alguém enfileira, e o worker envia. Idempotência por
-- (loja_id, evento, referencia_id) para que webhook repetido da Efí
-- não gere sete e-mails para o cliente.
-- ============================================================

-- ── 1. Consentimento por endereço, não por conta ────────────
-- email_preferences (já existente) é do lojista, usuário do SaaS.
-- Esta tabela é do cliente final do restaurante, que não tem login.
create table if not exists public.email_consentimentos (
  loja_id             uuid not null references public.lojas(id) on delete cascade,
  email               text not null,
  marketing_permitido boolean not null default false,
  descadastro_token   uuid not null default gen_random_uuid(),
  origem              text,
  atualizado_em       timestamptz not null default now(),
  primary key (loja_id, email)
);

create unique index if not exists email_consentimentos_token_idx
  on public.email_consentimentos (descadastro_token);

-- ── 2. Fila ─────────────────────────────────────────────────
create table if not exists public.email_fila (
  id            uuid primary key default gen_random_uuid(),
  loja_id       uuid not null references public.lojas(id) on delete cascade,
  evento        text not null,
  referencia_id uuid,
  destinatario  text not null,
  classe        text not null default 'TRANSACIONAL'
                  check (classe in ('TRANSACIONAL', 'MARKETING')),
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'PENDENTE'
                  check (status in ('PENDENTE', 'ENVIANDO', 'ENVIADO', 'FALHOU', 'SUPRIMIDO')),
  tentativas    int not null default 0,
  ultimo_erro   text,
  agendado_para timestamptz not null default now(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Idempotência: um e-mail por evento por referência.
create unique index if not exists email_fila_dedup_idx
  on public.email_fila (loja_id, evento, referencia_id)
  where referencia_id is not null;

-- Índice do worker: só varre o que está esperando envio.
create index if not exists email_fila_pendentes_idx
  on public.email_fila (agendado_para)
  where status = 'PENDENTE';

-- ── 3. email_log ganha contexto de loja e evento ────────────
alter table public.email_log
  add column if not exists loja_id uuid references public.lojas(id) on delete set null,
  add column if not exists evento  text,
  add column if not exists classe  text,
  add column if not exists fila_id uuid references public.email_fila(id) on delete set null;

create index if not exists email_log_loja_idx on public.email_log (loja_id, sent_at desc);

-- ── 4. Janela de silêncio e frequência de marketing ─────────
-- Marketing não sai de madrugada e respeita 7 dias entre disparos
-- para o mesmo endereço na mesma loja. Regra no banco para valer
-- também quando o disparo vier de fora do app.
create or replace function public.fn_email_proxima_janela(p_agora timestamptz default now())
returns timestamptz
language plpgsql
stable
as $$
declare
  v_local timestamp;
  v_hora  int;
begin
  v_local := p_agora at time zone 'America/Sao_Paulo';
  v_hora  := extract(hour from v_local);

  if v_hora >= 8 and v_hora < 22 then
    return p_agora;
  end if;

  -- antes das 8h: hoje às 8h; a partir das 22h: amanhã às 8h
  if v_hora < 8 then
    return (date_trunc('day', v_local) + interval '8 hours') at time zone 'America/Sao_Paulo';
  end if;
  return (date_trunc('day', v_local) + interval '1 day 8 hours') at time zone 'America/Sao_Paulo';
end;
$$;

create or replace function public.fn_email_pode_marketing(p_loja uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select marketing_permitido from public.email_consentimentos
      where loja_id = p_loja and email = lower(p_email)
    ), false)
    and not exists (
      select 1 from public.email_log
      where loja_id = p_loja
        and lower(recipient) = lower(p_email)
        and classe = 'MARKETING'
        and status = 'sent'
        and sent_at > now() - interval '7 days'
    );
$$;

-- ── 5. Porta de entrada única da fila ───────────────────────
-- Todo disparo do sistema passa por aqui: valida destinatário,
-- aplica consentimento e janela, e deduplica.
create or replace function public.fn_email_enfileirar(
  p_loja          uuid,
  p_evento        text,
  p_destinatario  text,
  p_payload       jsonb default '{}'::jsonb,
  p_referencia_id uuid default null,
  p_classe        text default 'TRANSACIONAL'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_agendado timestamptz := now();
begin
  if p_destinatario is null or p_destinatario !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return null;
  end if;

  if p_classe = 'MARKETING' then
    if not public.fn_email_pode_marketing(p_loja, p_destinatario) then
      return null;
    end if;
    v_agendado := public.fn_email_proxima_janela();
  end if;

  insert into public.email_fila (loja_id, evento, referencia_id, destinatario, classe, payload, agendado_para)
  values (p_loja, p_evento, p_referencia_id, lower(p_destinatario), p_classe, coalesce(p_payload, '{}'::jsonb), v_agendado)
  on conflict do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- ── 6. Descadastro sem login ────────────────────────────────
-- O link do rodapé carrega só o token; nada de e-mail na URL.
create or replace function public.fn_email_descadastrar(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok int;
begin
  update public.email_consentimentos
  set marketing_permitido = false, atualizado_em = now()
  where descadastro_token = p_token;
  get diagnostics v_ok = row_count;
  return v_ok > 0;
end;
$$;

grant execute on function public.fn_email_descadastrar(uuid) to anon, authenticated;

-- ── 7. RLS ──────────────────────────────────────────────────
-- Leitura só para o admin da loja; escrita só pelo service role
-- (worker e triggers SECURITY DEFINER).
alter table public.email_fila            enable row level security;
alter table public.email_consentimentos  enable row level security;
alter table public.email_log             enable row level security;

drop policy if exists email_fila_admin on public.email_fila;
create policy email_fila_admin on public.email_fila
  for select using (public.fn_sou_admin(loja_id));

drop policy if exists email_consent_admin on public.email_consentimentos;
create policy email_consent_admin on public.email_consentimentos
  for select using (public.fn_sou_admin(loja_id));

drop policy if exists email_log_admin on public.email_log;
create policy email_log_admin on public.email_log
  for select using (loja_id is not null and public.fn_sou_admin(loja_id));

-- ── 8. Reserva atômica para o worker ────────────────────────
-- FOR UPDATE SKIP LOCKED: duas execuções simultâneas do worker
-- nunca pegam a mesma linha, então o cliente não recebe em dobro.
create or replace function public.fn_email_reservar(p_limite int default 20)
returns setof public.email_fila
language sql
security definer
set search_path = public
as $$
  update public.email_fila f
  set status = 'ENVIANDO', atualizado_em = now()
  where f.id in (
    select id from public.email_fila
    where status = 'PENDENTE' and agendado_para <= now()
    order by criado_em
    limit p_limite
    for update skip locked
  )
  returning f.*;
$$;
