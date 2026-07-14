-- ============================================================
-- Seed: "Lanche do Paulista" — tenant de PROVAS (hamburgueria)
-- Objetivo: exercitar TODAS as frentes do sistema (KDS de Pedidos,
-- KDS de Produção/OS, Estoque, Preparos, Entregas, Financeiro) sem tocar
-- na Natureba. Rodar DEPOIS de schema.sql + todas as migrations.
--
-- Idempotente no nível da loja: se a loja 'lanchepaulista' já existir, o
-- bloco final aborta com aviso. Para recriar do zero, apague a loja antes:
--   DELETE FROM lojas WHERE slug = 'lanchepaulista';
-- (o ON DELETE CASCADE limpa produtos, insumos, pedidos, etc.)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM lojas WHERE slug = 'lanchepaulista') THEN
    RAISE NOTICE 'Loja lanchepaulista já existe — pulando seed. Apague-a antes para recriar.';
    RETURN;
  END IF;
END $$;

-- ── Loja ──────────────────────────────────────────────────────
INSERT INTO lojas (slug, nome, descricao, whatsapp, telefone, endereco, cnpj, razao_social,
                   pedido_minimo, cor_primaria, cor_secundaria)
SELECT 'lanchepaulista', 'Lanche do Paulista',
       'Hambúrgueres artesanais no capricho, batatas e combos. O verdadeiro sabor paulistano.',
       '5511911112222', '(11) 3255-1500', 'Av. Paulista, 1500 - Bela Vista, São Paulo/SP',
       '48.912.774/0001-08', 'Lanche do Paulista Comércio de Alimentos Ltda',
       20.00, '#dc2626', '#f59e0b'
WHERE NOT EXISTS (SELECT 1 FROM lojas WHERE slug = 'lanchepaulista');

-- ── Horários (seg-dom 18h-23h30) ──────────────────────────────
INSERT INTO horarios_funcionamento (loja_id, dia_semana, abre, fecha)
SELECT id, d, '18:00', '23:30' FROM lojas, generate_series(0,6) AS d WHERE slug = 'lanchepaulista';

-- ── Categorias ────────────────────────────────────────────────
INSERT INTO categorias (loja_id, nome, ordem)
SELECT id, c.nome, c.ordem FROM lojas,
  (VALUES ('DESTAQUES DA CASA',1),('BURGERS ARTESANAIS',2),('COMBOS',3),
          ('ACOMPANHAMENTOS',4),('BEBIDAS',5)) AS c(nome, ordem)
WHERE slug = 'lanchepaulista';

-- ── Produtos ──────────────────────────────────────────────────
WITH l AS (SELECT id FROM lojas WHERE slug = 'lanchepaulista'),
     cat AS (SELECT id, nome FROM categorias WHERE loja_id = (SELECT id FROM l))
INSERT INTO produtos (loja_id, categoria_id, nome, descricao, preco, is_combo, destaque, imagem_url)
SELECT (SELECT id FROM l), c.id, p.nome, p.descricao, p.preco, p.combo, p.destaque, p.imagem
FROM (VALUES
  ('BURGERS ARTESANAIS','X-PAULISTA','Pão brioche, blend artesanal 180g, cheddar, bacon, cebola caramelizada e molho da casa.',32.00,false,true,'https://loremflickr.com/640/480/burger,bacon'),
  ('BURGERS ARTESANAIS','X-SALADA','Pão brioche, blend 180g, queijo, alface, tomate e molho da casa.',26.00,false,true,'https://loremflickr.com/640/480/cheeseburger'),
  ('BURGERS ARTESANAIS','X-BACON','Pão brioche, blend 180g, cheddar e bacon crocante.',29.00,false,false,'https://loremflickr.com/640/480/bacon,burger'),
  ('DESTAQUES DA CASA','SMASH DUPLO','Dois smash de 90g, cheddar duplo, cebola e molho da casa.',34.00,false,true,'https://loremflickr.com/640/480/smash,burger'),
  ('COMBOS','COMBO X-BACON','X-Bacon + batata frita + bebida à escolha.',42.00,true,false,'https://loremflickr.com/640/480/burger,combo'),
  ('ACOMPANHAMENTOS','BATATA FRITA','Porção de batata frita crocante (300g).',18.00,false,false,'https://loremflickr.com/640/480/fries'),
  ('ACOMPANHAMENTOS','BATATA CHEDDAR E BACON','Batata frita coberta com cheddar cremoso e bacon.',26.00,false,true,'https://loremflickr.com/640/480/cheese,fries'),
  ('BEBIDAS','COCA-COLA LATA 350ML','Geladíssima.',7.00,false,false,'https://loremflickr.com/640/480/cola,can'),
  ('BEBIDAS','GUARANÁ LATA 350ML','Geladíssimo.',7.00,false,false,'https://loremflickr.com/640/480/soda,can')
) AS p(cat, nome, descricao, preco, combo, destaque, imagem)
JOIN cat c ON c.nome = p.cat;

