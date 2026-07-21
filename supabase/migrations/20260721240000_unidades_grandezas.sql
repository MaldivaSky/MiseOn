-- ═══════════════════════════════════════════════════════════════════════════
-- Matriz de grandezas e unidades — fim das unidades como string livre.
--
-- PROBLEMA: insumos.unidade_medida é TEXT sem vocabulário controlado. O banco
-- não sabe que "kg" e "g" são Massa, nem que "cx" é um agrupador abstrato.
-- Sem essa classificação, nenhuma trava contra "1 kg rende 10 kg" é possível
-- no nível do dado — só no aplicativo, que pode ser contornado.
--
-- SOLUÇÃO: tabela de classificação + função de validação + CHECK constraint.
-- A regra Q_destino·F_destino ≤ Q_origem·F_origem passa a ser invariante do
-- banco, não convenção do frontend.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE grandeza_medida AS ENUM (
  'massa',      -- kg, g      → fator fixo, base kg
  'volume',     -- L, ml      → fator fixo, base L
  'contagem',   -- un         → discreto
  'semantico',  -- fatias, porção, peça → quebra de uso, sem massa universal
  'agrupador'   -- cx, pct, fardo, lata, gf → abstração comercial
);

CREATE TABLE unidades_medida (
  codigo      TEXT PRIMARY KEY,
  rotulo      TEXT NOT NULL,
  grandeza    grandeza_medida NOT NULL,
  -- Fator para a unidade-base da grandeza. NULL para grandezas sem fator
  -- universal (agrupadores e semânticas), cujo rendimento é declaração humana.
  fator_base  NUMERIC(16,8),
  -- Invariante: grandezas dimensionais SEMPRE têm fator; as demais NUNCA têm.
  -- Só massa e volume têm fator universal. Contagem NÃO entra aqui: "1 un de
  -- tomate" não tem massa fixa, então quantas unidades saem de 10 kg é
  -- declaração humana (calibre da fruta), não física.
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
  ('gf',     'Garrafa (gf)',    'agrupador', NULL);

-- ── A trava, como função do banco ─────────────────────────────────────────
-- Espelha src/lib/unidades.ts::validarConversao. Retorna TRUE se a conversão
-- respeita a conservação; FALSE se tenta criar matéria do nada.
CREATE OR REPLACE FUNCTION conversao_valida(
  p_origem TEXT, p_destino TEXT,
  p_qtd_origem NUMERIC DEFAULT 1, p_qtd_destino NUMERIC DEFAULT 1
) RETURNS BOOLEAN
-- STABLE, não IMMUTABLE: a função LÊ unidades_medida. Declarar IMMUTABLE seria
-- mentir para o planejador e quebraria em restore de dump (ordem de carga).
LANGUAGE plpgsql STABLE AS $$
DECLARE
  o unidades_medida%ROWTYPE;
  d unidades_medida%ROWTYPE;
BEGIN
  SELECT * INTO o FROM unidades_medida WHERE codigo = p_origem;
  SELECT * INTO d FROM unidades_medida WHERE codigo = p_destino;
  IF o.codigo IS NULL OR d.codigo IS NULL THEN RETURN FALSE; END IF;

  -- Identidade: kg → kg não converte nada; é a porta do "1 kg vira 10 kg".
  IF o.codigo = d.codigo THEN RETURN FALSE; END IF;

  -- Sem fator em algum dos lados ⇒ rendimento é entrada humana legítima
  -- (caixa → kg, kg → fatias, un → porção).
  IF o.fator_base IS NULL OR d.fator_base IS NULL THEN RETURN TRUE; END IF;

  -- Duas grandezas dimensionais distintas: sem densidade, não há conversão.
  IF o.grandeza <> d.grandeza THEN RETURN FALSE; END IF;

  -- Mesma grandeza: a física manda. Só conservação ou perda.
  RETURN (p_qtd_destino * d.fator_base) <= (p_qtd_origem * o.fator_base) * 1.0001;
END;
$$;

-- ── Amarra insumos ao vocabulário controlado ──────────────────────────────
-- Nasce VALIDADA (sem NOT VALID): auditoria prévia da base de produção
-- confirmou que as 31 linhas de `insumos` já usam apenas g, un, fatias, ml e
-- porção — todas presentes no vocabulário. Não há dívida legada a tolerar,
-- então a trava vale para o passado e para o futuro desde o primeiro dia.
ALTER TABLE insumos
  ADD CONSTRAINT insumos_unidade_conhecida
  FOREIGN KEY (unidade_medida) REFERENCES unidades_medida(codigo);

-- ═══════════════════════════════════════════════════════════════════════════
-- Fatores_Conversao — o dicionário de medidas (arestas do grafo).
--
-- item_id NULL  → fator UNIVERSAL   (1 kg = 1000 g; vale para todo mundo)
-- item_id SET   → fator POR ITEM    (1 kg de tomate = 5 un; só daquele item)
--
-- A distinção é a essência do teorema: massa→massa é física (imutável), mas
-- massa→unidade é biologia (calibre da fruta), logo é declaração humana por
-- item. Modelar os dois na mesma tabela permite ao resolvedor de custo fazer
-- BFS sobre um grafo único.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE fatores_conversao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id         UUID REFERENCES lojas(id) ON DELETE CASCADE,
  -- NULL = fator universal, válido para qualquer insumo.
  item_id         UUID REFERENCES insumos(id) ON DELETE CASCADE,
  unidade_origem  TEXT NOT NULL REFERENCES unidades_medida(codigo),
  unidade_destino TEXT NOT NULL REFERENCES unidades_medida(codigo),
  -- 1 unidade_origem equivale a `multiplicador` unidade_destino.
  multiplicador   NUMERIC(16,8) NOT NULL CHECK (multiplicador > 0),
  criado_em       TIMESTAMPTZ DEFAULT now(),

  -- Um único fator por (item, origem, destino). Universais não colidem com
  -- os específicos porque item_id NULL é distinto em UNIQUE NULLS NOT DISTINCT.
  CONSTRAINT fator_unico UNIQUE NULLS NOT DISTINCT (item_id, unidade_origem, unidade_destino)
);

