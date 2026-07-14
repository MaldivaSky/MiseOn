-- ============================================================
-- Suplemento Natureba — Preparos (Cozinha & Produção)
-- Habilita a KDS de Produção no tenant de demonstração.
-- 100% ADITIVO: não altera cardápio, fotos, insumos ou pedidos existentes.
-- Idempotente (guardas NOT EXISTS) — pode rodar mais de uma vez sem duplicar.
-- Rodar DEPOIS de seed_natureba.sql e das migrations de preparos.
-- ============================================================

-- 1) Insumos brutos usados pelos preparos (só insere os que ainda não existem).
--    'Acém bovino' entra propositalmente com estoque BAIXO para demonstrar,
--    na KDS, uma OS que fica bloqueada por falta de insumo.
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO insumos (loja_id, nome, unidade_medida, quantidade_atual, estoque_minimo, preco_embalagem, qtd_embalagem)
SELECT (SELECT id FROM l), i.nome, i.un, i.qtd, i.min, i.preco, i.emb
FROM (VALUES
  ('Manjericão fresco','g',   400::numeric, 100::numeric,  6.00::numeric, 100::numeric),
  ('Azeite extra virgem','ml',2000::numeric,500::numeric, 40.00::numeric, 500::numeric),
  ('Alho','g',                800::numeric, 200::numeric, 20.00::numeric, 500::numeric),
  ('Castanha de caju','g',    600::numeric, 150::numeric, 55.00::numeric, 500::numeric),
  ('Acém bovino','g',         400::numeric,1500::numeric, 38.00::numeric,1000::numeric)
) AS i(nome, un, qtd, min, preco, emb)
WHERE NOT EXISTS (
  SELECT 1 FROM insumos x WHERE x.loja_id = (SELECT id FROM l) AND x.nome = i.nome
);

-- 2) Preparos (receitas base). São linhas em `insumos` com is_preparo = true.
--    Ambos entram ABAIXO do estoque mínimo → aparecem como OS sugeridas na KDS.
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO insumos (loja_id, nome, unidade_medida, quantidade_atual, estoque_minimo,
                     preco_embalagem, qtd_embalagem, is_preparo, rendimento_porcoes, ativo)
SELECT (SELECT id FROM l), p.nome, p.un, p.qtd, p.min, 0, 1, true, p.rend, true
FROM (VALUES
  ('Molho Pesto da Casa','ml', 200::numeric,  800::numeric, 500),   -- produzível ao vivo
  ('Carne Louca Desfiada','g', 150::numeric, 1000::numeric, 800)    -- ficará bloqueada (Acém insuficiente)
) AS p(nome, un, qtd, min, rend)
WHERE NOT EXISTS (
  SELECT 1 FROM insumos x WHERE x.loja_id = (SELECT id FROM l) AND x.nome = p.nome
);

-- 3) Fichas técnicas dos preparos (ingredientes por 1 lote).
-- ── Molho Pesto da Casa ──
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     prep AS (SELECT id FROM insumos WHERE loja_id = (SELECT id FROM l) AND nome = 'Molho Pesto da Casa'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id = (SELECT id FROM l))
INSERT INTO fichas_preparos (loja_id, preparo_id, insumo_id, quantidade)
SELECT (SELECT id FROM l), (SELECT id FROM prep), ins.id, f.qtd
FROM ins
JOIN (VALUES
  ('Manjericão fresco', 80::numeric),
  ('Azeite extra virgem',200::numeric),
  ('Alho',               20::numeric),
  ('Queijo prato',       60::numeric),
  ('Castanha de caju',   50::numeric)
) AS f(nome, qtd) ON f.nome = ins.nome
WHERE NOT EXISTS (
  SELECT 1 FROM fichas_preparos fp WHERE fp.preparo_id = (SELECT id FROM prep)
);

-- ── Carne Louca Desfiada (Acém insuficiente de propósito) ──
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     prep AS (SELECT id FROM insumos WHERE loja_id = (SELECT id FROM l) AND nome = 'Carne Louca Desfiada'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id = (SELECT id FROM l))
INSERT INTO fichas_preparos (loja_id, preparo_id, insumo_id, quantidade)
SELECT (SELECT id FROM l), (SELECT id FROM prep), ins.id, f.qtd
FROM ins
JOIN (VALUES
  ('Acém bovino',1000::numeric),
  ('Tomate',      200::numeric),
  ('Alho',         15::numeric)
) AS f(nome, qtd) ON f.nome = ins.nome
WHERE NOT EXISTS (
  SELECT 1 FROM fichas_preparos fp WHERE fp.preparo_id = (SELECT id FROM prep)
);
