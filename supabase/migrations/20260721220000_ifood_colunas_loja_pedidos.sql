-- Integração iFood: colunas de taxa e addon na loja (presentes no schema.sql mas ausentes nas migrations)
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ifood_addon_ativo BOOLEAN DEFAULT false;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ifood_taxa_pct  NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ifood_taxa_fixa NUMERIC(5,2) DEFAULT 0.99;

-- Integração iFood: colunas de rastreio do pedido (idempotente)
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ifood_order_id TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS valor_bruto_ifood NUMERIC(10,2);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS taxa_ifood_retida NUMERIC(10,2);
