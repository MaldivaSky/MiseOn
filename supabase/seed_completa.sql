-- ============================================================
-- MiseOn — Seed Completa v2 (2026)
-- Loja: "N" de Natureba — Baguetes Artesanais
-- Cobre: vitrine, cardápio, insumos, fichas técnicas,
--        pedidos em todos os status, clientes, cupons,
--        entregadores, rotas, chat, configurações de custo
-- ============================================================
-- ⚠️ Execute APENAS em ambiente de desenvolvimento/demo
-- ⚠️ Requer as migrações aplicadas (incluindo logistics)
-- ============================================================

-- Limpar dados anteriores da loja (idempotente)
DO $$
DECLARE v_loja UUID;
BEGIN
  SELECT id INTO v_loja FROM lojas WHERE slug = 'natureba';
  IF v_loja IS NOT NULL THEN
    DELETE FROM mensagens_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE loja_id = v_loja);
    DELETE FROM rotas_entrega WHERE loja_id = v_loja;
    DELETE FROM movimentacoes_estoque WHERE loja_id = v_loja;
    DELETE FROM fichas_tecnicas WHERE produto_id IN (SELECT id FROM produtos WHERE loja_id = v_loja);
    DELETE FROM itens_pedido_opcoes WHERE item_id IN (SELECT id FROM itens_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE loja_id = v_loja));
    DELETE FROM itens_pedido WHERE pedido_id IN (SELECT id FROM pedidos WHERE loja_id = v_loja);
    DELETE FROM pagamentos WHERE pedido_id IN (SELECT id FROM pedidos WHERE loja_id = v_loja);
    DELETE FROM pedidos WHERE loja_id = v_loja;
    DELETE FROM clientes WHERE loja_id = v_loja;
    DELETE FROM opcoes WHERE grupo_id IN (SELECT id FROM grupos_opcoes WHERE produto_id IN (SELECT id FROM produtos WHERE loja_id = v_loja));
    DELETE FROM grupos_opcoes WHERE produto_id IN (SELECT id FROM produtos WHERE loja_id = v_loja);
    DELETE FROM insumos WHERE loja_id = v_loja;
    DELETE FROM produtos WHERE loja_id = v_loja;
    DELETE FROM categorias WHERE loja_id = v_loja;
    DELETE FROM cupons WHERE loja_id = v_loja;
    DELETE FROM taxas_entrega WHERE loja_id = v_loja;
    DELETE FROM entregadores WHERE loja_id = v_loja;
    DELETE FROM banners_destaque WHERE loja_id = v_loja;
    DELETE FROM horarios_funcionamento WHERE loja_id = v_loja;
    DELETE FROM configuracoes_custo WHERE loja_id = v_loja;
    DELETE FROM lojas WHERE id = v_loja;
  END IF;
END $$;

-- ── 1. LOJA ────────────────────────────────────────────────────
INSERT INTO lojas (slug, nome, descricao, whatsapp, endereco, pedido_minimo, cor_primaria, cor_secundaria, aberto_manual)
VALUES (
  'natureba',
  '"N" de NATUREBA!',
  'Baguetes artesanais de fermentação natural, saladas e doces saudáveis feitos com amor.',
  '5511919889233',
  'Av. Sapopemba, 7750 - Box 2, São Paulo - SP',
  15.00,
  '#16a34a',
  '#f97316',
  true -- aberta para demo
);

-- ── 2. HORÁRIOS ───────────────────────────────────────────────
INSERT INTO horarios_funcionamento (loja_id, dia_semana, abre, fecha)
SELECT id, d, '11:00', '22:00' FROM lojas, generate_series(1,6) AS d WHERE slug = 'natureba';

-- ── 3. CATEGORIAS ─────────────────────────────────────────────
INSERT INTO categorias (loja_id, nome, ordem)
SELECT id, c.nome, c.ordem FROM lojas,
  (VALUES
    ('🥗 Saladas Fresquinhas', 1),
    ('🎂 Doces Artesanais', 2),
    ('🥖 Baguetes 15cm', 3),
    ('🥖 Combos 15cm', 4),
    ('🥖 Baguetes 30cm', 5),
    ('🥖 Combos 30cm', 6),
    ('🥤 Bebidas', 7)
  ) AS c(nome, ordem)
