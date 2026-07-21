-- ============================================================
-- MiseOn — Mesas avançadas: transferência de comanda e
-- movimentação/divisão de itens entre pedidos (split de conta
-- por item e junção de mesas).
--
-- Modelo (100% reuso do que já existe):
--  - fn_transferir_comanda: troca a comanda aberta de mesa e
--    atualiza o snapshot pedidos.mesa_numero (KDS/painel) —
--    nenhum status de pedido é tocado.
--  - fn_mover_itens_pedido: cria pedido(s) NOVO(s) e move os
--    itens selecionados (itens_pedido_opcoes acompanham via FK
--    item_id). Subtotal/valor_total são recalculados no servidor
--    com a mesma fórmula de fn_recalcular_pedido (sem cupom/
--    cashback — desconto e taxa_entrega do pedido novo nascem 0).
--  - NENHUMA transição de status é feita aqui, então não há
--    atrito com trg_00_valida_transicao_pedido: os pedidos novos
--    nascem NOVO e seguem o fluxo normal (balcão aceita etc.).
-- ============================================================

-- ── 1. Transferir comanda aberta para outra mesa ─────────────
create or replace function fn_transferir_comanda(
  p_comanda_id uuid,
  p_nova_mesa_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_comanda comandas%rowtype;
  v_mesa    mesas%rowtype;
begin
  select * into v_comanda from comandas where id = p_comanda_id;
  if v_comanda.id is null then
    raise exception 'Comanda não encontrada.';
  end if;
  if v_comanda.status <> 'ABERTA' then
    raise exception 'A comanda não está aberta.';
  end if;
  if not fn_meu_acesso(v_comanda.loja_id) then
    raise exception 'Acesso negado.';
  end if;
  if v_comanda.mesa_id = p_nova_mesa_id then
    raise exception 'A comanda já está nesta mesa.';
  end if;

  -- FOR UPDATE serializa transferências concorrentes para a
  -- mesma mesa (a checagem de comanda aberta abaixo fica segura).
  select * into v_mesa from mesas where id = p_nova_mesa_id for update;
  if v_mesa.id is null or v_mesa.loja_id <> v_comanda.loja_id then
    raise exception 'Mesa de destino não encontrada.';
  end if;
  if not v_mesa.ativo then
    raise exception 'A mesa de destino está inativa.';
  end if;
  if exists (select 1 from comandas where mesa_id = p_nova_mesa_id and status = 'ABERTA') then
    raise exception 'A mesa % já tem uma comanda aberta.', v_mesa.numero;
  end if;

  update comandas set mesa_id = p_nova_mesa_id where id = p_comanda_id;
  update pedidos set mesa_numero = v_mesa.numero where comanda_id = p_comanda_id;
end;
$function$;

-- ── 2. Mover itens para pedido novo (split / junção de mesa) ─
-- p_comanda_destino_id NULL  → divisão de conta: o pedido novo
--   fica na MESMA comanda (cada parte paga a sua).
-- p_comanda_destino_id preenchido → junção de mesas: os itens
--   vão para a comanda aberta de outra mesa; se a comanda de
--   origem ficar sem nenhum pedido ativo, ela é fechada (MISTO).
--
-- Se a seleção abranger itens de MAIS de um pedido, é criado um
-- pedido novo por pedido de origem e a função retorna o id do
-- PRIMEIRO criado (o frontend normalmente seleciona de um pedido
-- por vez).
create or replace function fn_mover_itens_pedido(
  p_item_ids uuid[],
  p_comanda_destino_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_pedidos         uuid[];
  v_comandas        uuid[];
  v_comanda         comandas%rowtype;
  v_dest_loja       uuid;
  v_dest_mesa_num   int;
  v_src             record;
  v_novo_pedido     uuid;
  v_primeiro_novo   uuid;
  v_subtotal        numeric;
begin
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception 'Selecione ao menos um item para mover.';
  end if;

  if (select count(*) from itens_pedido where id = any(p_item_ids))
     <> (select count(distinct x) from unnest(p_item_ids) as x) then
    raise exception 'Um ou mais itens não foram encontrados.';
  end if;

  select array_agg(distinct p.id), array_agg(distinct p.comanda_id)
    into v_pedidos, v_comandas
  from itens_pedido ip
  join pedidos p on p.id = ip.pedido_id
  where ip.id = any(p_item_ids);

  if array_length(v_comandas, 1) > 1 then
    raise exception 'Os itens selecionados pertencem a comandas diferentes.';
  end if;
  if v_comandas[1] is null then
    raise exception 'Os itens selecionados não pertencem a uma comanda de mesa.';
  end if;

  -- FOR UPDATE serializa splits concorrentes na mesma comanda.
  select * into v_comanda from comandas where id = v_comandas[1] for update;
  if v_comanda.status <> 'ABERTA' then
    raise exception 'A comanda não está aberta.';
  end if;
  if not fn_meu_acesso(v_comanda.loja_id) then
    raise exception 'Acesso negado.';
  end if;

  if exists (select 1 from pedidos where id = any(v_pedidos) and status in ('FINALIZADO','CANCELADO')) then
    raise exception 'Não é possível mover itens de pedido já encerrado.';
  end if;
  if exists (select 1 from pagamentos where pedido_id = any(v_pedidos) and status = 'PAGO') then
    raise exception 'Não é possível mover itens de pedido já pago.';
  end if;

  -- Cada pedido de origem precisa manter ao menos 1 item —
  -- esvaziar o pedido é transferência de mesa, não split.
  if exists (
    select 1 from pedidos p
    where p.id = any(v_pedidos)
      and not exists (
        select 1 from itens_pedido ip
        where ip.pedido_id = p.id and not (ip.id = any(p_item_ids))
      )
  ) then
    raise exception 'Selecione apenas parte dos itens do pedido, ou use a transferência de mesa.';
  end if;

  if p_comanda_destino_id is not null then
    select c.loja_id, m.numero
      into v_dest_loja, v_dest_mesa_num
    from comandas c
    join mesas m on m.id = c.mesa_id
    where c.id = p_comanda_destino_id and c.status = 'ABERTA';
    if v_dest_loja is null then
      raise exception 'Comanda de destino não encontrada ou já fechada.';
    end if;
    if v_dest_loja <> v_comanda.loja_id then
      raise exception 'A comanda de destino pertence a outra loja.';
    end if;
  end if;

  for v_src in
    select p.id, p.loja_id, p.tipo_pedido, p.origem, p.cliente_id,
           p.identificador_cliente, p.mesa_numero
    from pedidos p
    where p.id = any(v_pedidos)
  loop
    -- numero é atribuído por trg_numero_pedido; requer_cozinha é
    -- recalculado logo abaixo (a trigger trg_promove_requer_cozinha
    -- é AFTER INSERT e não dispara no UPDATE de pedido_id).
    insert into pedidos (
      loja_id, tipo_pedido, status, origem, cliente_id, identificador_cliente,
      comanda_id, mesa_numero, observacao, taxa_entrega, desconto, requer_cozinha
    ) values (
      v_src.loja_id, v_src.tipo_pedido, 'NOVO', v_src.origem, v_src.cliente_id, v_src.identificador_cliente,
      coalesce(p_comanda_destino_id, v_comanda.id),
      coalesce(v_dest_mesa_num, v_src.mesa_numero),
      null, 0, 0, false
    )
    returning id into v_novo_pedido;

    if v_primeiro_novo is null then
      v_primeiro_novo := v_novo_pedido;
    end if;

    update itens_pedido
    set pedido_id = v_novo_pedido
    where pedido_id = v_src.id and id = any(p_item_ids);

    -- Recalcula origem e destino no servidor (mesma fórmula de
    -- fn_recalcular_pedido, sem cupom/cashback).
    for v_subtotal, v_novo_pedido in
      select s.pedido_id, s.pedido_id from (values (v_src.id), (v_novo_pedido)) as s(pedido_id)
    loop
      null; -- corpo substituído abaixo (mantido simples: dois blocos)
    end loop;

    select coalesce(sum((ip.preco_unitario + coalesce(op.soma, 0)) * ip.quantidade), 0)
      into v_subtotal
    from itens_pedido ip
    left join lateral (
      select sum(coalesce(ipo.preco_adicional, 0)) as soma
      from itens_pedido_opcoes ipo
      where ipo.item_id = ip.id
    ) op on true
    where ip.pedido_id = v_src.id;
    update pedidos
    set subtotal = v_subtotal,
        valor_total = v_subtotal - coalesce(desconto, 0) + coalesce(taxa_entrega, 0)
    where id = v_src.id;

    select coalesce(sum((ip.preco_unitario + coalesce(op.soma, 0)) * ip.quantidade), 0)
      into v_subtotal
    from itens_pedido ip
    left join lateral (
      select sum(coalesce(ipo.preco_adicional, 0)) as soma
      from itens_pedido_opcoes ipo
      where ipo.item_id = ip.id
    ) op on true
    where ip.pedido_id = v_novo_pedido;
    update pedidos
    set subtotal = v_subtotal,
        valor_total = v_subtotal - coalesce(desconto, 0) + coalesce(taxa_entrega, 0)
    where id = v_novo_pedido;

    -- Item sem produto vinculado conta como COZINHA (mesma regra
    -- de fn_trg_promove_requer_cozinha).
    update pedidos p
    set requer_cozinha = exists (
      select 1
      from itens_pedido ip
      left join produtos pr on pr.id = ip.produto_id
      where ip.pedido_id = p.id
        and coalesce(pr.estacao_preparo, 'COZINHA') = 'COZINHA'
    )
    where p.id in (v_src.id, v_novo_pedido);
  end loop;

  -- Junção de mesas: se a comanda de origem ficou sem pedido
  -- ativo, fecha ela (MISTO = os pedidos migraram, o pagamento
  -- acontece na mesa de destino).
  if p_comanda_destino_id is not null
     and not exists (
       select 1 from pedidos
       where comanda_id = v_comanda.id and status not in ('FINALIZADO','CANCELADO')
     ) then
    update comandas
    set status = 'FECHADA',
        fechada_em = now(),
        fechada_por = auth.uid(),
        metodo_pagamento = 'MISTO'
    where id = v_comanda.id;
  end if;

  return v_primeiro_novo;
end;
$function$;

-- ── 3. Grants (mesmo hardening de 20260720100100): RPCs ─────
-- staff-only, só authenticated — a checagem fn_meu_acesso por
-- dentro continua sendo a autoridade real.
revoke all on function fn_transferir_comanda(uuid, uuid) from public, anon;
grant execute on function fn_transferir_comanda(uuid, uuid) to authenticated;

revoke all on function fn_mover_itens_pedido(uuid[], uuid) from public, anon;
grant execute on function fn_mover_itens_pedido(uuid[], uuid) to authenticated;
