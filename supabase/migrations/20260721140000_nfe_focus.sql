-- ============================================================================
-- NF-e / NFC-e: Estrutura para integração com a Focus NFe
-- Adiciona campos de rastreamento fiscal aos pedidos.
-- ============================================================================

ALTER TABLE public.pedidos 
  ADD COLUMN IF NOT EXISTS nfe_status TEXT DEFAULT 'NAO_EMITIDA' CHECK (nfe_status IN ('NAO_EMITIDA', 'PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'ERRO')),
  ADD COLUMN IF NOT EXISTS nfe_chave TEXT,
  ADD COLUMN IF NOT EXISTS nfe_numero TEXT,
  ADD COLUMN IF NOT EXISTS nfe_url TEXT,
  ADD COLUMN IF NOT EXISTS nfe_erros JSONB;

-- Informações fiscais na loja (simplificado para o MVP)
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS nfe_ambiente TEXT DEFAULT 'homologacao' CHECK (nfe_ambiente IN ('homologacao', 'producao')),
  ADD COLUMN IF NOT EXISTS nfe_emitir_auto BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfe_token_focus TEXT; -- Não usaremos no front, apenas se quiser salvar no DB ao invés de Env. Mas vamos usar Env Vars por segurança.

-- O índice ajuda a filtrar notas com erro ou autorizadas no painel
CREATE INDEX IF NOT EXISTS idx_pedidos_nfe_status ON public.pedidos (loja_id, nfe_status);