WHERE slug = 'natureba';

-- ── 4. PRODUTOS ────────────────────────────────────────────────
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     cat AS (SELECT id, nome FROM categorias WHERE loja_id = (SELECT id FROM l))
INSERT INTO produtos (loja_id, categoria_id, nome, descricao, preco, is_combo, destaque, disponivel, vendidos)
SELECT
  (SELECT id FROM l),
  c.id,
  p.nome,
  p.descricao,
  p.preco,
  p.combo,
  p.destaque,
  true,
  p.vendidos
FROM (VALUES
  -- Saladas
  ('🥗 Saladas Fresquinhas', 'Salada Frango Cremoso', 'Alface, tomate cereja, cenoura, palmito, pepino, croutons e patê de frango caseiro. Pote 750ml (~500g).', 29.98::numeric, false, true, 47),
  ('🥗 Saladas Fresquinhas', 'Salada Caesar Natureba', 'Alface romana, croutons artesanais, parmesão, tiras de frango grelhado e molho Caesar caseiro.', 32.00::numeric, false, false, 23),
  -- Doces
  ('🎂 Doces Artesanais', 'Bolo Bombom Ninho com Nutella', 'Camadas de bolo de baunilha úmido, creme de Ninho e Nutella. Pote individual.', 13.99::numeric, false, false, 85),
  ('🎂 Doces Artesanais', 'Brownie Fit com Whey', 'Brownie de chocolate com proteína. Sem glúten, sem açúcar refinado.', 9.90::numeric, false, false, 31),
  -- Baguetes 15cm
  ('🥖 Baguetes 15cm', 'Baguete de Frango 15cm', 'Patê de frango caseiro, queijo prato, alface e tomate. Massa fermentação natural.', 17.00::numeric, false, false, 112),
  ('🥖 Baguetes 15cm', 'Baguete de Carne Louca 15cm', 'Carne desfiada com tempero caseiro, queijo prato, alface e tomate.', 19.00::numeric, false, false, 88),
  ('🥖 Baguetes 15cm', 'Baguete Vegana 15cm', 'Patê de grão-de-bico, cenoura ralada, pepino e tomate. 100% plant-based.', 16.00::numeric, false, false, 19),
  -- Combos 15cm
  ('🥖 Combos 15cm', 'Combo Frango 15cm + Bebida', 'Baguete de frango 15cm + bebida à sua escolha.', 23.00::numeric, true, false, 67),
  -- Baguetes 30cm
  ('🥖 Baguetes 30cm', 'Baguete de Frango 30cm', 'Patê de frango caseiro, queijo prato, alface e tomate. Massa de fermentação natural.', 27.00::numeric, false, true, 203),
  ('🥖 Baguetes 30cm', 'Baguete de Presunto e Queijo 30cm', 'Maionese caseira, queijo prato, presunto, alface e tomate.', 18.00::numeric, false, true, 156),
  ('🥖 Baguetes 30cm', 'Baguete de Atum 30cm', 'Atum em azeite, cebola, tomate, azeitona preta e maionese. Clássico da casa!', 24.00::numeric, false, false, 77),
  ('🥖 Baguetes 30cm', 'Baguete Carne Louca 30cm', 'Carne desfiada com tempero caseiro, queijo prato, alface e tomate.', 29.00::numeric, false, false, 134),
  -- Combos 30cm
  ('🥖 Combos 30cm', 'Combo Baguete Frango 30cm', 'Baguete de frango 30cm + bebida à escolha.', 37.00::numeric, true, false, 91),
  ('🥖 Combos 30cm', 'Combo Baguete Presunto 30cm', 'Baguete de presunto e queijo 30cm + bebida à escolha.', 28.00::numeric, true, false, 64),
  -- Bebidas
  ('🥤 Bebidas', 'Coca-Cola 600ml', 'Geladinha, quase trincando!', 10.00::numeric, false, false, 289),
  ('🥤 Bebidas', 'Suco Natural de Laranja 500ml', 'Laranja espremida na hora, sem açúcar adicionado.', 12.00::numeric, false, false, 97),
  ('🥤 Bebidas', 'Água Mineral 510ml', 'Com ou sem gás.', 4.00::numeric, false, false, 143),
  ('🥤 Bebidas', 'Guaraná Antarctica 350ml', 'Latinha gelada.', 7.00::numeric, false, false, 61)
) AS p(cat, nome, descricao, preco, combo, destaque, vendidos)
JOIN cat c ON c.nome = p.cat;

