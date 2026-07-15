-- ============================================================
-- Checkout robusto: endereço estruturado no pedido + entrega por distância
-- ============================================================

-- 1) Endereço estruturado no pedido (o checkout antigo tentava gravar
--    cep/logradouro/etc que NÃO existiam → todo pedido de delivery falhava).
--    numero_endereco é separado de `numero` (que é o nº sequencial do pedido).
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cep             text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS logradouro      text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS numero_endereco text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS complemento     text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cidade          text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS uf              text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS distancia_km    numeric(6,2);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS lat             numeric(10,7);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS lng             numeric(10,7);

-- 2) Loja: origem geográfica + configuração de taxa por distância.
--    Modelo: taxa = base + (km * por_km), bloqueando acima do raio.
--    entrega_modo controla a estratégia; a lógica no cliente tem fallback
--    em cascata: DISTANCIA (geocoding) → BAIRRO (taxas_entrega) → taxa_padrao.
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS lat                  numeric(10,7);
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS lng                  numeric(10,7);
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS entrega_modo         text DEFAULT 'BAIRRO';
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS entrega_taxa_base    numeric(10,2) DEFAULT 0;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS entrega_taxa_km      numeric(10,2) DEFAULT 0;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS entrega_raio_km      numeric(6,2);
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS entrega_taxa_padrao  numeric(10,2) DEFAULT 0;

-- CHECK do modo (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lojas_entrega_modo') THEN
    ALTER TABLE public.lojas ADD CONSTRAINT chk_lojas_entrega_modo
      CHECK (entrega_modo IN ('BAIRRO','DISTANCIA'));
  END IF;
END $$;

-- 3) Configura o tenant de provas Lanche do Paulista para entrega por distância
--    (origem = Av. Paulista, 1500 aprox.; base R$5 + R$1,50/km; raio 8km; padrão R$12).
UPDATE public.lojas SET
  lat = -23.5615, lng = -46.6559,
  entrega_modo = 'DISTANCIA',
  entrega_taxa_base = 5.00,
  entrega_taxa_km = 1.50,
  entrega_raio_km = 8.0,
  entrega_taxa_padrao = 12.00
WHERE slug = 'lanchepaulista';
