-- ============================================================================
-- Setor físico de armazenamento do insumo (geladeira / armário / dispensa)
-- ============================================================================
-- O Rastreio 3D organiza o estoque pelo lugar onde o item fica guardado.
-- Até aqui o setor era deduzido por heurística (categoria + palavras do nome);
-- esta coluna torna o setor um dado OFICIAL do cadastro:
--
--   NULL  → derivação automática (comportamento atual, nada quebra);
--   valor → o usuário mandou: o Rastreio 3D e o badge do Estoque obedecem.
--
-- CHECK defensivo: só os três ids válidos entram — qualquer outro texto é
-- erro de aplicação e deve falhar na escrita, não poluir o relatório.
-- ============================================================================

ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS setor TEXT;

ALTER TABLE public.insumos
  DROP CONSTRAINT IF EXISTS insumos_setor_check;

ALTER TABLE public.insumos
  ADD CONSTRAINT insumos_setor_check
  CHECK (setor IS NULL OR setor IN ('geladeira', 'armario', 'dispensa'));

COMMENT ON COLUMN public.insumos.setor IS
  'Setor físico de armazenamento (geladeira/armario/dispensa). NULL = derivação automática por categoria/nome.';