-- ── 5. GRUPOS DE OPÇÕES E EXTRAS ─────────────────────────────

-- Extras para TODAS as baguetes
DO $$
DECLARE p_id UUID; g_id UUID;
BEGIN
  FOR p_id IN SELECT id FROM produtos WHERE nome LIKE '%Baguete%' AND loja_id = (SELECT id FROM lojas WHERE slug = 'natureba')
  LOOP
    INSERT INTO grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
    VALUES (p_id, 'Extras / Adicionais', 0, 5, 1)
    RETURNING id INTO g_id;

    INSERT INTO opcoes (grupo_id, nome, preco_adicional, ordem) VALUES
      (g_id, 'Queijo extra', 4.00, 1),
      (g_id, 'Bacon crocante', 5.00, 2),
      (g_id, 'Cebola roxa', 2.00, 3),
      (g_id, 'Molho especial da casa', 2.00, 4),
      (g_id, 'Alface extra', 1.00, 5);
  END LOOP;
END $$;

-- Bebida do combo para combos 15cm
DO $$
DECLARE p_id UUID; g_id UUID;
BEGIN
  FOR p_id IN SELECT id FROM produtos WHERE nome LIKE '%Combo%15cm%' AND loja_id = (SELECT id FROM lojas WHERE slug = 'natureba')
  LOOP
    INSERT INTO grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
    VALUES (p_id, 'Bebida do Combo', 1, 1, 0)
    RETURNING id INTO g_id;

    INSERT INTO opcoes (grupo_id, nome, preco_adicional) VALUES
      (g_id, 'Coca-Cola 350ml', 0),
      (g_id, 'Guaraná 350ml', 0),
      (g_id, 'Água mineral', 0),
      (g_id, 'Suco de laranja 300ml', 0);
  END LOOP;
END $$;

-- Bebida do combo para combos 30cm
DO $$
DECLARE p_id UUID; g_id UUID;
BEGIN
  FOR p_id IN SELECT id FROM produtos WHERE nome LIKE '%Combo%30cm%' AND loja_id = (SELECT id FROM lojas WHERE slug = 'natureba')
  LOOP
    INSERT INTO grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas, ordem)
    VALUES (p_id, 'Bebida do Combo', 1, 1, 0)
    RETURNING id INTO g_id;

    INSERT INTO opcoes (grupo_id, nome, preco_adicional) VALUES
      (g_id, 'Coca-Cola 600ml', 0),
      (g_id, 'Suco de laranja 500ml', 0),
      (g_id, 'Água mineral 510ml', 0),
      (g_id, 'Guaraná Antarctica 350ml', 0);
  END LOOP;
END $$;

