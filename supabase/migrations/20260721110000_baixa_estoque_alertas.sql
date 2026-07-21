-- ============================================================================
-- Ficha Técnica — hardening da baixa de estoque
-- 1) fn_baixar_estoque: RAISE WARNING quando um insumo fica negativo.
--    NÃO bloqueia a venda (varejo não pode parar); o alerta aparece nos logs
--    e o saldo negativo fica visível na tela de estoque/movimentações.
-- 2) vw_produtos_sem_ficha: produtos com controla_estoque=true e disponíveis
--    que não possuem ficha técnica — nunca baixarão estoque (ruptura silenciosa).
-- Base: definição atual de produção (dump 2026-07-21).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_baixar_estoque(p_pedido_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
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
      RAISE WARNING 'Estoque negativo: insumo "%" ficou com saldo % após baixa do pedido %',
        v_nome_insumo, v_saldo, p_pedido_id;
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
      RAISE WARNING 'Estoque negativo: insumo "%" ficou com saldo % após baixa (extras) do pedido %',
        v_nome_insumo, v_saldo, p_pedido_id;
    END IF;
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática (extras)', p_pedido_id);
  END LOOP;
END; $$;

-- Produtos que controlam estoque mas não têm ficha técnica -------------------

CREATE OR REPLACE VIEW public.vw_produtos_sem_ficha AS
SELECT p.id, p.loja_id, p.nome, p.preco, p.categoria_id
FROM produtos p
WHERE p.controla_estoque
  AND p.disponivel
  AND NOT EXISTS (SELECT 1 FROM fichas_tecnicas ft WHERE ft.produto_id = p.id);

GRANT SELECT ON public.vw_produtos_sem_ficha TO authenticated;
