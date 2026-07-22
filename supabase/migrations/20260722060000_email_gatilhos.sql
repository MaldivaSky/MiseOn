-- ============================================================
-- MiseOn — Gatilhos de e-mail ligados aos eventos de negócio
--
-- Princípio: e-mail é consequência de transição de estado, nunca de
-- clique. Quem enfileira é o banco, no mesmo instante em que o fato
-- acontece — então funciona igual vindo do PDV, do webhook da Efí,
-- do iFood ou de um script.
--
-- O payload guardado é mínimo. Os dados do pedido são montados no
-- momento do envio (fn_email_pedido_payload), porque no INSERT do
-- pedido os itens ainda não existem — eles entram logo depois, em
-- itens_pedido. Montar cedo geraria e-mail sem os itens.
--
-- As URLs NÃO são montadas aqui: o domínio vive no secret SITE_URL,
-- fonte única. O worker concatena na hora do envio.
-- ============================================================

-- ── Formatação monetária pt-BR ──────────────────────────────
create or replace function public.fn_brl(p_valor numeric)
returns text
language sql
immutable
as $$
  select replace(replace(replace(
    to_char(coalesce(p_valor, 0), 'FM999G999G990D00'),
    '.', '#'), ',', '.'), '#', ',');
$$;

-- ── A quem avisar sobre este pedido ─────────────────────────
-- Cadastro é telefone-first, então e-mail é opcional: sem endereço
-- válido, fn_email_enfileirar simplesmente ignora e nada é enviado.
create or replace function public.fn_email_do_pedido(p_pedido public.pedidos)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select c.email from public.clientes c
      where c.id = p_pedido.cliente_id and c.email is not null),
    (select u.email::text from auth.users u
      where u.id = p_pedido.cliente_user_id)
  );
$$;

-- ── Dados do pedido, montados na hora do envio ──────────────
create or replace function public.fn_email_pedido_payload(p_pedido_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'pedido_id',      p.id,
    'pedido_numero',  p.numero::text,
    'cliente_nome',   nullif(split_part(trim(coalesce(c.nome, p.identificador_cliente, '')), ' ', 1), ''),
    'valor_total',    public.fn_brl(p.valor_total),
    'taxa_entrega',   case when coalesce(p.taxa_entrega, 0) > 0 then public.fn_brl(p.taxa_entrega) end,
    'desconto',       case when coalesce(p.desconto, 0)     > 0 then public.fn_brl(p.desconto)     end,
    'endereco_entrega', nullif(trim(coalesce(p.endereco_entrega, '')), ''),
    'entrega_em',     nullif(trim(coalesce(p.endereco_entrega, '')), ''),
    'entregue_em',    to_char(p.atualizado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'),
    'itens', (
      select jsonb_agg(jsonb_build_object(
               'qtd',   i.quantidade,
               'nome',  i.nome_produto,
               'valor', public.fn_brl(i.preco_unitario * i.quantidade))
             order by i.nome_produto)
      from public.itens_pedido i where i.pedido_id = p.id
    )
  ))
  from public.pedidos p
  left join public.clientes c on c.id = p.cliente_id
  where p.id = p_pedido_id;
$$;

-- ── Pedido criado → confirmação ─────────────────────────────
create or replace function public.fn_trg_email_pedido_criado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  v_email := public.fn_email_do_pedido(new);
  if v_email is not null then
    perform public.fn_email_enfileirar(
      new.loja_id, 'pedido-recebido', v_email, '{}'::jsonb, new.id, 'TRANSACIONAL');
  end if;
  return null;
exception when others then
  -- Falha de e-mail nunca pode derrubar a criação do pedido.
  raise warning 'fn_trg_email_pedido_criado: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists trg_email_pedido_criado on public.pedidos;
create trigger trg_email_pedido_criado
  after insert on public.pedidos
  for each row execute function public.fn_trg_email_pedido_criado();