-- ── 6. INSUMOS ───────────────────────────────────────────────
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO insumos (loja_id, nome, unidade_medida, quantidade_atual, estoque_minimo, preco_embalagem, qtd_embalagem, categoria_insumo, ativo)
SELECT (SELECT id FROM l), i.nome, i.un, i.qtd, i.min, i.preco, i.emb, i.cat, true
FROM (VALUES
  -- Ingredientes (usados nas receitas)
  ('Baguete 30cm', 'un', 35::numeric, 10::numeric, 54.00::numeric, 12::numeric, 'Ingrediente'),
  ('Baguete 15cm', 'un', 24::numeric, 8::numeric, 30.00::numeric, 12::numeric, 'Ingrediente'),
  ('Patê de frango (caseiro)', 'g', 4500::numeric, 800::numeric, 85.00::numeric, 2000::numeric, 'Ingrediente'),
  ('Queijo prato fatiado', 'g', 2200::numeric, 400::numeric, 62.00::numeric, 1000::numeric, 'Ingrediente'),
  ('Alface americana', 'g', 1800::numeric, 300::numeric, 6.00::numeric, 500::numeric, 'Ingrediente'),
  ('Tomate', 'g', 3000::numeric, 500::numeric, 9.00::numeric, 1000::numeric, 'Ingrediente'),
  ('Presunto fatiado', 'g', 1200::numeric, 300::numeric, 42.00::numeric, 500::numeric, 'Ingrediente'),
  ('Carne desfiada', 'g', 2800::numeric, 600::numeric, 95.00::numeric, 1000::numeric, 'Ingrediente'),
  ('Atum em azeite', 'g', 900::numeric, 200::numeric, 28.00::numeric, 300::numeric, 'Ingrediente'),
  ('Maionese caseira', 'g', 1500::numeric, 200::numeric, 22.00::numeric, 1000::numeric, 'Ingrediente'),
  ('Bacon em cubos', 'g', 600::numeric, 150::numeric, 38.00::numeric, 500::numeric, 'Ingrediente'),
  ('Laranja (sucos)', 'un', 80::numeric, 20::numeric, 45.00::numeric, 30::numeric, 'Ingrediente'),
  -- Revenda Direta
  ('Coca-Cola 600ml', 'un', 48::numeric, 12::numeric, 78.00::numeric, 12::numeric, 'Revenda Direta'),
  ('Coca-Cola 350ml lata', 'un', 36::numeric, 12::numeric, 55.00::numeric, 12::numeric, 'Revenda Direta'),
  ('Guaraná Antarctica 350ml', 'un', 24::numeric, 12::numeric, 42.00::numeric, 12::numeric, 'Revenda Direta'),
  ('Água Mineral 510ml', 'un', 60::numeric, 12::numeric, 30.00::numeric, 12::numeric, 'Revenda Direta'),
  -- Embalagens
  ('Embalagem sanduíche G', 'un', 200::numeric, 50::numeric, 35.00::numeric, 100::numeric, 'Embalagem'),
  ('Embalagem sanduíche P', 'un', 150::numeric, 50::numeric, 22.00::numeric, 100::numeric, 'Embalagem'),
  ('Saco kraft pequeno', 'un', 300::numeric, 100::numeric, 28.00::numeric, 200::numeric, 'Embalagem'),
  ('Guardanapo', 'un', 1000::numeric, 200::numeric, 12.00::numeric, 500::numeric, 'Embalagem'),
  -- Limpeza
  ('Detergente', 'ml', 2000::numeric, 500::numeric, 8.50::numeric, 500::numeric, 'Limpeza'),
  ('Álcool 70%', 'ml', 3000::numeric, 500::numeric, 18.00::numeric, 1000::numeric, 'Limpeza'),
  ('Luvas descartáveis', 'un', 100::numeric, 20::numeric, 32.00::numeric, 100::numeric, 'Limpeza')
) AS i(nome, un, qtd, min, preco, emb, cat);

-- ── 7. FICHAS TÉCNICAS ───────────────────────────────────────
-- Baguete Frango 30cm
WITH prod AS (SELECT id FROM produtos WHERE nome = 'Baguete de Frango 30cm'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id = (SELECT id FROM lojas WHERE slug = 'natureba'))
INSERT INTO fichas_tecnicas (produto_id, insumo_id, quantidade_consumida)
SELECT prod.id, ins.id, f.qtd FROM prod, ins
JOIN (VALUES
  ('Baguete 30cm', 1::numeric),
  ('Patê de frango (caseiro)', 120),
  ('Queijo prato fatiado', 35),
  ('Alface americana', 30),
  ('Tomate', 50),
  ('Embalagem sanduíche G', 1)
) AS f(nome, qtd) ON f.nome = ins.nome;

-- Baguete Presunto e Queijo 30cm
WITH prod AS (SELECT id FROM produtos WHERE nome = 'Baguete de Presunto e Queijo 30cm'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id = (SELECT id FROM lojas WHERE slug = 'natureba'))
INSERT INTO fichas_tecnicas (produto_id, insumo_id, quantidade_consumida)
SELECT prod.id, ins.id, f.qtd FROM prod, ins
JOIN (VALUES
  ('Baguete 30cm', 1::numeric),
  ('Presunto fatiado', 80),
  ('Queijo prato fatiado', 50),
  ('Maionese caseira', 20),
  ('Alface americana', 25),
  ('Tomate', 40),
  ('Embalagem sanduíche G', 1)
) AS f(nome, qtd) ON f.nome = ins.nome;

