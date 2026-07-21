-- ═══════════════════════════════════════════════════════════════════════════
-- Sincronização de custo de lote ao editar preço do insumo
--
-- PROBLEMA: quando o usuário registra uma entrada de estoque sem informar o
-- custo explícito, o trigger fn_mov_criar_lote precifica o lote usando o
-- preco_embalagem / qtd_embalagem do insumo naquele momento. Se o usuário
-- depois percebe que o preço estava errado e corrige o insumo, o lote
-- histórico permanece com o custo antigo. O gráfico Custo 3D e o PEPS
-- continuam usando o valor incorreto.
--
-- SOLUÇÃO: trigger AFTER UPDATE em insumos que propaga a correção de preço
-- para todos os lotes que foram precificados por fallback (sem custo explícito
-- na movimentação de origem) e para lotes de abertura (bootstrap).
--
-- INTEGRIDADE PEPS: lotes com custo explícito (custo_total > 0 na entrada de
-- estoque) NÃO são alterados — representam o preço real pago naquela compra.
-- Apenas os lotes "derivados" do preco_embalagem são sincronizados.
--
-- REALTIME: adiciona insumos e lotes_estoque à publicação para que o gráfico
-- 3D receba notificações push e se reconstrua sem reload da página.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Replica identity full para que o Realtime entregue os valores antigos e
--    novos no evento, garantindo que o rebuild do grafo use dados frescos.
ALTER TABLE lotes_estoque REPLICA IDENTITY FULL;
ALTER TABLE insumos       REPLICA IDENTITY FULL;

-- 2. Publica as tabelas no canal Realtime do Supabase.
--    DO $$: protege contra erro caso a tabela já esteja na publicação.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE insumos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE lotes_estoque;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Função de sincronização de custo.
CREATE OR REPLACE FUNCTION fn_insumos_sync_custo_lote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_novo_custo NUMERIC;
BEGIN
  -- Calcula o custo unitário resultante do novo preço
  v_novo_custo := COALESCE(NEW.preco_embalagem / NULLIF(NEW.qtd_embalagem, 0), 0);

  IF v_novo_custo <= 0 THEN
    RETURN NEW;
  END IF;

  -- Sincroniza apenas lotes "derivados", ou seja, que NÃO vieram de uma
  -- compra com custo explícito informado pelo usuário:
  --   (a) lotes de abertura/bootstrap: origem_mov_id IS NULL
  --   (b) lotes criados a partir de entradas sem custo (custo_total = 0 ou NULL)
  UPDATE lotes_estoque l
  SET    custo_unitario = v_novo_custo
  WHERE  l.insumo_id = NEW.id
    AND  (
           -- (a) lote de abertura — sem movimentação de origem
           l.origem_mov_id IS NULL
           OR
           -- (b) lote gerado por entrada sem custo explícito
           EXISTS (
             SELECT 1
             FROM   movimentacoes_estoque m
             WHERE  m.id = l.origem_mov_id
               AND  (m.custo_total IS NULL OR m.custo_total = 0)
           )
         );

  RETURN NEW;
END;
$$;

-- 4. Trigger: dispara somente quando preco_embalagem ou qtd_embalagem mudar.
DROP TRIGGER IF EXISTS tg_insumos_sync_custo_lote ON insumos;

CREATE TRIGGER tg_insumos_sync_custo_lote
  AFTER UPDATE OF preco_embalagem, qtd_embalagem ON insumos
  FOR EACH ROW
  WHEN (
    OLD.preco_embalagem IS DISTINCT FROM NEW.preco_embalagem
    OR OLD.qtd_embalagem IS DISTINCT FROM NEW.qtd_embalagem
  )
  EXECUTE FUNCTION fn_insumos_sync_custo_lote();

-- 5. Aplica retroativamente para o estado atual do banco:
--    Corrige todos os lotes de fallback cujo custo diverge do preço atual.
--    Útil para insumos já editados antes desta migration existir.
UPDATE lotes_estoque l
SET    custo_unitario = COALESCE(i.preco_embalagem / NULLIF(i.qtd_embalagem, 0), 0)
FROM   insumos i
WHERE  i.id = l.insumo_id
  AND  COALESCE(i.preco_embalagem / NULLIF(i.qtd_embalagem, 0), 0) > 0
  AND  (
         l.origem_mov_id IS NULL
         OR EXISTS (
           SELECT 1
           FROM   movimentacoes_estoque m
           WHERE  m.id = l.origem_mov_id
             AND  (m.custo_total IS NULL OR m.custo_total = 0)
         )
       );
