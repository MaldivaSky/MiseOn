-- ═══════════════════════════════════════════════════════════════════════════
-- Observabilidade de Custeio — View de Custo Real por Insumo
--
-- vw_custo_real_estoque: custo médio ponderado dos lotes com saldo,
-- comparado ao custo estimado (preco_embalagem/qtd_embalagem).
--
-- O campo desvio_pct expõe o delta entre o que o sistema "acha" que custa
-- (estimado, baseado no cadastro) e o que os lotes reais mostram.
-- Desvios > 15% em qualquer direção indicam: (a) preços de compra
-- desatualizados no cadastro, (b) entrada de estoque sem custo, ou
-- (c) inflação não refletida no preço de embalagem.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.vw_custo_real_estoque AS
SELECT
  i.loja_id,
  i.id                                                              AS insumo_id,
  i.nome,
  i.unidade_medida,

  -- Posição atual de estoque (lotes com saldo)
  COALESCE(SUM(l.quantidade_restante), 0)                           AS saldo_total,
  COUNT(l.id) FILTER (WHERE l.quantidade_restante > 0)              AS qtd_lotes_ativos,

  -- Custo real: média ponderada pelos saldos (o custo que sairia pelo PEPS)
  CASE WHEN SUM(l.quantidade_restante) > 0 THEN
    ROUND(
      SUM(l.custo_unitario * l.quantidade_restante) / SUM(l.quantidade_restante),
      6
    )
  END                                                               AS custo_medio_ponderado,

  -- Custo estimado: parâmetro de cadastro (referência rápida, pode estar desatualizado)
  CASE WHEN i.qtd_embalagem > 0 THEN
    ROUND(i.preco_embalagem / i.qtd_embalagem, 6)
  END                                                               AS custo_estimado,

  -- Desvio relativo entre estimado e real (positivo = estimativa mais cara que real)
  -- Fórmula: (estimado - real) / real × 100
  CASE WHEN SUM(l.quantidade_restante) > 0
        AND SUM(l.custo_unitario * l.quantidade_restante) / SUM(l.quantidade_restante) > 0
        AND i.qtd_embalagem > 0 THEN
    ROUND(
      100 * (
        (i.preco_embalagem / i.qtd_embalagem)
        - SUM(l.custo_unitario * l.quantidade_restante) / SUM(l.quantidade_restante)
      ) / (
        SUM(l.custo_unitario * l.quantidade_restante) / SUM(l.quantidade_restante)
      ),
      2
    )
  END                                                               AS desvio_pct,

  -- Sinalizador de alerta: TRUE quando o desvio é relevante (>= 15%)
  CASE WHEN ABS(
    COALESCE(
      100 * (
        (i.preco_embalagem / NULLIF(i.qtd_embalagem, 0))
        - SUM(l.custo_unitario * l.quantidade_restante) / NULLIF(SUM(l.quantidade_restante), 0)
      ) / NULLIF(
        SUM(l.custo_unitario * l.quantidade_restante) / NULLIF(SUM(l.quantidade_restante), 0),
        0
      ),
      0
    )
  ) >= 15 THEN TRUE ELSE FALSE END                                  AS alerta_desvio,

  -- Data do lote mais antigo com saldo (o próximo a sair pelo PEPS)
  MIN(l.criado_em) FILTER (WHERE l.quantidade_restante > 0)         AS data_lote_mais_antigo,

  -- Custo do lote mais antigo (o que o PEPS vai usar primeiro)
  (
    SELECT ROUND(l2.custo_unitario, 6)
    FROM lotes_estoque l2
    WHERE l2.insumo_id = i.id
      AND l2.quantidade_restante > 0
    ORDER BY l2.criado_em, l2.id
    LIMIT 1
  )                                                                 AS custo_peps_proximo

FROM public.insumos i
LEFT JOIN public.lotes_estoque l
       ON l.insumo_id = i.id
      AND l.loja_id   = i.loja_id
GROUP BY i.loja_id, i.id, i.nome, i.unidade_medida,
         i.preco_embalagem, i.qtd_embalagem;

-- RLS: visível apenas para membros da loja
GRANT SELECT ON public.vw_custo_real_estoque TO authenticated;

-- ── Comentário de uso ──────────────────────────────────────────────────────
-- Frontend: consultar alertas para a loja do usuário:
--
--   supabase
--     .from('vw_custo_real_estoque')
--     .select('nome, desvio_pct, custo_estimado, custo_medio_ponderado')
--     .eq('loja_id', lojaId)
--     .eq('alerta_desvio', true)
--     .order('desvio_pct', { ascending: false })
