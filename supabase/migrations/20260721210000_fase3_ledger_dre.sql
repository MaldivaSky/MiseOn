-- ============================================================================
-- FASE 3 — LEDGER: TRIGGERS DE RECEITA/ESTORNO + VIEWS DE DRE E EXTRATO
-- ============================================================================
-- Estratégia de Engenharia:
--   • Estendemos a trigger EXISTENTE fn_trg_status_pedido (ponto único de verdade)
--     em vez de criar nova trigger em pedidos → sem risco de race condition dupla.
--   • Todos os lançamentos são IDEMPOTENTES: a coluna receita_lancada no pedido
--     garante que um re-processamento acidental nunca gere duplicatas.
--   • As views de DRE são materializadas em memória pelo banco, sem custo de
--     manutenção manual.
-- ============================================================================

-- ── 0. Coluna de idempotência e coluna de estorno ────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS receita_lancada BOOLEAN NOT NULL DEFAULT false;

-- ── 1. Função auxiliar: lança o lançamento de RECEITA para um pedido ─────────
-- Chamada internamente pela trigger quando status = FINALIZADO.
-- Separa iFood (receita líquida + taxa destacada) de pagamentos próprios.
CREATE OR REPLACE FUNCTION public.fn_lancar_receita_pedido(p_pedido_id UUID)
RETURNS void AS $$
DECLARE
  v_loja         UUID;
  v_valor_total  NUMERIC;
  v_taxa_ifood   NUMERIC;
  v_origem       TEXT;
  v_conta_caixa  UUID;   -- débito  (onde entra o dinheiro)
  v_conta_banco  UUID;   -- débito  (Efí/banco)
  v_conta_rec_vd UUID;   -- crédito (Receita Vendas)
  v_conta_rec_if UUID;   -- crédito (Receita iFood)
  v_conta_taxa   UUID;   -- débito  (Taxa iFood Retida — custo)
BEGIN
  -- Guarda de idempotência: sai se o lançamento já foi feito
  SELECT loja_id, valor_total, taxa_ifood_retida, origem
    INTO v_loja, v_valor_total, v_taxa_ifood, v_origem
  FROM public.pedidos
  WHERE id = p_pedido_id AND NOT receita_lancada;

  IF v_loja IS NULL THEN RETURN; END IF;

  -- Resolve as contas do plano contábil da loja
  SELECT id INTO v_conta_caixa  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.01' LIMIT 1;
  SELECT id INTO v_conta_banco  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.02' LIMIT 1;
  SELECT id INTO v_conta_rec_vd FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.01' LIMIT 1;
  SELECT id INTO v_conta_rec_if FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.02' LIMIT 1;
  SELECT id INTO v_conta_taxa   FROM public.contas WHERE loja_id = v_loja AND codigo = '4.1.02' LIMIT 1;

  IF v_conta_caixa IS NULL OR v_conta_rec_vd IS NULL THEN
    RAISE WARNING '[ledger] Plano de contas incompleto para loja %. Lançamento omitido.', v_loja;
    RETURN;
  END IF;

  IF v_origem = 'ifood' THEN
    -- Receita iFood: débito Banco Efí (ou Caixa como fallback), crédito Receita iFood
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

    -- Taxa iFood: débito Taxa iFood Retida, crédito Banco Efí (estorna o custo)
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
    -- Receita própria (Pix, Dinheiro, Cartão): débito Caixa, crédito Receita Vendas
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

  -- Marca idempotência
  UPDATE public.pedidos SET receita_lancada = true WHERE id = p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Função auxiliar: lança ESTORNO (reversa contábil) ────────────────────
-- Chamada quando status = CANCELADO e receita_lancada = true.
CREATE OR REPLACE FUNCTION public.fn_lancar_estorno_pedido(p_pedido_id UUID)
RETURNS void AS $$
DECLARE
  v_loja        UUID;
  v_valor_total NUMERIC;
  v_taxa_ifood  NUMERIC;
  v_origem      TEXT;
  v_conta_caixa UUID;
  v_conta_banco UUID;
  v_conta_rec_vd UUID;
  v_conta_rec_if UUID;
  v_conta_taxa   UUID;