-- Baguete Carne Louca 30cm
WITH prod AS (SELECT id FROM produtos WHERE nome = 'Baguete Carne Louca 30cm'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id = (SELECT id FROM lojas WHERE slug = 'natureba'))
INSERT INTO fichas_tecnicas (produto_id, insumo_id, quantidade_consumida)
SELECT prod.id, ins.id, f.qtd FROM prod, ins
JOIN (VALUES
  ('Baguete 30cm', 1::numeric),
  ('Carne desfiada', 150),
  ('Queijo prato fatiado', 35),
  ('Alface americana', 25),
  ('Tomate', 40),
  ('Embalagem sanduíche G', 1)
) AS f(nome, qtd) ON f.nome = ins.nome;

-- ── 8. CUPONS ────────────────────────────────────────────────
INSERT INTO cupons (loja_id, codigo, descricao, tipo, valor, pedido_minimo, apenas_primeiro_pedido, metodo_exigido, ativo)
SELECT id, c.codigo, c.descricao, c.tipo::tipo_desconto, c.valor, c.min, c.primeiro, c.metodo::metodo_pgto, true
FROM lojas,
(VALUES
  ('PRIMEIRACOMPRA', 'R$5 off na primeira compra pagando com Pix', 'FIXO', 5.00::numeric, 30.00::numeric, true, 'PIX'),
  ('NATUREBA10', '10% de desconto em qualquer pedido acima de R$40', 'PERCENTUAL', 10.00::numeric, 40.00::numeric, false, NULL),
  ('BAGUETE15', 'R$15 de desconto em combos acima de R$60', 'FIXO', 15.00::numeric, 60.00::numeric, false, NULL)
) AS c(codigo, descricao, tipo, valor, min, primeiro, metodo)
WHERE slug = 'natureba';

-- ── 9. TAXAS DE ENTREGA ───────────────────────────────────────
INSERT INTO taxas_entrega (loja_id, bairro, valor)
SELECT id, b.bairro, b.valor FROM lojas,
(VALUES
  ('Sapopemba', 5.00::numeric),
  ('Vila Prudente', 8.00::numeric),
  ('São Mateus', 10.00::numeric),
  ('Itaquera', 12.00::numeric),
  ('Vila Formosa', 7.00::numeric),
  ('Mooca', 9.00::numeric)
) AS b(bairro, valor)
WHERE slug = 'natureba';

-- ── 10. CONFIGURAÇÕES DE CUSTO ────────────────────────────────
INSERT INTO configuracoes_custo (loja_id, custo_aluguel, custo_energia, custo_agua, custo_internet, custo_gas, outros_custos_fixos, expectativa_vendas_mes, tipo_remuneracao_entregador, valor_remuneracao_entregador)
SELECT id, 1800.00, 350.00, 80.00, 99.00, 220.00, 450.00, 8000.00, 'POR_ENTREGA', 5.00
FROM lojas WHERE slug = 'natureba';

-- ── 11. ENTREGADORES ─────────────────────────────────────────
INSERT INTO entregadores (loja_id, nome, telefone, veiculo, ativo)
SELECT id, e.nome, e.tel, e.veiculo, true FROM lojas,
(VALUES
  ('Carlos Moto', '5511991110001', 'moto'),
  ('Rafael Bike', '5511991110002', 'bicicleta'),
  ('Marcos Carro', '5511991110003', 'carro')
) AS e(nome, tel, veiculo)
WHERE slug = 'natureba';

-- ── 12. CLIENTES ────────────────────────────────────────────
INSERT INTO clientes (loja_id, telefone, nome, bairro, total_pedidos, ultimo_pedido)
SELECT id, c.tel, c.nome, c.bairro, c.pedidos, now() - (c.dias_atras || ' days')::interval
FROM lojas,
(VALUES
  ('5511988001001', 'Ana Paula', 'Sapopemba', 12, 2),
  ('5511988001002', 'João Carlos', 'Vila Prudente', 5, 7),
  ('5511988001003', 'Mariana Souza', 'São Mateus', 3, 1),
  ('5511988001004', 'Pedro Lima', 'Vila Formosa', 8, 0),
  ('5511988001005', 'Beatriz Costa', 'Sapopemba', 1, 0),
  ('5511988001006', 'Lucas Oliveira', 'Mooca', 21, 14)
) AS c(tel, nome, bairro, pedidos, dias_atras)
WHERE slug = 'natureba';

