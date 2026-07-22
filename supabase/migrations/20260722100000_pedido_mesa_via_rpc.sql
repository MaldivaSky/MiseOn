-- ============================================================
-- MiseOn — Fix P0: pedido de mesa (QR) não era criado por anônimo
--
-- Bug encontrado na validação E2E do fluxo do QR: PedidoMesaDrawer
-- faz .insert().select('id, numero') em pedidos. O PostgREST vira
-- INSERT ... RETURNING, e o Postgres exige policy de SELECT para o
-- RETURNING. O anônimo não tem SELECT em pedidos desde
-- 20260718140000_seguranca_fase_a (que removeu pub_le_pedido por
-- vazamento) — logo o INSERT em si passa (pub_cria_pedido), mas o
-- RETURNING falha com 42501 e o cliente do QR não consegue enviar
-- pedido desde 18/07. Idem para .insert().select() em itens_pedido.
-- O checkout por link escapa porque exige login (cliente_seus_pedidos).
--
-- Solução (mesmo padrão de fn_acompanhar_pedido e
-- fn_comanda_aberta_mesa): RPC SECURITY DEFINER que executa o fluxo
-- inteiro no servidor e retorna só (pedido_id, numero).
--
-- Endurecimento incluso: os preços são SEMPRE recalculados do banco
-- (produtos.preco + opcoes.preco_adicional) e produto/opção são
-- validados contra a loja — com o insert público antigo, um cliente
-- podia ditar preco_unitario/valor_total arbitrários.
-- ============================================================

create or replace function public.fn_pedido_mesa_criar(
  p_loja_id uuid,
  p_mesa_id uuid,
  p_identificador text default null,
  p_observacao text default null,
  p_itens jsonb default '[]'::jsonb
)
returns table (pedido_id uuid, numero int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesa_numero int;
  v_comanda     uuid;
  v_pedido      uuid;
  v_numero      int;
  v_item        jsonb;
  v_opcao       jsonb;
  v_prod        record;
  v_op          record;
  v_qtd         int;
  v_preco_item  numeric;
  v_subtotal    numeric := 0;
  v_item_id     uuid;
begin
  -- Mesa precisa existir, ser da loja e estar ativa (mesma guarda da comanda)
  select m.numero into v_mesa_numero
    from mesas m
   where m.id = p_mesa_id and m.loja_id = p_loja_id and m.ativo;
  if not found then
    raise exception 'Mesa inválida ou inativa para esta loja';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido sem itens';
  end if;

  -- Reusa a comanda ABERTA da mesa ou abre uma nova (função já validada)
  v_comanda := public.fn_comanda_aberta_mesa(p_loja_id, p_mesa_id);

  insert into pedidos (loja_id, tipo_pedido, origem, comanda_id, mesa_numero,
                       identificador_cliente, subtotal, valor_total, observacao, requer_cozinha)
  values (p_loja_id, 'SALAO', 'mesa', v_comanda, v_mesa_numero,
          coalesce(nullif(trim(coalesce(p_identificador, '')), ''), 'Mesa ' || v_mesa_numero), 0, 0,
          nullif(trim(coalesce(p_observacao, '')), ''), false)
  returning pedidos.id, pedidos.numero into v_pedido, v_numero;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    -- Produto precisa ser da loja e estar disponível
    select pr.id, pr.nome, pr.preco into v_prod
      from produtos pr
     where pr.id = (v_item->>'produto_id')::uuid
       and pr.loja_id = p_loja_id
       and pr.disponivel;
    if not found then
      raise exception 'Produto inválido ou indisponível: %', v_item->>'produto_id';
    end if;

    v_qtd := greatest(1, coalesce((v_item->>'quantidade')::int, 1));
    v_preco_item := v_prod.preco;

    -- Valida cada opção contra o produto e soma o adicional do BANCO
    for v_opcao in select value from jsonb_array_elements(coalesce(v_item->'opcoes', '[]'::jsonb)) loop
      select o.id, o.nome, o.preco_adicional into v_op
        from opcoes o
        join grupos_opcoes g on g.id = o.grupo_id
       where o.id = (v_opcao->>'opcao_id')::uuid
         and g.produto_id = v_prod.id;
      if not found then
        raise exception 'Opção inválida para o produto %', v_prod.nome;
      end if;
      v_preco_item := v_preco_item + v_op.preco_adicional;
    end loop;

    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    values (v_pedido, v_prod.id, v_prod.nome, v_preco_item, v_qtd,
            nullif(trim(coalesce(v_item->>'observacao', '')), ''))
    returning id into v_item_id;

    for v_opcao in select value from jsonb_array_elements(coalesce(v_item->'opcoes', '[]'::jsonb)) loop
      select o.id, o.nome, o.preco_adicional into v_op
        from opcoes o
        join grupos_opcoes g on g.id = o.grupo_id
       where o.id = (v_opcao->>'opcao_id')::uuid
         and g.produto_id = v_prod.id;
      insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
      values (v_item_id, v_op.id, v_op.nome, v_op.preco_adicional);
    end loop;

    v_subtotal := v_subtotal + v_preco_item * v_qtd;
  end loop;

  -- Subtotal/valor_total finais calculados no servidor (mesma transação;
  -- triggers de status/histórico não agem porque status não muda)
  update pedidos set subtotal = v_subtotal, valor_total = v_subtotal where id = v_pedido;

  return query select v_pedido, v_numero;
end;
$$;

grant execute on function public.fn_pedido_mesa_criar(uuid, uuid, text, text, jsonb) to anon, authenticated;
