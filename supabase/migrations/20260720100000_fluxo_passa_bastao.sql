-- ============================================================
-- Fluxo "passa-bastão" balcão ⇄ cozinha — E1 (banco/enforcement)
-- Plano completo: docs/PLANO-FLUXO-PEDIDOS.md
--
-- Decisão fixa: NÃO cria status novo em status_pedido (quebraria
-- cliente/entregador/webhooks). O bastão é modelado por cima da
-- cadeia existente via pedidos.estacao_atual.
--
-- Confirmado por auditoria do schema real antes de escrever isto:
--  - baixa de estoque dispara em NOVO→ACEITO (fn_trg_status_pedido),
--    não em PRONTO — o atalho de revenda direta não duplica nem pula.
--  - equipe = tabela usuarios_loja (PK composta user_id+loja_id, sem id).
--  - fechamento de comanda (Mesas.tsx) finaliza pedidos SALAO em
--    qualquer status — a trigger precisa permitir isso explicitamente.
-- ============================================================

-- ── 1. Colunas novas ─────────────────────────────────────────
alter table produtos add column if not exists estacao_preparo text not null default 'COZINHA'
  check (estacao_preparo in ('COZINHA','DIRETO'));

alter table pedidos add column if not exists estacao_atual text not null default 'BALCAO'
  check (estacao_atual in ('BALCAO','COZINHA'));
alter table pedidos add column if not exists requer_cozinha boolean not null default true;
alter table pedidos add column if not exists enviado_cozinha_em timestamptz;
alter table pedidos add column if not exists devolvido_balcao_em timestamptz;
alter table pedidos add column if not exists conferido_em timestamptz;

alter table historico_pedidos add column if not exists operador_user_id uuid references auth.users(id) on delete set null;

alter table lojas add column if not exists meta_preparo_min integer not null default 20;

create index if not exists idx_pedidos_estacao_ativos on pedidos (loja_id, estacao_atual)
  where status not in ('FINALIZADO','CANCELADO');

comment on column produtos.estacao_preparo is 'COZINHA = precisa de preparo (entra no KDS). DIRETO = revenda direta (balcão entrega sem passar pela cozinha).';
comment on column pedidos.estacao_atual is 'Bastão do fluxo: BALCAO ou COZINHA. Só a estação dona pode avançar o status (enforced por trigger).';
comment on column pedidos.requer_cozinha is 'true se algum item do pedido é estacao_preparo=COZINHA. Calculado por trigger em itens_pedido.';

-- ── 2. requer_cozinha calculado a partir dos itens ──────────
-- Item sem produto vinculado (ex.: item avulso de PDV) conta como
-- COZINHA por segurança (RN-02 do plano) — melhor congestionar do
-- que deixar de avisar a cozinha por engano.
create or replace function fn_trg_promove_requer_cozinha()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_estacao text;
begin
  if NEW.produto_id is null then
    v_estacao := 'COZINHA';
  else
    select estacao_preparo into v_estacao from produtos where id = NEW.produto_id;
    v_estacao := coalesce(v_estacao, 'COZINHA');
  end if;

  if v_estacao = 'COZINHA' then
    update pedidos set requer_cozinha = true where id = NEW.pedido_id and requer_cozinha = false;
  end if;

  return NEW;
end;
$function$;

drop trigger if exists trg_promove_requer_cozinha on itens_pedido;
create trigger trg_promove_requer_cozinha
  after insert on itens_pedido
  for each row execute function fn_trg_promove_requer_cozinha();

-- ── 3. Validação de transição de STATUS (o coração do plano) ─
-- Nome começa com "00_" para rodar ANTES de trg_status_pedido em
-- ordem alfabética (triggers BEFORE do mesmo evento/tabela disparam
-- em ordem de nome) — uma transição inválida é rejeitada antes de
-- qualquer efeito colateral (baixa de estoque, cashback) executar.
create or replace function fn_valida_transicao_pedido()
returns trigger
language plpgsql
security definer
as $function$
declare
  eh_admin boolean;
