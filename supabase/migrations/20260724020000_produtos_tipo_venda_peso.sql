-- Migration: Suporte a vendas por quilo (Self-service / Peso)
-- Arquivo: 20260724020000_produtos_tipo_venda_peso.sql

-- 1. Extensão da Tabela produtos
ALTER TABLE public.produtos 
  ADD COLUMN IF NOT EXISTS tipo_venda TEXT DEFAULT 'UNITARIO' CHECK (tipo_venda IN ('UNITARIO', 'POR_PESO')),
  ADD COLUMN IF NOT EXISTS preco_por_quilo NUMERIC(10,2) DEFAULT 0.00;

-- 2. Índice de suporte
CREATE INDEX IF NOT EXISTS idx_produtos_tipo_venda ON public.produtos (tipo_venda);

-- 3. Permitir quantidades fracionárias em itens_pedido (ex: 0.350 kg)
ALTER TABLE public.itens_pedido 
  ALTER COLUMN quantidade TYPE NUMERIC(12,4);

-- 4. Atualização da função fn_baixar_estoque para contabilizar porções em vendidos
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

  -- Atualiza o contador de vendas por porção (1 para POR_PESO, quantidade real para UNITARIO)
  UPDATE produtos p SET vendidos = vendidos + CASE WHEN p.tipo_venda = 'POR_PESO' THEN 1 ELSE ip.quantidade END
  FROM itens_pedido ip
  WHERE ip.pedido_id = p_pedido_id AND ip.produto_id = p.id;

END; $$;
