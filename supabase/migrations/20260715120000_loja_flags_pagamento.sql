-- Flags do tenant: aceita pagamento antecipado (online/Efí) e/ou na entrega.
-- O checkout do cliente filtra os métodos conforme o que a loja aceita.
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS aceita_online  boolean DEFAULT true;  -- Pix/Crédito via Efí (pague agora)
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS aceita_entrega boolean DEFAULT true;  -- Dinheiro/maquininha (pague na entrega)