begin
  -- Sem mudança de status (ex.: outro campo incluiu status no SET
  -- com o mesmo valor, como acontece em entregador/Rota.tsx ao
  -- re-marcar os demais pedidos do lote como PRONTO) — sempre ok.
  if NEW.status = OLD.status then
    return NEW;
  end if;

  -- NOVO → ACEITO: ato do balcão/PDV/Pix-webhook aceitando o pedido. Livre.
  if OLD.status = 'NOVO' and NEW.status = 'ACEITO' then
    return NEW;
  end if;

  -- ACEITO → PREPARANDO: só quando o bastão já está com a cozinha.
  if OLD.status = 'ACEITO' and NEW.status = 'PREPARANDO' then
    if OLD.estacao_atual <> 'COZINHA' then
      raise exception 'Pedido #% ainda não foi enviado para a cozinha.', OLD.numero;
    end if;
    return NEW;
  end if;

  -- ACEITO → PRONTO: atalho de revenda direta (não passa pela cozinha).
  if OLD.status = 'ACEITO' and NEW.status = 'PRONTO' then
    if OLD.requer_cozinha then
      raise exception 'Pedido #% tem item de preparo — envie para a cozinha antes de marcar pronto.', OLD.numero;
    end if;
    return NEW;
  end if;

  -- PREPARANDO → PRONTO: só a cozinha. Devolve o bastão ao balcão
  -- automaticamente (RN-06) — a cozinha não precisa de gesto extra.
  if OLD.status = 'PREPARANDO' and NEW.status = 'PRONTO' then
    if OLD.estacao_atual <> 'COZINHA' then
      raise exception 'Pedido #% não está com a cozinha no momento.', OLD.numero;
    end if;
    NEW.estacao_atual := 'BALCAO';
    NEW.devolvido_balcao_em := now();
    return NEW;
  end if;

  -- PRONTO → EM_ROTA/FINALIZADO: exige bastão no balcão (conferência
  -- feita, RN-07) e compatibilidade com o tipo do pedido (RN-08).
  if OLD.status = 'PRONTO' and NEW.status in ('EM_ROTA','FINALIZADO') then
    if OLD.estacao_atual <> 'BALCAO' then
      raise exception 'Pedido #% ainda está com a cozinha.', OLD.numero;
    end if;
    if NEW.status = 'EM_ROTA' and OLD.tipo_pedido <> 'DELIVERY' then
      raise exception 'Só pedidos de entrega saem para rota.';
    end if;
    if NEW.status = 'FINALIZADO' and OLD.tipo_pedido = 'DELIVERY' then
      raise exception 'Pedido de entrega precisa sair para rota antes de finalizar.';
    end if;
    NEW.conferido_em := coalesce(OLD.conferido_em, now());
    return NEW;
  end if;

  -- EM_ROTA → FINALIZADO: fluxo do entregador, inalterado.
  if OLD.status = 'EM_ROTA' and NEW.status = 'FINALIZADO' then
    return NEW;
  end if;

  -- Fechamento de comanda de mesa (Mesas.tsx): encerra qualquer
  -- pedido SALAO aberto da comanda de uma vez, mesmo que a cozinha
  -- ainda não tenha devolvido o bastão — é decisão operacional do
  -- salão (staff confirma que a comida já saiu antes de fechar a
  -- conta), não deve ficar preso ao fluxo de produção.
  if NEW.status = 'FINALIZADO' and OLD.tipo_pedido = 'SALAO' and OLD.status not in ('FINALIZADO','CANCELADO') then
    return NEW;
  end if;

  -- Cancelamento.
  if NEW.status = 'CANCELADO' then
    if OLD.status in ('FINALIZADO','CANCELADO') then
      raise exception 'Pedido #% já foi encerrado.', OLD.numero;
    end if;
    if OLD.status in ('NOVO','ACEITO') and OLD.estacao_atual = 'BALCAO' then
      return NEW; -- livre: a cozinha nem começou
    end if;
    eh_admin := exists (
      select 1 from usuarios_loja
      where user_id = auth.uid() and loja_id = OLD.loja_id and papel = 'admin'
    );
    if not eh_admin then
      raise exception 'A cozinha já iniciou este pedido — só um admin pode cancelar agora.';
    end if;
    return NEW;
  end if;

  raise exception 'Transição de status inválida: % → % (pedido #%).', OLD.status, NEW.status, OLD.numero;
end;
$function$;

drop trigger if exists trg_00_valida_transicao_pedido on pedidos;
create trigger trg_00_valida_transicao_pedido
  before update of status on pedidos
  for each row execute function fn_valida_transicao_pedido();

-- ── 4. Validação da passagem do BASTÃO (estacao_atual) ──────
-- Só dispara quando o cliente muda estacao_atual explicitamente
-- (ação "Enviar para a cozinha"). A devolução automática COZINHA→
-- BALCAO acontece dentro de fn_valida_transicao_pedido (item 3) e
-- não passa pelo SET clause do cliente, então não re-dispara aqui.
create or replace function fn_valida_estacao_pedido()
returns trigger
language plpgsql
security definer
as $function$
begin
  if OLD.estacao_atual = NEW.estacao_atual then
    return NEW;
  end if;

  if OLD.estacao_atual = 'BALCAO' and NEW.estacao_atual = 'COZINHA' then
    if OLD.status <> 'ACEITO' then
      raise exception 'Só é possível enviar para a cozinha um pedido ACEITO (pedido #%).', OLD.numero;
    end if;
    if not OLD.requer_cozinha then
      raise exception 'Pedido #% não tem item de preparo — não precisa ir para a cozinha.', OLD.numero;
    end if;
    NEW.enviado_cozinha_em := now();
    return NEW;
  end if;

  raise exception 'Transição de bastão inválida: % → % (pedido #%).', OLD.estacao_atual, NEW.estacao_atual, OLD.numero;
end;
$function$;

drop trigger if exists trg_valida_estacao_pedido on pedidos;
create trigger trg_valida_estacao_pedido
  before update of estacao_atual on pedidos
  for each row execute function fn_valida_estacao_pedido();