BEGIN
  SELECT loja_id, valor_total, taxa_ifood_retida, origem
    INTO v_loja, v_valor_total, v_taxa_ifood, v_origem
  FROM public.pedidos
  WHERE id = p_pedido_id AND receita_lancada;

  IF v_loja IS NULL THEN RETURN; END IF;

  SELECT id INTO v_conta_caixa  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.01' LIMIT 1;
  SELECT id INTO v_conta_banco  FROM public.contas WHERE loja_id = v_loja AND codigo = '1.1.02' LIMIT 1;
  SELECT id INTO v_conta_rec_vd FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.01' LIMIT 1;
  SELECT id INTO v_conta_rec_if FROM public.contas WHERE loja_id = v_loja AND codigo = '3.1.02' LIMIT 1;
  SELECT id INTO v_conta_taxa   FROM public.contas WHERE loja_id = v_loja AND codigo = '4.1.02' LIMIT 1;

  IF v_origem = 'ifood' THEN
    -- Estorno iFood: débito Receita iFood, crédito Banco Efí (inversão)
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
    -- Estorno próprio: débito Receita Vendas, crédito Caixa
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

  UPDATE public.pedidos SET receita_lancada = false WHERE id = p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Estende fn_trg_status_pedido (ponto único de verdade) ─────────────────
