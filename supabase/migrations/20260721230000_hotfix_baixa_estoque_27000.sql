-- ============================================================================
-- HOTFIX: Confirmação de pedido quebrada (erro 400 em fn_avancar_status_pedido)
--
-- Causa raiz: fn_baixar_estoque (reescrita em 20260721180000_foundation_fixes)
-- terminava com `UPDATE pedidos SET estoque_baixado = true`. Como ela é chamada
-- por fn_trg_status_pedido — uma trigger BEFORE UPDATE na PRÓPRIA tabela pedidos —
-- a linha do pedido era modificada duas vezes no mesmo comando:
--
--   ERROR 27000: tuple to be updated was already modified by an operation
--   triggered by the current command
--
-- Resultado: TODA confirmação de pedido (NOVO → ACEITO) falhava com 400.
--
-- Correção: a marcação de estoque_baixado já acontece no NEW da trigger
-- (fn_trg_status_pedido: `NEW.estoque_baixado = true`), então o UPDATE aninhado
-- é removido. Mantida a decisão de negócio de foundation_fixes: estoque
-- insuficiente ABORTA a confirmação com mensagem amigável (nome do insumo).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_baixar_estoque(p_pedido_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_loja UUID;
  v_saldo NUMERIC(12,4);
  v_nome_insumo TEXT;
  r RECORD;
BEGIN
  SELECT loja_id INTO v_loja FROM pedidos WHERE id = p_pedido_id AND NOT estoque_baixado;
  IF v_loja IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT ft.insumo_id, SUM(ft.quantidade_consumida * ip.quantidade) AS qtd
    FROM itens_pedido ip
    JOIN produtos p   ON p.id = ip.produto_id AND p.controla_estoque
    JOIN fichas_tecnicas ft ON ft.produto_id = p.id
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY ft.insumo_id
  LOOP
    UPDATE insumos SET quantidade_atual = quantidade_atual - r.qtd WHERE id = r.insumo_id
    RETURNING quantidade_atual, nome INTO v_saldo, v_nome_insumo;

    IF v_saldo < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente: o insumo "%" ficaria negativo (faltam %). Ajuste o estoque antes de confirmar o pedido.', v_nome_insumo, abs(v_saldo);
    END IF;

    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática por pedido', p_pedido_id);
  END LOOP;

  FOR r IN
    SELECT o.insumo_id, SUM(COALESCE(o.quantidade_insumo,1) * ip.quantidade) AS qtd
    FROM itens_pedido ip
    JOIN itens_pedido_opcoes ipo ON ipo.item_id = ip.id
    JOIN opcoes o ON o.id = ipo.opcao_id AND o.insumo_id IS NOT NULL
    WHERE ip.pedido_id = p_pedido_id
    GROUP BY o.insumo_id
  LOOP
    UPDATE insumos SET quantidade_atual = quantidade_atual - r.qtd WHERE id = r.insumo_id
    RETURNING quantidade_atual, nome INTO v_saldo, v_nome_insumo;

    IF v_saldo < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente: o insumo "%" ficaria negativo (faltam %) por causa dos adicionais. Ajuste o estoque antes de confirmar o pedido.', v_nome_insumo, abs(v_saldo);
    END IF;

    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática (extras)', p_pedido_id);
  END LOOP;

  -- NÃO atualizar pedidos aqui: quem marca estoque_baixado é a trigger
  -- fn_trg_status_pedido via NEW.estoque_baixado = true. Um UPDATE aninhado
  -- na mesma linha dispara o erro 27000 e derruba a confirmação do pedido.
END; $$;