-- ── 5. Log de histórico ganha "quem" (operador) ─────────────
-- O operador vem de uma GUC de transação (set_config(..., true)),
-- setada só dentro de fn_avancar_status_pedido — nunca por uma GUC
-- de sessão, que vazaria entre requisições num pool de conexões
-- (PgBouncer transaction mode). Fora dessa RPC, operador fica NULL
-- (RN-12: não travar a operação por falta de seleção de operador).
create or replace function fn_trg_historico_pedido()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_operador uuid;
begin
  if TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status) then
    v_operador := nullif(current_setting('miseon.operador_atual', true), '')::uuid;
    insert into historico_pedidos (pedido_id, status, operador_user_id) values (NEW.id, NEW.status, v_operador);
  end if;
  return NEW;
end;
$function$;

-- ── 6. RPCs de escrita (mantêm .update() direto funcionando nos
--       call sites ainda não migrados; passam a ser o caminho
--       recomendado para quem precisa registrar operador) ──────
create or replace function fn_avancar_status_pedido(
  p_pedido_id uuid,
  p_novo_status status_pedido,
  p_operador_user_id uuid default null
)
returns void
language plpgsql
security definer
as $function$
declare
  v_loja_id uuid;
begin
  select loja_id into v_loja_id from pedidos where id = p_pedido_id;
  if v_loja_id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if not exists (select 1 from usuarios_loja where user_id = auth.uid() and loja_id = v_loja_id) then
    raise exception 'Acesso negado.';
  end if;

  if p_operador_user_id is not null then
    perform set_config('miseon.operador_atual', p_operador_user_id::text, true);
  end if;

  update pedidos set status = p_novo_status where id = p_pedido_id;
end;
$function$;

create or replace function fn_enviar_pedido_cozinha(p_pedido_id uuid)
returns void
language plpgsql
security definer
as $function$
declare
  v_loja_id uuid;
begin
  select loja_id into v_loja_id from pedidos where id = p_pedido_id;
  if v_loja_id is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if not exists (select 1 from usuarios_loja where user_id = auth.uid() and loja_id = v_loja_id) then
    raise exception 'Acesso negado.';
  end if;

  update pedidos set estacao_atual = 'COZINHA' where id = p_pedido_id;
end;
$function$;

-- ── 7. Métricas de cozinha (gamificação + dashboard) ─────────
-- Streak (dias consecutivos dentro da meta) é calculado no CLIENTE
-- a partir de por_dia (mais simples e testável do que recursão SQL).
create or replace function fn_metricas_cozinha(
  p_loja_id uuid,
  p_de date default (current_date - interval '6 days')::date,
  p_ate date default current_date
)
returns json
language plpgsql
security definer
as $function$
declare
  v_meta int;
  v_resultado json;
begin
  if not exists (select 1 from usuarios_loja where user_id = auth.uid() and loja_id = p_loja_id) then
    raise exception 'Acesso negado.';
  end if;

  select meta_preparo_min into v_meta from lojas where id = p_loja_id;
  v_meta := coalesce(v_meta, 20);

  with marcos as (
    select
      h.pedido_id,
      min(h.criado_em) filter (where h.status = 'ACEITO')     as em_aceito,
      min(h.criado_em) filter (where h.status = 'PREPARANDO') as em_preparando,
      min(h.criado_em) filter (where h.status = 'PRONTO')     as em_pronto,
      (array_agg(h.operador_user_id order by h.criado_em) filter (where h.status = 'PRONTO'))[1] as operador_pronto
    from historico_pedidos h
    where h.pedido_id in (select id from pedidos where loja_id = p_loja_id and requer_cozinha)
    group by h.pedido_id
  ),
  concluidos as (
    select m.*, p.criado_em::date as dia,
      extract(epoch from (m.em_pronto - m.em_aceito)) / 60.0 as min_total
    from marcos m
    join pedidos p on p.id = m.pedido_id
    where m.em_pronto is not null and m.em_aceito is not null
      and p.criado_em::date between p_de and p_ate
  ),
  por_dia as (
    select dia,
      count(*) as pedidos,
      round(avg(min_total)::numeric, 1) as media_total_min,
      round((count(*) filter (where min_total <= v_meta))::numeric / count(*) * 100, 0) as pct_dentro_meta
    from concluidos
    group by dia
    order by dia
  ),
  por_operador as (
    select
      c.operador_pronto as operador_user_id,
      coalesce(u.nome, 'Sem operador') as operador_nome,
      count(*) as pedidos,
      round(avg(c.min_total)::numeric, 1) as media_min
    from concluidos c
    left join usuarios_loja u on u.user_id = c.operador_pronto and u.loja_id = p_loja_id
    group by c.operador_pronto, u.nome
    order by media_min asc nulls last
    limit 10
  )
  select json_build_object(
    'meta_min', v_meta,
    'por_dia', coalesce((select json_agg(por_dia) from por_dia), '[]'::json),
    'ranking_operadores', coalesce((select json_agg(por_operador) from por_operador), '[]'::json),
    'media_hoje_min', (select media_total_min from por_dia where dia = current_date),
    'pedidos_hoje', (select pedidos from por_dia where dia = current_date)
  ) into v_resultado;

  return v_resultado;
end;
$function$;
