ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS is_preparo boolean DEFAULT false;
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS rendimento_porcoes integer;
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS pessoas_servidas integer;

CREATE TABLE IF NOT EXISTS public.fichas_preparos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
    preparo_id uuid REFERENCES public.insumos(id) ON DELETE CASCADE,
    insumo_id uuid REFERENCES public.insumos(id) ON DELETE CASCADE,
    quantidade numeric NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