-- ── Adicionais do X-Paulista ──────────────────────────────────
WITH prod AS (SELECT p.id FROM produtos p JOIN lojas l ON l.id=p.loja_id WHERE l.slug='lanchepaulista' AND p.nome='X-PAULISTA'),
     g AS (
       INSERT INTO grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas)
       SELECT id, 'Turbine seu lanche', 0, 5 FROM prod RETURNING id
     )
INSERT INTO opcoes (grupo_id, nome, preco_adicional)
SELECT g.id, o.nome, o.preco FROM g,
  (VALUES ('Bacon extra',6.00),('Cheddar extra',5.00),('Ovo',3.00),('Blend extra 180g',12.00)) AS o(nome, preco);

-- ── Bebida do combo ───────────────────────────────────────────
WITH prod AS (SELECT p.id FROM produtos p JOIN lojas l ON l.id=p.loja_id WHERE l.slug='lanchepaulista' AND p.nome='COMBO X-BACON'),
     g AS (
       INSERT INTO grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas)
       SELECT id, 'Bebida do combo', 1, 1 FROM prod RETURNING id
     )
INSERT INTO opcoes (grupo_id, nome, preco_adicional)
SELECT g.id, o.nome, 0 FROM g,
  (VALUES ('Coca-Cola lata'),('Guaraná lata'),('Água mineral')) AS o(nome);

-- ── Insumos brutos ────────────────────────────────────────────
WITH l AS (SELECT id FROM lojas WHERE slug = 'lanchepaulista')
INSERT INTO insumos (loja_id, nome, unidade_medida, quantidade_atual, estoque_minimo, preco_embalagem, qtd_embalagem)
SELECT (SELECT id FROM l), i.nome, i.un, i.qtd, i.min, i.preco, i.emb FROM (VALUES
  ('Pão brioche','un',      80::numeric, 20::numeric, 30.00::numeric, 10::numeric),
  ('Carne moída bovina','g',5000::numeric,2000::numeric,45.00::numeric,1000::numeric),
  ('Bacon em fatias','g',   1500::numeric,400::numeric, 32.00::numeric,1000::numeric),
  ('Queijo cheddar fatiado','un',120::numeric,40::numeric,28.00::numeric,50::numeric),
  ('Alface','un',           10::numeric, 3::numeric,  4.00::numeric, 1::numeric),
  ('Tomate','g',            3000::numeric,600::numeric, 8.00::numeric,1000::numeric),
  ('Cebola','g',            4000::numeric,800::numeric, 5.00::numeric,1000::numeric),
  ('Batata congelada','g',  8000::numeric,2000::numeric,22.00::numeric,2000::numeric),
  ('Cheddar cremoso','g',   2000::numeric,500::numeric, 30.00::numeric,1000::numeric),
  ('Maionese','g',          3000::numeric,800::numeric, 18.00::numeric,3000::numeric),
  ('Ketchup','g',           2000::numeric,500::numeric, 14.00::numeric,2000::numeric),
  ('Mostarda','g',          1000::numeric,300::numeric, 12.00::numeric,1000::numeric),
  ('Açúcar','g',            2000::numeric,500::numeric,  5.00::numeric,2000::numeric),
  ('Manteiga','g',          1000::numeric,300::numeric, 22.00::numeric,500::numeric),
  ('Coca-Cola lata','un',   48::numeric, 12::numeric, 120.00::numeric,24::numeric),
  ('Guaraná lata','un',     48::numeric, 12::numeric, 108.00::numeric,24::numeric)
) AS i(nome, un, qtd, min, preco, emb);