-- Reescrevemos em vez de criar trigger separada — mesma função, sem duplicação.
CREATE OR REPLACE FUNCTION public.fn_trg_status_pedido() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();

  -- ACEITO: baixa o estoque
  IF NEW.status = 'ACEITO' AND OLD.status = 'NOVO' THEN
    PERFORM fn_baixar_estoque(NEW.id);
    NEW.estoque_baixado = true;
  END IF;

  -- CANCELADO: estorna estoque e lança estorno financeiro se já havia receita
  IF NEW.status = 'CANCELADO' AND OLD.estoque_baixado THEN
    INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, motivo, pedido_id)
    SELECT m.loja_id, m.insumo_id, 'AJUSTE', -m.quantidade, 'Estorno por cancelamento', m.pedido_id
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA';

    UPDATE insumos i SET quantidade_atual = i.quantidade_atual - m.quantidade
    FROM movimentacoes_estoque m
    WHERE m.pedido_id = NEW.id AND m.tipo = 'BAIXA_VENDA' AND i.id = m.insumo_id;
  END IF;

  IF NEW.status = 'CANCELADO' AND OLD.receita_lancada THEN
    PERFORM fn_lancar_estorno_pedido(NEW.id);
  END IF;

  -- FINALIZADO: credita cashback e lança receita no ledger
  IF NEW.status = 'FINALIZADO' AND OLD.status IS DISTINCT FROM 'FINALIZADO' THEN
    PERFORM fn_creditar_cashback(NEW.id);
    PERFORM fn_lancar_receita_pedido(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. View de DRE Mensal ────────────────────────────────────────────────────
-- Demonstração de Resultado do Exercício agrupada por loja e mês.
-- Estrutura: Receita Bruta – CMV – Taxa iFood = Lucro Operacional Bruto
CREATE OR REPLACE VIEW public.vw_dre_mensal AS
SELECT
  lf.loja_id,
  DATE_TRUNC('month', lf.data_lancamento)::DATE   AS mes,
  TO_CHAR(lf.data_lancamento, 'YYYY-MM')           AS mes_referencia,

  -- Receita Bruta (soma de todos os créditos em contas de RECEITA)
  COALESCE(SUM(lf.valor) FILTER (
    WHERE c_cr.tipo = 'RECEITA'
  ), 0)                                             AS receita_bruta,

  -- Custo Mercadoria Vendida — CMV (débitos em conta 4.1.01)
  COALESCE(SUM(lf.valor) FILTER (
    WHERE c_db.codigo = '4.1.01'
  ), 0)                                             AS cmv,

  -- Taxa iFood Retida (débitos em conta 4.1.02)
  COALESCE(SUM(lf.valor) FILTER (
    WHERE c_db.codigo = '4.1.02'
  ), 0)                                             AS taxa_ifood,

  -- Estornos (lançamentos de tipo ESTORNO — débito em receita)
  COALESCE(SUM(lf.valor) FILTER (
    WHERE lf.referencia_tipo = 'ESTORNO'
  ), 0)                                             AS estornos,

  -- Lucro Operacional Bruto (receita − CMV − taxa − estornos)
  COALESCE(SUM(lf.valor) FILTER (WHERE c_cr.tipo = 'RECEITA'), 0)
    - COALESCE(SUM(lf.valor) FILTER (WHERE c_db.codigo = '4.1.01'), 0)
    - COALESCE(SUM(lf.valor) FILTER (WHERE c_db.codigo = '4.1.02'), 0)
    - COALESCE(SUM(lf.valor) FILTER (WHERE lf.referencia_tipo = 'ESTORNO'), 0)
                                                    AS lucro_operacional_bruto,

  COUNT(*) FILTER (WHERE lf.referencia_tipo = 'PEDIDO') AS total_lancamentos_receita,
  COUNT(*) FILTER (WHERE lf.referencia_tipo = 'ESTORNO') AS total_estornos

FROM public.lancamentos_financeiros lf
JOIN public.contas c_db ON c_db.id = lf.conta_debitada
JOIN public.contas c_cr ON c_cr.id = lf.conta_creditada
GROUP BY lf.loja_id, DATE_TRUNC('month', lf.data_lancamento), TO_CHAR(lf.data_lancamento, 'YYYY-MM')
ORDER BY lf.loja_id, mes DESC;

-- ── 5. View de Extrato de Caixa (estilo bancário) ───────────────────────────
-- Cada linha = 1 lançamento com saldo acumulado por loja.
-- Usada na aba "Extrato" do painel Financeiro para substituir a leitura direta de pedidos.
CREATE OR REPLACE VIEW public.vw_caixa_extrato AS
SELECT
  lf.id,
  lf.loja_id,
  lf.data_lancamento,
  lf.criado_em,
  lf.historico,
  lf.referencia_tipo,
  lf.referencia_id,
  lf.valor,
  c_db.nome    AS conta_debito,
  c_db.codigo  AS codigo_debito,
  c_cr.nome    AS conta_credito,
  c_cr.codigo  AS codigo_credito,
  -- Natureza do movimento na perspectiva do caixa:
  --   ENTRADA = crédito numa conta ATIVO (dinheiro entrando no cofre)
  --   SAIDA   = débito numa conta ATIVO (dinheiro saindo)
  CASE
    WHEN c_cr.tipo = 'ATIVO' THEN 'ENTRADA'
    WHEN c_db.tipo = 'ATIVO' THEN 'SAIDA'
    ELSE 'AJUSTE'
  END          AS natureza,
  SUM(CASE WHEN c_cr.tipo = 'ATIVO' THEN lf.valor ELSE -lf.valor END)
    OVER (PARTITION BY lf.loja_id ORDER BY lf.criado_em, lf.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
               AS saldo_acumulado
FROM public.lancamentos_financeiros lf
JOIN public.contas c_db ON c_db.id = lf.conta_debitada
JOIN public.contas c_cr ON c_cr.id = lf.conta_creditada
ORDER BY lf.loja_id, lf.criado_em DESC;

-- ── 6. RLS nas novas views e tabelas ─────────────────────────────────────────
-- Lançamentos: somente admins da loja (reutiliza fn_meu_acesso já existente)
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS adm_lancamentos ON public.lancamentos_financeiros;
CREATE POLICY adm_lancamentos ON public.lancamentos_financeiros
  FOR ALL USING (fn_meu_acesso(loja_id));

ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS adm_contas ON public.contas;
CREATE POLICY adm_contas ON public.contas
  FOR ALL USING (fn_meu_acesso(loja_id));
