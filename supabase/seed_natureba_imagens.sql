-- ============================================================
-- Patch: adiciona foto nos produtos da loja "natureba" que já existia
-- sem imagem_url. Só UPDATE — idempotente, pode rodar quantas vezes quiser.
-- Logo e banner NÃO entram aqui de propósito — veja fix_natureba_visual.sql
-- (usa a foto real em public/natureba_logo.jpg e deixa o banner em branco,
-- a vitrine já desenha um gradiente com a cor da marca sem precisar de foto).
-- ============================================================

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
