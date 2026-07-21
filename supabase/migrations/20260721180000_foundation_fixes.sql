-- ============================================================================
-- Correções Críticas de Fundamento
-- 1) Número de Pedido sem Race Condition (Atomic Updates via Loja Sequencias)
-- 2) Prevenção de Estoque Negativo (RAISE EXCEPTION em vez de WARNING)
-- ============================================================================

-- 1) NÚMERO DO PEDIDO: Geração Atômica

CREATE TABLE IF NOT EXISTS public.loja_sequencias (
  loja_id UUID PRIMARY KEY REFERENCES public.lojas(id) ON DELETE CASCADE,
  ultimo_numero INT NOT NULL DEFAULT 0
);

-- Função atômica para incrementar o número do pedido por loja
CREATE OR REPLACE FUNCTION public.fn_proximo_numero(p_loja_id UUID) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_num INT;
BEGIN
  INSERT INTO public.loja_sequencias (loja_id, ultimo_numero)
  VALUES (p_loja_id, 1)
  ON CONFLICT (loja_id) DO UPDATE SET ultimo_numero = loja_sequencias.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_num;
  
  RETURN v_num;
END;
$$;

-- Trigger para popular o número no INSERT se não for providenciado
CREATE OR REPLACE FUNCTION public.fn_trg_numero_pedido() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := public.fn_proximo_numero(NEW.loja_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_numero_pedido ON public.pedidos;
CREATE TRIGGER trg_numero_pedido
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_numero_pedido();

-- Caso existam registros de pedidos sem inicializar a sequência da loja, vamos sincronizar:
INSERT INTO public.loja_sequencias (loja_id, ultimo_numero)
SELECT loja_id, MAX(numero) FROM public.pedidos GROUP BY loja_id
ON CONFLICT (loja_id) DO UPDATE SET ultimo_numero = EXCLUDED.ultimo_numero;

-- ============================================================================
-- 2) ESTOQUE NEGATIVO: Prevenção com Rollback
-- Modifica fn_baixar_estoque para lançar EXCEPTION e abortar a transação

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
      -- MUDANÇA CRÍTICA: Agora aborta a transação, impedindo a venda!
      RAISE EXCEPTION 'Estoque insuficiente: O insumo "%" ficaria negativo (faltam %).', v_nome_insumo, abs(v_saldo);
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
      RAISE EXCEPTION 'Estoque insuficiente: O insumo "%" ficaria negativo (faltam %) devido aos adicionais.', v_nome_insumo, abs(v_saldo);
    END IF;
    
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    VALUES (v_loja, r.insumo_id, 'BAIXA_VENDA', -r.qtd, 'Baixa automática (extras)', p_pedido_id);
  END LOOP;

  -- Marca o estoque como baixado para evitar dupla-baixa (segurança adicional)
  UPDATE pedidos SET estoque_baixado = true WHERE id = p_pedido_id;
END; $$;
