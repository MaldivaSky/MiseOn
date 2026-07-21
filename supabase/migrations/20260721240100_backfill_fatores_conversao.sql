-- ═══════════════════════════════════════════════════════════════════════════
-- Backfill: insumos.detalhes_rendimento (JSON) → fatores_conversao (relacional)
--
-- As cadeias de rendimento já existiam, mas como blob JSON: invisíveis para o
-- banco, invalidáveis por constraint e impossíveis de percorrer em SQL. Aqui
-- elas viram arestas de primeira classe do grafo de conversão.
--
-- O JSON continua no lugar por ora (fonte de verdade da UI atual). Esta
-- migração é ADITIVA e idempotente: rodar de novo não duplica nada.
--
-- Auditoria prévia na base de produção (2026-07-21):
--   • 11 arestas a migrar, 11 chaves (item, origem, destino) únicas → sem colisão
--   • 0 multiplicadores nulos/negativos, 0 conversões identidade
--   • multiplicadores entre 1 e 50; nenhuma viola conservação de massa/volume
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fatores_conversao (loja_id, item_id, unidade_origem, unidade_destino, multiplicador)
SELECT DISTINCT ON (i.id, r->>'de_unidade', r->>'para_unidade')
       i.loja_id,
       i.id,
       r->>'de_unidade',
       r->>'para_unidade',
       -- O JSON guarda "de_qtd → para_qtd" (ex.: 1 → 50). A aresta do grafo é
       -- normalizada para "1 origem = N destino", daí a divisão.
       (r->>'para_qtd')::numeric / NULLIF((r->>'de_qtd')::numeric, 0)
FROM insumos i,
     jsonb_array_elements(i.detalhes_rendimento->'regras') r
WHERE i.detalhes_rendimento IS NOT NULL
  AND (r->>'de_qtd')::numeric   > 0
  AND (r->>'para_qtd')::numeric > 0
  AND  r->>'de_unidade' <> r->>'para_unidade'   -- identidade não é aresta
  -- Cinto de segurança: mesmo com a auditoria limpa, uma linha que viole a
  -- conservação é PULADA em vez de abortar a migração inteira.
  AND conversao_valida(
        r->>'de_unidade', r->>'para_unidade',
        (r->>'de_qtd')::numeric, (r->>'para_qtd')::numeric)
ON CONFLICT DO NOTHING;

-- ── Relatório pós-backfill ────────────────────────────────────────────────
-- Compara arestas esperadas (do JSON) com as efetivamente migradas; qualquer
-- diferença indica linha pulada pelo cinto de segurança e merece investigação.
DO $$
DECLARE
  v_esperado INT;
  v_migrado  INT;
BEGIN
  SELECT count(DISTINCT (i.id, r->>'de_unidade', r->>'para_unidade')) INTO v_esperado
  FROM insumos i, jsonb_array_elements(i.detalhes_rendimento->'regras') r
  WHERE i.detalhes_rendimento IS NOT NULL
    AND r->>'de_unidade' <> r->>'para_unidade';

  SELECT count(*) INTO v_migrado FROM fatores_conversao WHERE item_id IS NOT NULL;

  RAISE NOTICE 'Backfill fatores_conversao: % de % arestas migradas.', v_migrado, v_esperado;
  IF v_migrado < v_esperado THEN
    RAISE WARNING 'Há % aresta(s) rejeitada(s) pela conservação — investigar.',
      v_esperado - v_migrado;
  END IF;
END $$;