-- ── 13. PEDIDOS ──────────────────────────────────────────────
-- Cobrindo TODOS os status para visualização realista do painel

-- Pedido 1: NOVO (chegou agora)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     cli AS (SELECT id FROM clientes WHERE telefone = '5511988001001' AND loja_id = (SELECT id FROM l))
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, criado_em)
SELECT (SELECT id FROM l), 1, 'DELIVERY', 'NOVO', 'Ana Paula', '5511988001001',
  'Rua das Flores, 142, Apto 23', 'Sapopemba',
  37.00, 5.00, 0, 42.00, now() - interval '3 minutes'
WHERE NOT EXISTS (SELECT 1 FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 1);

-- Itens do Pedido 1
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 1)
INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
SELECT p.id, prod.id, 'Combo Baguete Frango 30cm', 37.00, 1
FROM p, produtos prod
WHERE prod.nome = 'Combo Baguete Frango 30cm' AND prod.loja_id = (SELECT id FROM l);

-- Pagamento Pedido 1 (PIX - pendente)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 1)
INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago)
SELECT p.id, 'PIX', 'PAGO', 42.00 FROM p;

-- Pedido 2: ACEITO
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, estoque_baixado, criado_em)
SELECT id, 2, 'DELIVERY', 'ACEITO', 'João Carlos', '5511988001002',
  'Av. Aricanduva, 3000, Bloco B', 'Vila Prudente',
  54.00, 8.00, 5.00, 57.00, true, now() - interval '18 minutes'
FROM lojas WHERE slug = 'natureba';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 2)
INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
VALUES
  ((SELECT p.id FROM p), (SELECT id FROM produtos WHERE nome = 'Baguete de Frango 30cm' LIMIT 1), 'Baguete de Frango 30cm', 27.00, 1),
  ((SELECT p.id FROM p), (SELECT id FROM produtos WHERE nome = 'Salada Frango Cremoso' LIMIT 1), 'Salada Frango Cremoso', 29.98, 1);

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 2)
INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago)
SELECT p.id, 'PIX', 'PAGO', 57.00 FROM p;

-- Pedido 3: PREPARANDO
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, estoque_baixado, criado_em)
SELECT id, 3, 'DELIVERY', 'PREPARANDO', 'Mariana Souza', '5511988001003',
  'Rua Itaquera, 88', 'São Mateus',
  18.00, 10.00, 0, 28.00, true, now() - interval '12 minutes'
FROM lojas WHERE slug = 'natureba';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 3)
INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
SELECT p.id, prod.id, 'Baguete de Presunto e Queijo 30cm', 18.00, 1
FROM p, produtos prod WHERE prod.nome = 'Baguete de Presunto e Queijo 30cm' LIMIT 1;

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 3)
INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago)
SELECT p.id, 'DINHEIRO', 'PENDENTE', 28.00 FROM p;

-- Pedido 4: PRONTO (aguardando rota)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, estoque_baixado, criado_em)
SELECT id, 4, 'DELIVERY', 'PRONTO', 'Pedro Lima', '5511988001004',
  'Rua Padre José, 55', 'Vila Formosa',
  39.00, 7.00, 0, 46.00, true, now() - interval '25 minutes'
FROM lojas WHERE slug = 'natureba';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 4)
INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
VALUES
  ((SELECT p.id FROM p), (SELECT id FROM produtos WHERE nome = 'Baguete Carne Louca 30cm' LIMIT 1), 'Baguete Carne Louca 30cm', 29.00, 1),
  ((SELECT p.id FROM p), (SELECT id FROM produtos WHERE nome = 'Coca-Cola 600ml' LIMIT 1), 'Coca-Cola 600ml', 10.00, 1);

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 4)
INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago)
SELECT p.id, 'CREDITO', 'PAGO', 46.00 FROM p;

