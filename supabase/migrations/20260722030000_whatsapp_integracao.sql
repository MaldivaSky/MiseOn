-- ============================================================================
-- WhatsApp — E1: schema, fila de eventos e hardening de RLS do chat
-- Ver docs/PLANO-WHATSAPP.md §6.1
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Conexão por loja. Credenciais NUNCA vão pro client (RN-15) — só
--    service_role (Edge Functions) escreve/lê a tabela toda; staff lê via
--    fn_whatsapp_status (§4), que mascara tudo que é segredo.
-- ----------------------------------------------------------------------------
create table public.whatsapp_conexoes (
  loja_id           uuid primary key references public.lojas(id) on delete cascade,
  phone_number_id   text not null unique,          -- roteamento multi-tenant (RN-05)
  waba_id           text,
  display_phone     text,                          -- exibição na UI (não é segredo)
  access_token      text not null,                 -- token permanente do lojista
  app_secret        text not null,                 -- valida X-Hub-Signature-256 (RN-04)
  verify_token      text not null,                 -- gerado por nós no handshake GET
  status            text not null default 'PENDENTE'
                    check (status in ('PENDENTE','CONECTADO','ERRO')),
  ultimo_erro       text,
  conectado_em      timestamptz,
  criado_em         timestamptz not null default now()
);

alter table public.whatsapp_conexoes enable row level security;
-- Sem policy para anon/authenticated de propósito: RLS ligada + zero policy =
-- nega tudo via PostgREST. Único acesso: service_role (bypassa RLS) e a RPC
-- fn_whatsapp_status abaixo.

-- ----------------------------------------------------------------------------
-- 2) Fila de eventos recebidos. Garante o 200 em <5s (RN-02, webhook só
--    insere aqui) e a idempotência via UNIQUE (RN-03, a Meta reenvia).
-- ----------------------------------------------------------------------------
create table public.whatsapp_eventos (
  id             uuid primary key default gen_random_uuid(),
  loja_id        uuid not null references public.lojas(id) on delete cascade,
  wa_message_id  text not null unique,
  payload        jsonb not null,
  status         text not null default 'PENDENTE'
                 check (status in ('PENDENTE','PROCESSANDO','OK','ERRO')),
  tentativas     int not null default 0,
  erro           text,
  criado_em      timestamptz not null default now(),
  processado_em  timestamptz
);

create index idx_wa_eventos_pendentes on public.whatsapp_eventos(status, criado_em)
  where status = 'PENDENTE';
create index idx_wa_eventos_loja on public.whatsapp_eventos(loja_id);

alter table public.whatsapp_eventos enable row level security;
-- Idem: sem policy — só service_role (webhook/worker) toca nesta tabela.

-- ----------------------------------------------------------------------------
-- 3) Rate limit em Postgres (RN-11). Um Map in-memory não funciona em
--    serverless multi-isolate — ver bug do chat-ai-reception atual.
-- ----------------------------------------------------------------------------
create table public.whatsapp_rate_limit (
  chave      text primary key,   -- 'tel:5511...' | 'loja:<uuid>'
  janela_ini timestamptz not null,
  contador   int not null default 0
);

alter table public.whatsapp_rate_limit enable row level security;
-- Idem: só service_role.

-- ----------------------------------------------------------------------------
-- 4) RPC de leitura para a tela do lojista (§7.1) — nunca expõe
--    access_token/app_secret/verify_token.
-- ----------------------------------------------------------------------------
create function public.fn_whatsapp_status(p_loja_id uuid)
returns table (
  status         text,
  display_phone  text,
  phone_number_id text,
  ultimo_erro    text,
  conectado_em   timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select c.status, c.display_phone, c.phone_number_id, c.ultimo_erro, c.conectado_em
  from public.whatsapp_conexoes c
  where c.loja_id = p_loja_id
    and public.fn_meu_acesso(p_loja_id);
$$;

revoke all on function public.fn_whatsapp_status(uuid) from public, anon;
grant execute on function public.fn_whatsapp_status(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) chat_conversations: canal, telefone, janela de 24h, atribuição de pedido
-- ----------------------------------------------------------------------------
alter table public.chat_conversations
  add column if not exists canal text not null default 'VITRINE'
    check (canal in ('VITRINE','WHATSAPP')),
  add column if not exists telefone text,
  add column if not exists wa_janela_expira_em timestamptz,   -- RN-09
  add column if not exists atribuicao_token text;             -- RN-12

create unique index if not exists idx_chat_conv_wa
  on public.chat_conversations(loja_id, telefone)
  where canal = 'WHATSAPP';
create index if not exists idx_chat_conv_loja_canal
  on public.chat_conversations(loja_id, canal);

-- ----------------------------------------------------------------------------
-- 6) pedidos: atribuição ao chat que originou o pedido (funil de conversão)
-- ----------------------------------------------------------------------------
alter table public.pedidos
  add column if not exists chat_conversation_id uuid references public.chat_conversations(id);
create index if not exists idx_pedidos_chat_conversation on public.pedidos(chat_conversation_id);

-- ----------------------------------------------------------------------------
-- 7) Config por loja: kill switch (RN-13), templates fora da janela (RN-09)
-- ----------------------------------------------------------------------------
alter table public.lojas
  add column if not exists whatsapp_ia_ativo boolean not null default false,
  add column if not exists whatsapp_templates_ativo boolean not null default false,
  add column if not exists whatsapp_saudacao text;

-- ----------------------------------------------------------------------------
-- 8) Hardening de RLS do chat — bloqueante (LGPD, RN-14).
--    Hoje `USING (true)` deixa qualquer chave anon ler/escrever qualquer
--    conversa de qualquer loja. Tolerável para o chat anônimo de vitrine
--    (limitação pré-existente, fora de escopo desta migration); inaceitável
--    para WHATSAPP, cujas linhas passam a ter telefone/nome/endereço de
--    todos os tenants. Regra: canal='WHATSAPP' nunca é legível/gravável por
--    anon/authenticated-não-staff — só pelo worker (service_role) e pelo
--    lojista dono (fn_meu_acesso, já coberto pela policy *_loja existente).
-- ----------------------------------------------------------------------------
drop policy if exists chat_conversations_cliente_select on public.chat_conversations;
create policy chat_conversations_cliente_select on public.chat_conversations
  for select using (canal = 'VITRINE');

drop policy if exists chat_conversations_cliente_insert on public.chat_conversations;
create policy chat_conversations_cliente_insert on public.chat_conversations
  for insert with check (canal = 'VITRINE');

drop policy if exists chat_messages_cliente_select on public.chat_messages;
create policy chat_messages_cliente_select on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id and c.canal = 'VITRINE'
    )
  );

drop policy if exists chat_messages_cliente_insert on public.chat_messages;
create policy chat_messages_cliente_insert on public.chat_messages
  for insert with check (
    remetente_tipo = 'CLIENTE'
    and exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id and c.canal = 'VITRINE'
    )
  );
