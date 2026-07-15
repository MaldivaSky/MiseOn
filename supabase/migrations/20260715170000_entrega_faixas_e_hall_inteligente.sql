-- ============================================================
-- Entrega inteligente: cobertura por raio + faixas configuráveis
-- ============================================================

-- 1) Novo modo híbrido:
--    DISTANCIA = cálculo contínuo (base + km)
--    BAIRRO    = tabela de bairros
--    HIBRIDO   = faixas por distância com fallback em bairros/padrão
ALTER TABLE public.lojas
  ALTER COLUMN entrega_modo SET DEFAULT 'HIBRIDO';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_lojas_entrega_modo'
      AND conrelid = 'public.lojas'::regclass
  ) THEN
    ALTER TABLE public.lojas DROP CONSTRAINT chk_lojas_entrega_modo;
  END IF;

  ALTER TABLE public.lojas
    ADD CONSTRAINT chk_lojas_entrega_modo
    CHECK (entrega_modo IN ('BAIRRO','DISTANCIA','HIBRIDO'));
END $$;

-- 2) Faixas configuráveis por distância
CREATE TABLE IF NOT EXISTS public.faixas_entrega (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id       UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome          TEXT,
  km_ate        NUMERIC(6,2) NOT NULL,
  taxa_fixa     NUMERIC(10,2),
  taxa_por_km   NUMERIC(10,2),
  pedido_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
  ordem         SMALLINT NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_faixas_entrega_taxa
    CHECK (taxa_fixa IS NOT NULL OR taxa_por_km IS NOT NULL),
  CONSTRAINT chk_faixas_entrega_km
    CHECK (km_ate > 0),
  CONSTRAINT chk_faixas_entrega_pedido_minimo
    CHECK (pedido_minimo >= 0)
);

CREATE INDEX IF NOT EXISTS idx_faixas_entrega_loja_ordem
  ON public.faixas_entrega (loja_id, ativo, ordem, km_ate);

ALTER TABLE public.faixas_entrega ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'faixas_entrega'
      AND policyname = 'pub_faixas_entrega'
  ) THEN
    CREATE POLICY pub_faixas_entrega
      ON public.faixas_entrega
      FOR SELECT
      USING (ativo);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'faixas_entrega'
      AND policyname = 'adm_faixas_entrega'
  ) THEN
    CREATE POLICY adm_faixas_entrega
      ON public.faixas_entrega
      FOR ALL
      USING (fn_meu_acesso(loja_id));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_faixas_entrega_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_faixas_entrega_updated_at ON public.faixas_entrega;
CREATE TRIGGER trg_faixas_entrega_updated_at
BEFORE UPDATE ON public.faixas_entrega
FOR EACH ROW EXECUTE FUNCTION public.set_faixas_entrega_updated_at();

-- 3) Exemplo para a loja demo
INSERT INTO public.faixas_entrega (loja_id, nome, km_ate, taxa_fixa, taxa_por_km, ordem)
SELECT id, 'Até 3 km', 3.00, 6.90, NULL, 1
FROM public.lojas
WHERE slug = 'lanchepaulista'
ON CONFLICT DO NOTHING;

INSERT INTO public.faixas_entrega (loja_id, nome, km_ate, taxa_fixa, taxa_por_km, ordem)
SELECT id, 'Até 5 km', 5.00, 8.90, NULL, 2
FROM public.lojas
WHERE slug = 'lanchepaulista'
ON CONFLICT DO NOTHING;

INSERT INTO public.faixas_entrega (loja_id, nome, km_ate, taxa_fixa, taxa_por_km, ordem)
SELECT id, 'Até 8 km', 8.00, NULL, 1.70, 3
FROM public.lojas
WHERE slug = 'lanchepaulista'
ON CONFLICT DO NOTHING;