-- Pedido 5: PRONTO (aguardando rota — segundo pedido pronto para despacho em lote)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, estoque_baixado, criado_em)
SELECT id, 5, 'DELIVERY', 'PRONTO', 'Beatriz Costa', '5511988001005',
  'Rua Serra da Canastra, 210', 'Sapopemba',
  27.00, 5.00, 0, 32.00, true, now() - interval '8 minutes'
FROM lojas WHERE slug = 'natureba';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 5)
INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
SELECT p.id, prod.id, 'Baguete de Frango 30cm', 27.00, 1
FROM p, produtos prod WHERE prod.nome = 'Baguete de Frango 30cm' LIMIT 1;

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 5)
INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago)
SELECT p.id, 'PIX', 'PAGO', 32.00 FROM p;

-- Pedido 6: EM_ROTA (com entregador Carlos)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     ent AS (SELECT id FROM entregadores WHERE loja_id = (SELECT id FROM l) AND nome = 'Carlos Moto')
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, estoque_baixado, entregador_id, ordem_entrega, criado_em)
SELECT (SELECT id FROM l), 6, 'DELIVERY', 'EM_ROTA', 'Lucas Oliveira', '5511988001006',
  'Rua da Mooca, 1200, Apto 42', 'Mooca',
  29.98, 9.00, 0, 38.98, true, (SELECT id FROM ent), 1, now() - interval '35 minutes'
FROM lojas WHERE slug = 'natureba';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 6)
INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
SELECT p.id, prod.id, 'Salada Frango Cremoso', 29.98, 1
FROM p, produtos prod WHERE prod.nome = 'Salada Frango Cremoso' LIMIT 1;

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 6)
INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago)
SELECT p.id, 'DEBITO', 'PENDENTE', 38.98 FROM p;

-- Localização do entregador em rota (simulando posição em SP)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 6)
INSERT INTO localizacao_entregador (pedido_id, lat, lng, atualizado_em)
SELECT p.id, -23.5606, -46.6244, now()
FROM p;

-- Chat no pedido EM_ROTA
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 6)
INSERT INTO mensagens_pedido (pedido_id, remetente_tipo, mensagem, criado_em)
VALUES
  ((SELECT p.id FROM p), 'LOJA', 'Seu pedido saiu para entrega! Carlos está a caminho. 🛵', now() - interval '10 minutes'),
  ((SELECT p.id FROM p), 'CLIENTE', 'Ótimo! Estarei na portaria.', now() - interval '8 minutes'),
  ((SELECT p.id FROM p), 'ENTREGADOR', 'Estou chegando! Uns 5 minutinhos.', now() - interval '3 minutes');

-- Pedido 7: FINALIZADO (histórico de hoje)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, estoque_baixado, criado_em)
SELECT id, 7, 'SALAO', 'FINALIZADO', 'Mesa 04', NULL, NULL, NULL,
  24.00, 0, 0, 24.00, true, now() - interval '2 hours'
FROM lojas WHERE slug = 'natureba';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 7)
INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
SELECT p.id, prod.id, 'Baguete de Atum 30cm', 24.00, 1
FROM p, produtos prod WHERE prod.nome = 'Baguete de Atum 30cm' LIMIT 1;

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 7)
INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago)
SELECT p.id, 'DINHEIRO', 'PAGO', 24.00 FROM p;

-- Pedido 8: CANCELADO
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, estoque_baixado, motivo_cancelamento, criado_em)
SELECT id, 8, 'DELIVERY', 'CANCELADO', 'Cliente Desistiu', '5511900000099',
  'Rua Teste, 1', 'Sapopemba',
  27.00, 5.00, 0, 32.00, false, 'Cliente solicitou cancelamento antes da confirmação.', now() - interval '1 hour'
FROM lojas WHERE slug = 'natureba';

-- Pedido 9: RETIRADA_BALCAO (PREPARANDO)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO pedidos (loja_id, numero, tipo_pedido, status, identificador_cliente, telefone_contato, endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, estoque_baixado, criado_em)
SELECT id, 9, 'RETIRADA_BALCAO', 'PREPARANDO', 'Roberto Silva', '5511988001099',
  NULL, NULL,
  46.00, 0, 0, 46.00, true, now() - interval '6 minutes'