-- ── Preparos (receitas base) ──────────────────────────────────
--  Molho da Casa  → abaixo do mínimo, produzível ao vivo (insumos sobrando)
--  Blend Moldado  → abaixo do mínimo, produzível (bastante carne moída)
--  Cebola Caramelizada → em dia, para demonstrar "produzir sob demanda"
WITH l AS (SELECT id FROM lojas WHERE slug = 'lanchepaulista')
INSERT INTO insumos (loja_id, nome, unidade_medida, quantidade_atual, estoque_minimo,
                     preco_embalagem, qtd_embalagem, is_preparo, rendimento_porcoes, ativo)
SELECT (SELECT id FROM l), p.nome, p.un, p.qtd, p.min, 0, 1, true, p.rend, true
FROM (VALUES
  ('Molho da Casa','ml',        300::numeric, 1000::numeric, 1500),
  ('Blend Moldado 180g','un',   6::numeric,   20::numeric,   10),
  ('Cebola Caramelizada','g',   400::numeric, 300::numeric,  500)
) AS p(nome, un, qtd, min, rend);

-- Fichas dos preparos
-- ── Molho da Casa ──
WITH l AS (SELECT id FROM lojas WHERE slug = 'lanchepaulista'),
     prep AS (SELECT id FROM insumos WHERE loja_id=(SELECT id FROM l) AND nome='Molho da Casa'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id=(SELECT id FROM l))
INSERT INTO fichas_preparos (loja_id, preparo_id, insumo_id, quantidade)
SELECT (SELECT id FROM l), (SELECT id FROM prep), ins.id, f.qtd FROM ins
JOIN (VALUES ('Maionese',800::numeric),('Ketchup',400::numeric),('Mostarda',150::numeric),('Cebola',100::numeric))
  AS f(nome, qtd) ON f.nome = ins.nome;

-- ── Blend Moldado 180g ──
WITH l AS (SELECT id FROM lojas WHERE slug = 'lanchepaulista'),
     prep AS (SELECT id FROM insumos WHERE loja_id=(SELECT id FROM l) AND nome='Blend Moldado 180g'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id=(SELECT id FROM l))
INSERT INTO fichas_preparos (loja_id, preparo_id, insumo_id, quantidade)
SELECT (SELECT id FROM l), (SELECT id FROM prep), ins.id, f.qtd FROM ins
JOIN (VALUES ('Carne moída bovina',1800::numeric)) AS f(nome, qtd) ON f.nome = ins.nome;

-- ── Cebola Caramelizada ──
WITH l AS (SELECT id FROM lojas WHERE slug = 'lanchepaulista'),
     prep AS (SELECT id FROM insumos WHERE loja_id=(SELECT id FROM l) AND nome='Cebola Caramelizada'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id=(SELECT id FROM l))
INSERT INTO fichas_preparos (loja_id, preparo_id, insumo_id, quantidade)
SELECT (SELECT id FROM l), (SELECT id FROM prep), ins.id, f.qtd FROM ins
JOIN (VALUES ('Cebola',800::numeric),('Açúcar',60::numeric),('Manteiga',40::numeric))
  AS f(nome, qtd) ON f.nome = ins.nome;

-- ── Ficha técnica de produto usando PREPAROS como insumo ──────
-- X-PAULISTA consome o Blend Moldado, o Molho da Casa e a Cebola Caramelizada
-- (demonstra a cadeia produto → preparo → insumo bruto).
WITH l AS (SELECT id FROM lojas WHERE slug = 'lanchepaulista'),
     prod AS (SELECT id FROM produtos WHERE loja_id=(SELECT id FROM l) AND nome='X-PAULISTA'),
     ins AS (SELECT id, nome FROM insumos WHERE loja_id=(SELECT id FROM l))
INSERT INTO fichas_tecnicas (produto_id, insumo_id, quantidade_consumida)
SELECT (SELECT id FROM prod), ins.id, f.qtd FROM ins
JOIN (VALUES
  ('Pão brioche',1::numeric),
  ('Blend Moldado 180g',1::numeric),
  ('Molho da Casa',40::numeric),
  ('Cebola Caramelizada',30::numeric),
  ('Queijo cheddar fatiado',1::numeric),
  ('Bacon em fatias',30::numeric)
) AS f(nome, qtd) ON f.nome = ins.nome;

