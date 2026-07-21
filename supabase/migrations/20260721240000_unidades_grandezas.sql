-- ═══════════════════════════════════════════════════════════════════════════
-- Matriz de grandezas e unidades — fim das unidades como string livre.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE grandeza_medida AS ENUM (
    'massa',      -- kg, g      → fator fixo, base kg
    'volume',     -- L, ml      → fator fixo, base L
    'contagem',   -- un         → discreto
    'semantico',  -- fatias, porção, peça → quebra de uso, sem massa universal
    'agrupador'   -- cx, pct, fardo, lata, gf → abstração comercial
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS unidades_medida (
  codigo      TEXT PRIMARY KEY,
  rotulo      TEXT NOT NULL,
  grandeza    grandeza_medida NOT NULL,
  fator_base  NUMERIC(16,8),
  CONSTRAINT fator_coerente_com_grandeza CHECK (
    (grandeza IN ('massa','volume') AND fator_base IS NOT NULL AND fator_base > 0)
    OR
    (grandeza IN ('contagem','semantico','agrupador') AND fator_base IS NULL)
  )
);

INSERT INTO unidades_medida (codigo, rotulo, grandeza, fator_base) VALUES
  ('kg',     'Quilograma (kg)', 'massa',     1),
  ('g',      'Grama (g)',       'massa',     0.001),
  ('L',      'Litro (L)',       'volume',    1),
  ('ml',     'Mililitro (ml)',  'volume',    0.001),
  ('un',     'Unidade (un)',    'contagem',  NULL),
  ('fatias', 'Fatias',          'semantico', NULL),
  ('porção', 'Porções',         'semantico', NULL),
  ('peça',   'Peças',           'semantico', NULL),
  ('cx',     'Caixa (cx)',      'agrupador', NULL),
  ('pct',    'Pacote (pct)',    'agrupador', NULL),
  ('fardo',  'Fardo',           'agrupador', NULL),
  ('lata',   'Lata',            'agrupador', NULL),
  ('gf',     'Garrafa (gf)',    'agrupador', NULL)
ON CONFLICT (codigo) DO NOTHING;

CREATE OR REPLACE FUNCTION conversao_valida(
  p_origem TEXT, p_destino TEXT,
  p_qtd_origem NUMERIC DEFAULT 1, p_qtd_destino NUMERIC DEFAULT 1
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
  o unidades_medida%ROWTYPE;
  d unidades_medida%ROWTYPE;
BEGIN
  SELECT * INTO o FROM unidades_medida WHERE codigo = p_origem;
  SELECT * INTO d FROM unidades_medida WHERE codigo = p_destino;
  IF o.codigo IS NULL OR d.codigo IS NULL THEN RETURN FALSE; END IF;

  IF o.codigo = d.codigo THEN RETURN FALSE; END IF;
  IF o.fator_base IS NULL OR d.fator_base IS NULL THEN RETURN TRUE; END IF;
  IF o.grandeza <> d.grandeza THEN RETURN FALSE; END IF;

  RETURN (p_qtd_destino * d.fator_base) <= (p_qtd_origem * o.fator_base) * 1.0001;
END;
$$;

ALTER TABLE insumos DROP CONSTRAINT IF EXISTS insumos_unidade_conhecida;
ALTER TABLE insumos
  ADD CONSTRAINT insumos_unidade_conhecida
  FOREIGN KEY (unidade_medida) REFERENCES unidades_medida(codigo);

CREATE TABLE IF NOT EXISTS fatores_conversao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id         UUID REFERENCES lojas(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES insumos(id) ON DELETE CASCADE,
  unidade_origem  TEXT NOT NULL REFERENCES unidades_medida(codigo),
  unidade_destino TEXT NOT NULL REFERENCES unidades_medida(codigo),
  multiplicador   NUMERIC(16,8) NOT NULL CHECK (multiplicador > 0),
  criado_em       TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fator_unico UNIQUE NULLS NOT DISTINCT (item_id, unidade_origem, unidade_destino)
);

CREATE OR REPLACE FUNCTION fatores_conversao_valida() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT conversao_valida(NEW.unidade_origem, NEW.unidade_destino, 1, NEW.multiplicador) THEN
    RAISE EXCEPTION
      'Conversão inválida: 1 % não pode render % % (viola conservação de grandeza).',
      NEW.unidade_origem, NEW.multiplicador, NEW.unidade_destino
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fatores_conversao_valida ON fatores_conversao;
CREATE TRIGGER trg_fatores_conversao_valida
  BEFORE INSERT OR UPDATE ON fatores_conversao
  FOR EACH ROW EXECUTE FUNCTION fatores_conversao_valida();

CREATE INDEX IF NOT EXISTS idx_fatores_item ON fatores_conversao (item_id);
CREATE INDEX IF NOT EXISTS idx_fatores_loja ON fatores_conversao (loja_id);

INSERT INTO fatores_conversao (loja_id, item_id, unidade_origem, unidade_destino, multiplicador)
VALUES (NULL, NULL, 'kg', 'g',  1000),
       (NULL, NULL, 'L',  'ml', 1000)
ON CONFLICT DO NOTHING;

ALTER TABLE fatores_conversao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fatores_leitura ON fatores_conversao;
CREATE POLICY fatores_leitura ON fatores_conversao FOR SELECT
  USING (loja_id IS NULL OR loja_id IN (SELECT loja_id FROM usuarios_loja WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS fatores_escrita ON fatores_conversao;
CREATE POLICY fatores_escrita ON fatores_conversao FOR ALL
  USING (loja_id IN (SELECT loja_id FROM usuarios_loja WHERE user_id = auth.uid()))
  WITH CHECK (loja_id IN (SELECT loja_id FROM usuarios_loja WHERE user_id = auth.uid()));
