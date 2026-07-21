-- ============================================================================
-- HOTFIX 2: Finalização/estorno de pedido quebrados (mesmo erro 27000)
--
-- Continuação de 20260721230000_hotfix_baixa_estoque_27000.sql.
-- fn_lancar_receita_pedido e fn_lancar_estorno_pedido faziam UPDATE na linha
-- do pedido (receita_lancada) sendo chamadas pela trigger BEFORE UPDATE
-- fn_trg_status_pedido → ERROR 27000 em PRONTO→FINALIZADO ("Entregar ao
-- cliente") e em cancelamentos com receita já lançada.
--
-- Correção: as funções passam a RETORNAR boolean (lançou ou não) e quem marca
-- receita_lancada é a trigger, via NEW — nenhuma escrita aninhada em pedidos.
-- fn_creditar_cashback foi auditada e não toca em pedidos (sem alteração).
-- ============================================================================

-- ── 1. Receita: retorna true quando o lançamento foi feito ──────────────────
DROP FUNCTION IF EXISTS public.fn_lancar_receita_pedido(uuid);

CREATE FUNCTION public.fn_lancar_receita_pedido(p_pedido_id UUID)
RETURNS boolean AS $$
DECLARE
  v_loja         UUID;
  v_valor_total  NUMERIC;
  v_taxa_ifood   NUMERIC;
  v_origem       TEXT;
  v_conta_caixa  UUID;
  v_conta_banco  UUID;
  v_conta_rec_vd UUID;
  v_conta_rec_if UUID;
  v_conta_taxa   UUID;
BEGIN
  SELECT loja_id, valor_total, taxa_ifood_retida, origem
    INTO v_loja, v_valor_total, v_taxa_ifood, v_origem
  FROM public.pedidos
  WHERE id = p_pedido_id AND NOT receita_lancada;

  IF v_loja IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_conta_caixa  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.01' LIMIT 1;
  SELECT id INTO v_conta_banco  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.02' LIMIT 1;
  SELECT id INTO v_conta_rec_vd FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.01' LIMIT 1;
  SELECT id INTO v_conta_rec_if FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.02' LIMIT 1;
  SELECT id INTO v_conta_taxa   FROM public.contas WHERE loja_id = v_loja AND codigo = '4.1.02' LIMIT 1;

  IF v_conta_caixa IS NULL OR v_conta_rec_vd IS NULL THEN
    RAISE WARNING '[ledger] Plano de contas incompleto para loja %. Lançamento omitido.', v_loja;
    RETURN false;
  END IF;

  IF v_origem = 'ifood' THEN
    INSERT INTO public.lancamentos_financeiros
      (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
    VALUES
      (v_loja,
       'Receita iFood pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
       v_valor_total,
       COALESCE(v_conta_banco, v_conta_caixa),
       v_conta_rec_if,
       'PEDIDO',
       p_pedido_id);

    IF COALESCE(v_taxa_ifood, 0) > 0 AND v_conta_taxa IS NOT NULL THEN
      INSERT INTO public.lancamentos_financeiros
        (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
      VALUES
        (v_loja,
         'Taxa iFood retida pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
         v_taxa_ifood,
         v_conta_taxa,
         COALESCE(v_conta_banco, v_conta_caixa),
         'TAXA_IFOOD',
         p_pedido_id);
    END IF;
  ELSE
    INSERT INTO public.lancamentos_financeiros
      (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
    VALUES
      (v_loja,
       'Receita venda pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
       v_valor_total,
       v_conta_caixa,
       v_conta_rec_vd,
       'PEDIDO',
       p_pedido_id);
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ── 2. Estorno: retorna true quando o estorno foi feito ─────────────────────
DROP FUNCTION IF EXISTS public.fn_lancar_estorno_pedido(uuid);

CREATE FUNCTION public.fn_lancar_estorno_pedido(p_pedido_id UUID)
RETURNS boolean AS $$
DECLARE
  v_loja        UUID;
  v_valor_total NUMERIC;
  v_origem      TEXT;
  v_conta_caixa UUID;
  v_conta_banco UUID;
  v_conta_rec_vd UUID;
  v_conta_rec_if UUID;
BEGIN
  SELECT loja_id, valor_total, origem
    INTO v_loja, v_valor_total, v_origem
  FROM public.pedidos
  WHERE id = p_pedido_id AND receita_lancada;

  IF v_loja IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_conta_caixa  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.01' LIMIT 1;
  SELECT id INTO v_conta_banco  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.02' LIMIT 1;
  SELECT id INTO v_conta_rec_vd FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.01' LIMIT 1;
  SELECT id INTO v_conta_rec_if FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.02' LIMIT 1;

  IF v_origem = 'ifood' THEN
    INSERT INTO public.lancamentos_financeiros
      (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
    VALUES
      (v_loja,
       'ESTORNO iFood pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
       v_valor_total,
       v_conta_rec_if,
       COALESCE(v_conta_banco, v_conta_caixa),
       'ESTORNO',
       p_pedido_id);
  ELSE
    INSERT INTO public.lancamentos_financeiros
      (loja_id, historico, valor, conta_debitada, conta_creditada, referencia_tipo, referencia_id)
    VALUES
      (v_loja,
       'ESTORNO venda pedido #' || (SELECT numero FROM public.pedidos WHERE id = p_pedido_id),
       v_valor_total,
       v_conta_rec_vd,
       v_conta_caixa,
       'ESTORNO',
       p_pedido_id);
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ── 3. Trigger: receita_lancada passa a ser marcada via NEW ─────────────────
CREATE OR REPLACE FUNCTION public.fn_trg_status_pedido() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();

  -- ACEITO: baixa o estoque
  IF NEW.status = 'ACEITO' AND OLD.status = 'NOVO' THEN
    PERFORM fn_baixar_estoque(NEW.id);
    NEW.estoque_baixado = true;
  END IF;

  -- CANCELADO: estorna estoque
  IF NEW.status = 'CANCELADO' AND OLD.estoque_baixado THEN
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    SELECT m.loja_id, m.insumo_id, 'AJUSTE', -m.quantidade, 'Estorno por cancelamento', m.pedido_id
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA';

    UPDATE insumos i SET quantidade_atual = i.quantidade_atual - m.quantidade
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA' AND i.id = m.insumo_id;
  END IF;

  -- CANCELADO: estorno financeiro (marca receita_lancada=false no NEW, nunca
  -- com UPDATE aninhado — isso derruba a transação com erro 27000)
  IF NEW.status = 'CANCELADO' AND OLD.receita_lancada THEN
    NEW.receita_lancada := NOT fn_lancar_estorno_pedido(NEW.id);
  END IF;

  -- FINALIZADO: credita cashback e lança receita no ledger
  IF NEW.status = 'FINALIZADO' AND OLD.status IS DISTINCT FROM 'FINALIZADO' THEN
    PERFORM fn_creditar_cashback(NEW.id);
    NEW.receita_lancada := fn_lancar_receita_pedido(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