-- ── Cupom, taxas, entregadores ────────────────────────────────
INSERT INTO cupons (loja_id, codigo, descricao, tipo, valor, pedido_minimo, apenas_primeiro_pedido, metodo_exigido)
SELECT id, 'PAULISTA10', '10% OFF no primeiro pedido', 'PERCENTUAL', 10.00, 30.00, true, NULL
FROM lojas WHERE slug = 'lanchepaulista';

INSERT INTO taxas_entrega (loja_id, bairro, valor)
SELECT id, b.nome, b.valor FROM lojas,
  (VALUES ('Bela Vista',6.00),('Consolação',7.00),('Jardins',9.00),('Bixiga',6.00)) AS b(nome, valor)
WHERE slug = 'lanchepaulista';

INSERT INTO entregadores (loja_id, nome, telefone)
SELECT id, e.nome, e.tel FROM lojas,
  (VALUES ('Carlos Motoboy','5511933334444'),('Bruno Delivery','5511955556666')) AS e(nome, tel)
WHERE slug = 'lanchepaulista';

-- ── Configuração de custos (Financeiro + remuneração do entregador) ──
INSERT INTO configuracoes_custo (loja_id, custo_aluguel, custo_energia, custo_agua, custo_internet,
                                 custo_gas, outros_custos_fixos, expectativa_vendas_mes,
                                 tipo_remuneracao_entregador, valor_remuneracao_entregador)
SELECT id, 4500.00, 800.00, 250.00, 150.00, 600.00, 700.00, 1200, 'POR_ENTREGA', 6.00
FROM lojas WHERE slug = 'lanchepaulista'
ON CONFLICT (loja_id) DO NOTHING;

-- ── Pedidos em todos os status (para exercitar KDS, Entregas, Financeiro) ──
DO $$
DECLARE
  v_loja    uuid;
  v_ped     uuid;
  v_xpaul   uuid;
  v_xbacon  uuid;
  v_xsalada uuid;
  v_batata  uuid;
  v_combo   uuid;
  v_entreg  uuid;
