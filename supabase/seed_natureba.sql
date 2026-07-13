-- ============================================================
-- Seed: "N" de Natureba (dados reais do cardápio no Anota AI)
-- Rodar após schema.sql
-- ============================================================

INSERT INTO lojas (slug, nome, descricao, whatsapp, endereco, pedido_minimo, cor_primaria, cor_secundaria, banner_url)
VALUES (
  'natureba', '"N" de NATUREBA!',
  'Baguetes artesanais de fermentação natural, saladas e doces.',
  '5511900000000',                       -- TROCAR pelo WhatsApp real
  'Av. Sapopemba, 7750 - Box 2',
  15.00, '#16a34a', '#f97316',
  'https://loremflickr.com/1200/400/bakery,sandwich'  -- placeholder — troque em Minha Loja → Aparência
);

-- Banner promocional na vitrine (placeholder — troque em Marketing → Banners)
INSERT INTO banners_destaque (loja_id, imagem_url, titulo, ordem_exibicao)
SELECT id, 'https://loremflickr.com/1200/400/food,promo', 'Confira nosso cardápio!', 0
FROM lojas WHERE slug = 'natureba';

-- Horários (seg-sáb 12h28–22h como exemplo — ajustar com o cliente)
INSERT INTO horarios_funcionamento (loja_id, dia_semana, abre, fecha)
SELECT id, d, '12:28', '22:00' FROM lojas, generate_series(1,6) AS d WHERE slug = 'natureba';

-- Categorias (ordem do cardápio real)
INSERT INTO categorias (loja_id, nome, ordem)
SELECT id, c.nome, c.ordem FROM lojas,
  (VALUES ('FRESCOR NA ÁREA - SALADA!',1),('NOVIDADE NA ÁREA - DOCES',2),
          ('BAGUETES 15CM',3),('COMBOS DE 15CM',4),('BAGUETES 30CM',5),
          ('COMBOS DE 30CM',6),('BEBIDAS',7)) AS c(nome, ordem)
WHERE slug = 'natureba';

-- Produtos (amostra — completar no painel)
-- imagem_url usa placeholders do LoremFlickr (fotos reais por palavra-chave) só pra não
-- ficar sem imagem nenhuma; troque pela foto real do produto em Cardápio → editar produto.
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba'),
     cat AS (SELECT id, nome FROM categorias WHERE loja_id = (SELECT id FROM l))
INSERT INTO produtos (loja_id, categoria_id, nome, descricao, preco, is_combo, destaque, imagem_url)
SELECT (SELECT id FROM l), c.id, p.nome, p.descricao, p.preco, p.combo, p.destaque, p.imagem
FROM (VALUES
  ('BAGUETES 30CM','BAGUETE DE FRANGO - 30CM','Baguete artesanal de fermentação natural. Patê de frango caseiro, queijo prato, alface e tomate.',27.00,false,true,'https://loremflickr.com/640/480/chicken,sandwich'),
  ('BAGUETES 30CM','BAGUETE DE PRESUNTO E QUEIJO - 30CM','Maionese, queijo prato, presunto, alface e tomate.',18.00,false,true,'https://loremflickr.com/640/480/ham,sandwich'),
  ('BAGUETES 15CM','BAGUETE DE FRANGO - 15CM','Patê de frango caseiro, queijo prato, alface e tomate.',24.00,false,false,'https://loremflickr.com/640/480/chicken,baguette'),
  ('BAGUETES 15CM','BAGUETE DE CARNE LOUCA - 15CM','Carne desfiada com tempero caseiro, alface e tomate.',28.00,false,false,'https://loremflickr.com/640/480/beef,sandwich'),
  ('FRESCOR NA ÁREA - SALADA!','SALADA FRANGO CREMOSO','Alface, tomate cereja, cenoura, palmito, pepino, croutons e patê de frango. Pote 750ml (~500g).',29.98,false,true,'https://loremflickr.com/640/480/chicken,salad'),
  ('NOVIDADE NA ÁREA - DOCES','BOLO BOMBOM NINHO COM NUTELLA','Sobremesa ultra cremosa em camadas.',13.99,false,false,'https://loremflickr.com/640/480/chocolate,cake'),
  ('COMBOS DE 30CM','COMBO BAGUETE DE FRANGO - 30CM','Baguete de frango 30cm + bebida à sua escolha.',37.00,true,false,'https://loremflickr.com/640/480/sandwich,meal'),
  ('BEBIDAS','COCA COLA 600ML','Sua bebida chega geladinha, quase trincando!',10.00,false,false,'https://loremflickr.com/640/480/cola,bottle'),
  ('BEBIDAS','ÁGUA MINERAL NATURAL 510ML','Sua bebida chega geladinha!',3.50,false,false,'https://loremflickr.com/640/480/water,bottle')
) AS p(cat, nome, descricao, preco, combo, destaque, imagem)
JOIN cat c ON c.nome = p.cat;

