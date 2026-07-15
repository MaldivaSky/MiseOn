ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS tema_cardapio text
  CHECK (tema_cardapio IN ('claro', 'escuro'));

UPDATE public.lojas
SET tema_cardapio = CASE
  WHEN tema_cardapio IS NOT NULL THEN tema_cardapio
  WHEN cor_texto IS NULL THEN 'claro'
  WHEN lower(cor_texto) IN ('#111827', '#0f172a', '#171717', '#000000', '#334155', '#450a0a', '#064e3b', '#2e1065', '#1f2937', '#172033', '#102a43', '#1f1235')
    THEN 'escuro'
  ELSE 'claro'
END
WHERE tema_cardapio IS NULL;

ALTER TABLE public.lojas
  ALTER COLUMN tema_cardapio SET DEFAULT 'claro';
