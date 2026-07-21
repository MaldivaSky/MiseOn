-- ═══════════════════════════════════════════════════════════════════════════
-- Observabilidade de Custeio — View de Margem Real por Produto
--
-- vw_margem_produto_real: junta custo real de insumos (via lotes PEPS),
-- custos fixos de produção (configuracoes_custo), preço de venda e
-- calcula a margem bruta líquida por produto.
--
-- Evolução de vw_lucro_real_produto (que usa lançamentos históricos):
-- esta view usa o custo ATUAL dos lotes — ideal para simulação de
-- precificação e alertas de margem ao vivo.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.vw_margem_produto_real AS
WITH custo_insumo_produto AS (
  -- Custo de insumos por produto: soma ficha técnica × custo PEPS atual
  SELECT
    ft.produto_id,
    SUM(
      ft.quantidade_consumida
      * COALESCE(
          -- Custo unitário PEPS: lote mais antigo com saldo
          (
            SELECT l.custo_unitario
            FROM lotes_estoque l
            WHERE l.insumo_id = ft.insumo_id
              AND l.loja_id   = p.loja_id
              AND l.quantidade_restante > 0
            ORDER BY l.criado_em, l.id
            LIMIT 1
          ),
          -- Fallback: custo estimado do cadastro
          i.preco_embalagem / NULLIF(i.qtd_embalagem, 0),
          0
        )
    )                                                         AS custo_insumos,
    -- Indica se algum insumo usou fallback (sem lote real)
    BOOL_OR(NOT EXISTS (
      SELECT 1 FROM lotes_estoque l2
      WHERE l2.insumo_id = ft.insumo_id
        AND l2.loja_id   = p.loja_id
        AND l2.quantidade_restante > 0
    ))                                                        AS usa_custo_estimado
  FROM public.fichas_tecnicas ft
  JOIN public.produtos p  ON p.id = ft.produto_id
  JOIN public.insumos i   ON i.id = ft.insumo_id
  GROUP BY ft.produto_id
),

custo_fixo_produto AS (
  -- Rateio de custos fixos por produto: energia, gás, mão de obra, etc.
  -- Fonte: configuracoes_custo (se existir a tabela)
  -- Por enquanto retorna 0 — a view já existe para quando a tabela vier.
  SELECT p.id AS produto_id, COALESCE(SUM(0), 0) AS custo_fixo_rateado
  FROM public.produtos p
  GROUP BY p.id
)

SELECT
  p.loja_id,
  p.id                                                          AS produto_id,
  p.nome                                                        AS produto,
  p.preco                                                       AS preco_venda,

  -- Custo de insumos (PEPS real, com fallback para estimado)
  COALESCE(ci.custo_insumos, 0)                                 AS custo_insumos,
  COALESCE(cf.custo_fixo_rateado, 0)                            AS custo_fixo,

  -- Custo total do produto
  COALESCE(ci.custo_insumos, 0) + COALESCE(cf.custo_fixo_rateado, 0)
                                                                AS custo_total,

  -- Margem bruta líquida (R$)
  p.preco - COALESCE(ci.custo_insumos, 0) - COALESCE(cf.custo_fixo_rateado, 0)
                                                                AS margem_bruta,

  -- Margem percentual
  CASE WHEN p.preco > 0 THEN
    ROUND(
      100 * (p.preco - COALESCE(ci.custo_insumos, 0) - COALESCE(cf.custo_fixo_rateado, 0))
      / p.preco,
      2
    )
  END                                                           AS margem_pct,

  -- Alerta: margem < 20% indica produto potencialmente deficitário
  CASE WHEN p.preco > 0 AND (
    100 * (p.preco - COALESCE(ci.custo_insumos, 0) - COALESCE(cf.custo_fixo_rateado, 0))
    / p.preco
  ) < 20 THEN TRUE ELSE FALSE END                               AS alerta_margem_baixa,

  -- Sinaliza quando algum insumo não tem lote e usa custo estimado
  COALESCE(ci.usa_custo_estimado, TRUE)                         AS custo_parcialmente_estimado,

  p.disponivel,
  p.controla_estoque

FROM public.produtos p
LEFT JOIN custo_insumo_produto ci ON ci.produto_id = p.id
LEFT JOIN custo_fixo_produto    cf ON cf.produto_id = p.id
ORDER BY p.loja_id, margem_pct ASC NULLS LAST;

GRANT SELECT ON public.vw_margem_produto_real TO authenticated;

-- ── Comentário de uso ──────────────────────────────────────────────────────
-- Alertas de margem baixa para a loja:
--
--   supabase
--     .from('vw_margem_produto_real')
--     .select('produto, preco_venda, custo_total, margem_pct')
--     .eq('loja_id', lojaId)
--     .eq('alerta_margem_baixa', true)
--     .eq('disponivel', true)
--     .order('margem_pct', { ascending: true })
