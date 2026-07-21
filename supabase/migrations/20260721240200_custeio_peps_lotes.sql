-- ═══════════════════════════════════════════════════════════════════════════
-- Custeio PEPS por lotes — o custo deixa de ser "preço da última compra".
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lotes_estoque (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id            UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  insumo_id          UUID NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  quantidade_inicial NUMERIC(14,4) NOT NULL CHECK (quantidade_inicial > 0),
  quantidade_restante NUMERIC(14,4) NOT NULL CHECK (quantidade_restante >= 0),
  custo_unitario     NUMERIC(14,6) NOT NULL CHECK (custo_unitario >= 0),
  origem_mov_id      UUID REFERENCES movimentacoes_estoque(id) ON DELETE SET NULL,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT restante_nao_excede_inicial CHECK (quantidade_restante <= quantidade_inicial)
);

CREATE INDEX IF NOT EXISTS idx_lotes_peps ON lotes_estoque (insumo_id, criado_em)
  WHERE quantidade_restante > 0;

ALTER TABLE lotes_estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lotes_loja ON lotes_estoque;
CREATE POLICY lotes_loja ON lotes_estoque FOR ALL
  USING (loja_id IN (SELECT loja_id FROM usuarios_loja WHERE user_id = auth.uid()))
  WITH CHECK (loja_id IN (SELECT loja_id FROM usuarios_loja WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION fn_consumir_lotes_peps(p_insumo_id UUID, p_qtd NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE
  v_restante NUMERIC := p_qtd;
  v_custo    NUMERIC := 0;
  v_tirar    NUMERIC;
  v_ultimo   NUMERIC := 0;
  r RECORD;
BEGIN
  IF p_qtd IS NULL OR p_qtd <= 0 THEN RETURN 0; END IF;

  FOR r IN
    SELECT id, quantidade_restante, custo_unitario
    FROM lotes_estoque
    WHERE insumo_id = p_insumo_id AND quantidade_restante > 0
    ORDER BY criado_em, id
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0.00005;
    v_tirar  := LEAST(r.quantidade_restante, v_restante);
    v_custo  := v_custo + v_tirar * r.custo_unitario;
    v_ultimo := r.custo_unitario;

    UPDATE lotes_estoque SET quantidade_restante = quantidade_restante - v_tirar
    WHERE id = r.id;

    v_restante := v_restante - v_tirar;
  END LOOP;

  IF v_restante > 0.00005 THEN
    IF v_ultimo = 0 THEN
      SELECT COALESCE(preco_embalagem / NULLIF(qtd_embalagem,0), 0) INTO v_ultimo
      FROM insumos WHERE id = p_insumo_id;
    END IF;
    v_custo := v_custo + v_restante * COALESCE(v_ultimo,0);
    RAISE WARNING 'PEPS: insumo % sem lote para % unidades; custo estimado por % /un.',
      p_insumo_id, v_restante, v_ultimo;
  END IF;

  RETURN ROUND(v_custo, 4);
END; $$;

CREATE OR REPLACE FUNCTION fn_mov_criar_lote() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE
  v_unit NUMERIC;
BEGIN
  IF NEW.tipo <> 'ENTRADA' OR NEW.quantidade <= 0 THEN RETURN NEW; END IF;

  IF NEW.custo_total IS NOT NULL AND NEW.custo_total > 0 THEN
    v_unit := NEW.custo_total / NEW.quantidade;
  ELSE
    SELECT COALESCE(preco_embalagem / NULLIF(qtd_embalagem,0), 0) INTO v_unit
    FROM insumos WHERE id = NEW.insumo_id;
  END IF;

  INSERT INTO lotes_estoque (loja_id, insumo_id, quantidade_inicial,
                             quantidade_restante, custo_unitario, origem_mov_id)
  VALUES (NEW.loja_id, NEW.insumo_id, NEW.quantidade, NEW.quantidade,
          COALESCE(v_unit,0), NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_mov_criar_lote ON movimentacoes_estoque;
CREATE TRIGGER trg_mov_criar_lote
  AFTER INSERT ON movimentacoes_estoque
  FOR EACH ROW EXECUTE FUNCTION fn_mov_criar_lote();

CREATE OR REPLACE FUNCTION fn_mov_custear_baixa() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF NEW.quantidade < 0 AND NEW.custo_total IS NULL THEN
    NEW.custo_total := fn_consumir_lotes_peps(NEW.insumo_id, -NEW.quantidade);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_mov_custear_baixa ON movimentacoes_estoque;
CREATE TRIGGER trg_mov_custear_baixa
  BEFORE INSERT ON movimentacoes_estoque
  FOR EACH ROW EXECUTE FUNCTION fn_mov_custear_baixa();

INSERT INTO lotes_estoque (loja_id, insumo_id, quantidade_inicial,
                           quantidade_restante, custo_unitario, criado_em)
SELECT i.loja_id, i.id, i.quantidade_atual, i.quantidade_atual,
       COALESCE(i.preco_embalagem / NULLIF(i.qtd_embalagem,0), 0),
       now() - interval '1 second'
FROM insumos i
WHERE i.quantidade_atual > 0
  AND NOT EXISTS (SELECT 1 FROM lotes_estoque l WHERE l.insumo_id = i.id);

CREATE OR REPLACE FUNCTION public.fn_lancar_custo_estoque() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE
  v_conta_estoque UUID;
  v_conta_cmv     UUID;
BEGIN
  IF COALESCE(NEW.custo_total, 0) <= 0 THEN RETURN NEW; END IF;

  SELECT id INTO v_conta_estoque FROM public.contas
    WHERE codigo = '1.1.01' AND loja_id = NEW.loja_id LIMIT 1;
  SELECT id INTO v_conta_cmv FROM public.contas
    WHERE codigo = '4.1.01' AND loja_id = NEW.loja_id LIMIT 1;

  IF v_conta_estoque IS NULL OR v_conta_cmv IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.lancamentos_financeiros (
    loja_id, historico, valor, conta_debitada, conta_creditada,
    referencia_tipo, referencia_id
  ) VALUES (
    NEW.loja_id,
    'CMV pedido ' || NEW.pedido_id || ' — ' ||
      (SELECT nome FROM public.insumos WHERE id = NEW.insumo_id),
    NEW.custo_total, v_conta_cmv, v_conta_estoque, 'PEDIDO', NEW.pedido_id
  );

  RETURN NEW;
END; $$;