BEGIN
  SELECT id INTO v_loja FROM lojas WHERE slug = 'lanchepaulista';
  SELECT id INTO v_xpaul   FROM produtos WHERE loja_id=v_loja AND nome='X-PAULISTA';
  SELECT id INTO v_xbacon  FROM produtos WHERE loja_id=v_loja AND nome='X-BACON';
  SELECT id INTO v_xsalada FROM produtos WHERE loja_id=v_loja AND nome='X-SALADA';
  SELECT id INTO v_batata  FROM produtos WHERE loja_id=v_loja AND nome='BATATA FRITA';
  SELECT id INTO v_combo   FROM produtos WHERE loja_id=v_loja AND nome='COMBO X-BACON';
  SELECT id INTO v_entreg  FROM entregadores WHERE loja_id=v_loja AND nome='Carlos Motoboy';

  -- 1) NOVO (acabou de entrar — aguardando aceite no KDS)
  INSERT INTO pedidos (loja_id, tipo_pedido, status, identificador_cliente, telefone_contato,
                       endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, origem, criado_em)
  VALUES (v_loja,'DELIVERY','NOVO','Marina Alves','5511987650001','Rua Frei Caneca, 200','Consolação',
          32.00, 7.00, 0, 39.00, 'link', now() - interval '4 minutes')
  RETURNING id INTO v_ped;
  INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    VALUES (v_ped, v_xpaul, 'X-PAULISTA', 32.00, 1, 'Sem cebola');
  INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago) VALUES (v_ped,'PIX','PENDENTE',39.00);

  -- 2) ACEITO (cozinha vai começar)
  INSERT INTO pedidos (loja_id, tipo_pedido, status, identificador_cliente, telefone_contato,
                       endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total, origem, criado_em)
  VALUES (v_loja,'DELIVERY','ACEITO','João Pedro','5511987650002','Alameda Santos, 45','Jardins',
          55.00, 9.00, 0, 64.00, 'link', now() - interval '12 minutes')
  RETURNING id INTO v_ped;
  INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
    VALUES (v_ped, v_xbacon, 'X-BACON', 29.00, 1), (v_ped, v_batata, 'BATATA FRITA', 18.00, 1),
           (v_ped, v_xsalada, 'X-SALADA', 26.00, 1);
  INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago) VALUES (v_ped,'CREDITO','PAGO',64.00);

  -- 3) PREPARANDO (na chapa)
  INSERT INTO pedidos (loja_id, tipo_pedido, status, identificador_cliente, telefone_contato,
                       subtotal, taxa_entrega, desconto, valor_total, origem, criado_em)
  VALUES (v_loja,'RETIRADA_BALCAO','PREPARANDO','Mesa 03', NULL,
          34.00, 0, 0, 34.00, 'balcao', now() - interval '18 minutes')
  RETURNING id INTO v_ped;
  INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
    VALUES (v_ped, v_combo, 'COMBO X-BACON', 42.00, 1);
  INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago) VALUES (v_ped,'DINHEIRO','PENDENTE',34.00);

  -- 4) PRONTO (pronto para despachar — testa a impressão do Romaneio e o despacho)
  INSERT INTO pedidos (loja_id, tipo_pedido, status, identificador_cliente, telefone_contato,
                       endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total,
                       troco_para, origem, criado_em)
  VALUES (v_loja,'DELIVERY','PRONTO','Ricardo Nunes','5511987650004','Rua Augusta, 900','Consolação',
          58.00, 7.00, 0, 65.00, 100.00, 'link', now() - interval '25 minutes')
  RETURNING id INTO v_ped;
  INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
    VALUES (v_ped, v_xpaul, 'X-PAULISTA', 32.00, 1), (v_ped, v_xbacon, 'X-BACON', 29.00, 1);
  INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago) VALUES (v_ped,'DINHEIRO','PENDENTE',65.00);

  -- 5) EM_ROTA (saiu para entrega — testa Live Tracking)
  INSERT INTO pedidos (loja_id, tipo_pedido, status, identificador_cliente, telefone_contato,
                       endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total,
                       entregador_id, origem, criado_em)
  VALUES (v_loja,'DELIVERY','EM_ROTA','Fernanda Lima','5511987650005','Rua da Consolação, 2200','Consolação',
          26.00, 6.00, 0, 32.00, v_entreg, 'link', now() - interval '40 minutes')
  RETURNING id INTO v_ped;
  INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
    VALUES (v_ped, v_xsalada, 'X-SALADA', 26.00, 1);
  INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago) VALUES (v_ped,'PIX','PAGO',32.00);

  -- 6) FINALIZADO (concluído — entra no Financeiro do dia)
  INSERT INTO pedidos (loja_id, tipo_pedido, status, identificador_cliente, telefone_contato,
                       endereco_entrega, bairro, subtotal, taxa_entrega, desconto, valor_total,
                       cupom_id, entregador_id, origem, criado_em)
  SELECT v_loja,'DELIVERY','FINALIZADO','Rafael Souza','5511987650006','Rua Treze de Maio, 100','Bixiga',
          64.00, 6.00, 6.40, 63.60, c.id, v_entreg, 'link', now() - interval '3 hours'
  FROM cupons c WHERE c.loja_id=v_loja AND c.codigo='PAULISTA10'
  RETURNING id INTO v_ped;
  INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
    VALUES (v_ped, v_xpaul, 'X-PAULISTA', 32.00, 2);
  INSERT INTO pagamentos (pedido_id, metodo, status, valor_pago) VALUES (v_ped,'PIX','PAGO',63.60);

  RAISE NOTICE 'Seed Lanche do Paulista concluída: 6 pedidos, 3 preparos, catálogo e insumos criados.';
END $$;

-- ⚠️ Para logar como admin desta loja de provas, crie um usuário Auth no
-- Supabase (Dashboard > Authentication > Add user) e vincule-o:
--   INSERT INTO usuarios_loja (user_id, loja_id, papel)
--   VALUES ('UUID-DO-USUARIO-AUTH', (SELECT id FROM lojas WHERE slug='lanchepaulista'), 'admin');
-- Para testar o App do Entregador, vincule o mesmo/outro usuário ao entregador Carlos:
--   UPDATE entregadores SET user_id = 'UUID-DO-USUARIO-AUTH'
--   WHERE loja_id = (SELECT id FROM lojas WHERE slug='lanchepaulista') AND nome='Carlos Motoboy';