FROM lojas WHERE slug = 'natureba';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 9)
INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
VALUES
  ((SELECT p.id FROM p), (SELECT id FROM produtos WHERE nome = 'Baguete de Frango 30cm' LIMIT 1), 'Baguete de Frango 30cm', 27.00, 1),
  ((SELECT p.id FROM p), (SELECT id FROM produtos WHERE nome = 'Suco Natural de Laranja 500ml' LIMIT 1), 'Suco Natural de Laranja 500ml', 12.00, 1),
  ((SELECT p.id FROM p), (SELECT id FROM produtos WHERE nome = 'Bolo Bombom Ninho com Nutella' LIMIT 1), 'Bolo Bombom Ninho com Nutella', 13.99, 1);

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     p AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 9)
INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago)
SELECT p.id, 'PIX', 'PAGO', 46.00 FROM p;

-- ── 14. ROTA COM PEDIDOS PRONTOS (demonstra o fluxo de despacho) ─────────
-- (O admin verá pedidos 4 e 5 como PRONTO/sem rota para despachar)
-- Criamos também uma rota com o pedido 6 (EM_ROTA) para demonstrar o painel
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     ent AS (SELECT id FROM entregadores WHERE loja_id = (SELECT id FROM l) AND nome = 'Carlos Moto'),
     ped6 AS (SELECT id FROM pedidos WHERE loja_id = (SELECT id FROM l) AND numero = 6)
INSERT INTO rotas_entrega (loja_id, entregador_id, status, criado_em)
SELECT (SELECT id FROM l), (SELECT id FROM ent), 'EM_ANDAMENTO', now() - interval '40 minutes';

-- Atualiza pedido 6 com o rota_id
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     rota AS (SELECT id FROM rotas_entrega WHERE loja_id = (SELECT id FROM l) ORDER BY criado_em DESC LIMIT 1)
UPDATE pedidos SET rota_id = (SELECT id FROM rota)
WHERE numero = 6 AND loja_id = (SELECT id FROM l);

-- ── 15. MOVIMENTAÇÕES DE ESTOQUE (histórico auditável) ────────
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo, criado_em)
SELECT
  (SELECT id FROM l),
  (SELECT id FROM insumos WHERE nome = 'Coca-Cola 600ml' AND loja_id = (SELECT id FROM l)),
  'ENTRADA',
  12,
  78.00,
  'Compra semanal — Nota Fiscal 00142',
  now() - interval '2 days';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo, criado_em)
SELECT
  (SELECT id FROM l),
  (SELECT id FROM insumos WHERE nome = 'Baguete 30cm' AND loja_id = (SELECT id FROM l)),
  'ENTRADA',
  12,
  54.00,
  'Fornecedor artesanal — entrega diária',
  now() - interval '6 hours';

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO movimentacoes_estoque (loja_id, insumo_id, tipo, quantidade, custo_total, motivo, criado_em)
SELECT
  (SELECT id FROM l),
  (SELECT id FROM insumos WHERE nome = 'Patê de frango (caseiro)' AND loja_id = (SELECT id FROM l)),
  'PERDA',
  -250,
  NULL,
  'Validade vencida — descarte',
  now() - interval '1 day';

-- ─────────────────────────────────────────────────────────────
-- Seed concluída. Resumo do estado criado:
--
-- Loja: "N" de Natureba (slug: natureba, aberta)
-- Categorias: 7 | Produtos: 18 | Insumos: 23
-- Fichas técnicas: 3 produtos mapeados
-- Cupons: 3 | Taxas de entrega: 6 bairros
-- Entregadores: 3 (Carlos Moto, Rafael Bike, Marcos Carro)
-- Clientes: 6
-- Pedidos: 9 (cobrindo TODOS os status)
--   1-NOVO, 2-ACEITO, 3-PREPARANDO, 4-PRONTO, 5-PRONTO,
--   6-EM_ROTA (com Live Tracking ativo), 7-FINALIZADO, 8-CANCELADO, 9-RETIRADA_BALCAO
-- Rota ativa com Carlos Moto em campo
-- Chat com mensagens entre Loja, Cliente e Entregador
-- ─────────────────────────────────────────────────────────────
