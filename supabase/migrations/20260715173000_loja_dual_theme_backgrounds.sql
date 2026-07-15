ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS cor_fundo_claro text,
  ADD COLUMN IF NOT EXISTS cor_fundo_escuro text;

UPDATE public.lojas
SET
  cor_fundo_claro = COALESCE(
    cor_fundo_claro,
    CASE
      WHEN cor_texto IS NULL THEN '#ffffff'
      WHEN lower(cor_texto) IN ('#111827', '#0f172a', '#171717', '#000000', '#334155', '#450a0a', '#064e3b', '#2e1065', '#1f2937', '#172033', '#102a43', '#1f1235')
        THEN '#ffffff'
      ELSE cor_texto
    END
  ),
  cor_fundo_escuro = COALESCE(
    cor_fundo_escuro,
    CASE
      WHEN cor_texto IS NULL THEN '#111827'
      WHEN lower(cor_texto) IN ('#111827', '#0f172a', '#171717', '#000000', '#334155', '#450a0a', '#064e3b', '#2e1065', '#1f2937', '#172033', '#102a43', '#1f1235')
        THEN cor_texto
      ELSE '#111827'
    END
  )
WHERE cor_fundo_claro IS NULL OR cor_fundo_escuro IS NULL;

ALTER TABLE public.lojas
  ALTER COLUMN cor_fundo_claro SET DEFAULT '#ffffff',
  ALTER COLUMN cor_fundo_escuro SET DEFAULT '#111827';