-- Grupo de extras da baguete de frango 30cm (exemplo)
WITH prod AS (SELECT id FROM produtos WHERE nome = 'BAGUETE DE FRANGO - 30CM'),
     g AS (
       INSERT INTO grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas)
       SELECT id, 'Acompanhamentos extras', 0, 5 FROM prod RETURNING id
     )
INSERT INTO opcoes (grupo_id, nome, preco_adicional)
SELECT g.id, o.nome, o.preco FROM g,
  (VALUES ('Cebola roxa',2.00),('Queijo extra',4.00),('Bacon',5.00)) AS o(nome, preco);

-- Grupo "Bebida do combo"
WITH prod AS (SELECT id FROM produtos WHERE nome = 'COMBO BAGUETE DE FRANGO - 30CM'),
     g AS (
       INSERT INTO grupos_opcoes (produto_id, nome, min_escolhas, max_escolhas)
       SELECT id, 'Bebida do combo', 1, 1 FROM prod RETURNING id
     )
INSERT INTO opcoes (grupo_id, nome, preco_adicional)
SELECT g.id, o.nome, 0 FROM g,
  (VALUES ('Coca Cola 350ml'),('Guaraná 350ml'),('Suco de laranja 1L'),('Água mineral')) AS o(nome);

-- Insumos + ficha técnica (exemplo: baguete de frango 30cm)
WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
INSERT INTO insumos (loja_id, nome, unidade_medida, quantidade_atual, estoque_minimo, preco_embalagem, qtd_embalagem)
SELECT (SELECT id FROM l), i.nome, i.un, i.qtd, i.min, i.preco, i.emb FROM (VALUES
  ('Baguete 30cm','un',20::numeric,5::numeric,45.00::numeric,10::numeric),     -- 10 un por R$45
  ('Patê de frango','g',3000,500,80.00,2000),                                   -- 2kg por R$80
  ('Queijo prato','g',1500,300,55.00,1000),
  ('Alface americana','un',6,2,4.50,1),
  ('Tomate','g',2000,400,8.00,1000),
  ('Coca Cola 600ml','un',24,6,60.00,12)
) AS i(nome, un, qtd, min, preco, emb);

WITH prod AS (SELECT id FROM produtos WHERE nome = 'BAGUETE DE FRANGO - 30CM'),
     ins AS (SELECT id, nome FROM insumos)
INSERT INTO fichas_tecnicas (produto_id, insumo_id, quantidade_consumida)
SELECT prod.id, ins.id, f.qtd FROM prod, ins
JOIN (VALUES ('Baguete 30cm',1::numeric),('Patê de frango',120),('Queijo prato',40),
             ('Alface americana',0.15),('Tomate',60)) AS f(nome, qtd)
  ON f.nome = ins.nome;

-- Cupom real que ele usa hoje
INSERT INTO cupons (loja_id, codigo, descricao, tipo, valor, pedido_minimo, apenas_primeiro_pedido, metodo_exigido)
SELECT id, 'PRIMEIRACOMPRA', 'Desconto de R$5 na primeira compra pagando com Pix', 'FIXO', 5.00, 30.00, true, 'PIX'
FROM lojas WHERE slug = 'natureba';

-- Taxas de entrega por bairro (exemplo — ajustar com o cliente)
INSERT INTO taxas_entrega (loja_id, bairro, valor)
SELECT id, b.nome, b.valor FROM lojas,
  (VALUES ('Sapopemba',5.00),('Vila Prudente',8.00),('São Mateus',10.00)) AS b(nome, valor)
WHERE slug = 'natureba';

-- Entregador
INSERT INTO entregadores (loja_id, nome, telefone)
SELECT id, 'Motoboy parceiro', '' FROM lojas WHERE slug = 'natureba';

-- ⚠️ Após criar o usuário do dono no Supabase Auth (Dashboard > Authentication),
-- vincule-o à loja:
-- INSERT INTO usuarios_loja (user_id, loja_id)
-- VALUES ('UUID-DO-USUARIO-AUTH', (SELECT id FROM lojas WHERE slug = 'natureba'));