-- ── Mudança de status → a caminho / entregue ────────────────
create or replace function public.fn_trg_email_pedido_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_evento text;
begin
  if new.status = old.status then return null; end if;

  v_evento := case new.status
                when 'EM_ROTA'    then 'pedido-a-caminho'
                when 'FINALIZADO' then 'pedido-entregue'
              end;
  if v_evento is null then return null; end if;

  -- Salão não gera aviso de entrega: o cliente está na mesa.
  if new.tipo_pedido = 'SALAO' then return null; end if;

  v_email := public.fn_email_do_pedido(new);
  if v_email is not null then
    perform public.fn_email_enfileirar(
      new.loja_id, v_evento, v_email, '{}'::jsonb, new.id, 'TRANSACIONAL');
  end if;
  return null;
exception when others then
  raise warning 'fn_trg_email_pedido_status: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists trg_email_pedido_status on public.pedidos;
create trigger trg_email_pedido_status
  after update of status on public.pedidos
  for each row execute function public.fn_trg_email_pedido_status();

-- ── Pagamento confirmado ────────────────────────────────────
-- Fica no banco, e não dentro do pix-webhook, para valer também no
-- cartão, no PDV e em qualquer caminho futuro. A referência é o
-- pedido: pagamento dividido não vira dois e-mails.
create or replace function public.fn_trg_email_pagamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos;
  v_email  text;
begin
  if new.status <> 'PAGO' then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'PAGO' then return null; end if;

  select * into v_pedido from public.pedidos where id = new.pedido_id;
  if not found then return null; end if;

  v_email := public.fn_email_do_pedido(v_pedido);
  if v_email is null then return null; end if;

  perform public.fn_email_enfileirar(
    v_pedido.loja_id,
    'pagamento-confirmado',
    v_email,
    jsonb_strip_nulls(jsonb_build_object(
      'valor',          public.fn_brl(new.valor_pago),
      'metodo',         case new.metodo::text
                          when 'PIX'      then 'Pix'
                          when 'CREDITO'  then 'Cartão de crédito'
                          when 'DEBITO'   then 'Cartão de débito'
                          when 'DINHEIRO' then 'Dinheiro'
                          else new.metodo::text end,
      'transacao_id',   new.gateway_txid,
      'data_pagamento', to_char(coalesce(new.data_pagamento, now()) at time zone 'America/Sao_Paulo',
                                'DD/MM/YYYY "às" HH24:MI')
    )),
    v_pedido.id,
    'TRANSACIONAL');
  return null;
exception when others then
  raise warning 'fn_trg_email_pagamento: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists trg_email_pagamento on public.pagamentos;
create trigger trg_email_pagamento
  after insert or update of status on public.pagamentos
  for each row execute function public.fn_trg_email_pagamento();

-- ── Carrinho abandonado ─────────────────────────────────────
-- Único evento sem ator: ninguém "abandona" clicando. Precisa de
-- varredura periódica, chamada pelo worker a cada rodada.
create or replace function public.fn_email_varrer_carrinhos(p_minutos int default 45)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg   record;
  v_total int := 0;
begin
  for v_reg in
    select ca.id, ca.loja_id, ca.valor_estimado, c.email, c.nome
    from public.carrinhos_abandonados ca
    join public.clientes c on c.id = ca.cliente_id
    where ca.status = 'ABERTO'
      and c.email is not null
      and ca.atualizado_em < now() - make_interval(mins => p_minutos)
      and ca.atualizado_em > now() - interval '2 days'
  loop
    if public.fn_email_enfileirar(
         v_reg.loja_id, 'carrinho-abandonado', v_reg.email,
         jsonb_strip_nulls(jsonb_build_object(
           'cliente_nome',    nullif(split_part(trim(coalesce(v_reg.nome, '')), ' ', 1), ''),
           'valor_estimado',  public.fn_brl(v_reg.valor_estimado))),
         v_reg.id, 'MARKETING') is not null
    then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;
