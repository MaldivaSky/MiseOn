-- ============================================================
-- Corrige a identidade visual da loja natureba que já está no ar:
--   1) usa a logo real (public/natureba_logo.jpg) em vez de nenhuma
--   2) remove o banner_url de placeholder (LoremFlickr) — a vitrine
--      agora tem um gradiente com as cores da marca por baixo do
--      banner, então sem foto real fica bonito sozinho
--   3) remove o banner promocional de placeholder ruim
-- Idempotente — pode rodar de novo sem problema.
-- ============================================================

UPDATE lojas
SET logo_url = '/natureba_logo.jpg',
    banner_url = NULL
WHERE slug = 'natureba';

DELETE FROM banners_destaque
WHERE loja_id = (SELECT id FROM lojas WHERE slug = 'natureba')
  AND imagem_url LIKE '%loremflickr%';