-- A trava do teorema, aplicada na escrita. Trigger e não CHECK porque a
-- validação cruza outra tabela (unidades_medida) — CHECK com função que lê
-- tabela é anti-padrão: não reavalia quando a tabela lida muda.
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

CREATE TRIGGER trg_fatores_conversao_valida
  BEFORE INSERT OR UPDATE ON fatores_conversao
  FOR EACH ROW EXECUTE FUNCTION fatores_conversao_valida();

CREATE INDEX idx_fatores_item ON fatores_conversao (item_id);
CREATE INDEX idx_fatores_loja ON fatores_conversao (loja_id);

-- Fatores universais (item_id NULL): as conversões físicas.
INSERT INTO fatores_conversao (loja_id, item_id, unidade_origem, unidade_destino, multiplicador)
VALUES (NULL, NULL, 'kg', 'g',  1000),
       (NULL, NULL, 'L',  'ml', 1000);

ALTER TABLE fatores_conversao ENABLE ROW LEVEL SECURITY;

-- Universais são legíveis por todos; específicos, só pela loja dona.
CREATE POLICY fatores_leitura ON fatores_conversao FOR SELECT
  USING (loja_id IS NULL OR loja_id IN (SELECT loja_id FROM usuarios_loja WHERE user_id = auth.uid()));

CREATE POLICY fatores_escrita ON fatores_conversao FOR ALL
  USING (loja_id IN (SELECT loja_id FROM usuarios_loja WHERE user_id = auth.uid()))
  WITH CHECK (loja_id IN (SELECT loja_id FROM usuarios_loja WHERE user_id = auth.uid()));
