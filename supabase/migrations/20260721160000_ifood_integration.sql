-- Integração iFood: Colunas em lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ifood_merchant_id text;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ifood_authorization_code text;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ifood_refresh_token text;

-- Integração iFood: Colunas em produtos para o de-para (Mapeamento)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS pdv_code text;

-- Atualizar interface de segurança (opcional caso precisemos depois, por enquanto não é estritamente necessário um RLS especial já que são colunas da loja, visíveis para o tenant).
