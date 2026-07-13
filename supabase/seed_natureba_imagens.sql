-- ============================================================
-- Patch: adiciona imagens de placeholder na loja "natureba" que
-- JÁ FOI criada (seed_natureba.sql original não tinha imagem_url).
-- Só UPDATE — idempotente, pode rodar quantas vezes quiser.
-- São fotos de banco de imagens (LoremFlickr) só pra não ficar sem
-- nenhuma imagem; troque pelas fotos reais em Minha Loja → Aparência
-- (logo/banner) e Cardápio → editar produto (foto do produto).
-- ============================================================

UPDATE lojas SET banner_url = 'https://loremflickr.com/1200/400/bakery,sandwich'
WHERE slug = 'natureba' AND banner_url IS NULL;

INSERT INTO banners_destaque (loja_id, imagem_url, titulo, ordem_exibicao)
SELECT id, 'https://loremflickr.com/1200/400/food,promo', 'Confira nosso cardápio!', 0
FROM lojas WHERE slug = 'natureba'
AND NOT EXISTS (SELECT 1 FROM banners_destaque WHERE loja_id = lojas.id);

WITH l AS (SELECT id FROM lojas WHERE slug = 'natureba')
UPDATE produtos p SET imagem_url = v.imagem
FROM (VALUES
  ('BAGUETE DE FRANGO - 30CM','https://loremflickr.com/640/480/chicken,sandwich'),
  ('BAGUETE DE PRESUNTO E QUEIJO - 30CM','https://loremflickr.com/640/480/ham,sandwich'),
  ('BAGUETE DE FRANGO - 15CM','https://loremflickr.com/640/480/chicken,baguette'),
  ('BAGUETE DE CARNE LOUCA - 15CM','https://loremflickr.com/640/480/beef,sandwich'),
  ('SALADA FRANGO CREMOSO','https://loremflickr.com/640/480/chicken,salad'),
  ('BOLO BOMBOM NINHO COM NUTELLA','https://loremflickr.com/640/480/chocolate,cake'),
  ('COMBO BAGUETE DE FRANGO - 30CM','https://loremflickr.com/640/480/sandwich,meal'),
  ('COCA COLA 600ML','https://loremflickr.com/640/480/cola,bottle'),
  ('ÁGUA MINERAL NATURAL 510ML','https://loremflickr.com/640/480/water,bottle')
) AS v(nome, imagem)
WHERE p.nome = v.nome AND p.loja_id = (SELECT id FROM l) AND p.imagem_url IS NULL;
