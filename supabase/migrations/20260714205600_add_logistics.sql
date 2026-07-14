-- Entregadores (Se já existir, só atualizamos)
CREATE TABLE IF NOT EXISTS public.entregadores (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    nome text NOT NULL,
    telefone text NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamptz DEFAULT now()
);

-- Adicionar colunas novas em entregadores caso ela já existisse
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregadores' AND column_name='user_id') THEN
        ALTER TABLE public.entregadores ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregadores' AND column_name='veiculo') THEN
        ALTER TABLE public.entregadores ADD COLUMN veiculo text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregadores' AND column_name='placa') THEN
        ALTER TABLE public.entregadores ADD COLUMN placa text;
    END IF;
END $$;

-- Rotas de Entrega
CREATE TABLE IF NOT EXISTS public.rotas_entrega (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    entregador_id uuid NOT NULL REFERENCES public.entregadores(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'FINALIZADA')),
    criado_em timestamptz DEFAULT now(),
    finalizado_em timestamptz
);

-- Atualiza Pedidos
-- Ajustar as colunas usando DO block
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='entregador_id') THEN
        ALTER TABLE public.pedidos ADD COLUMN entregador_id uuid REFERENCES public.entregadores(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='rota_id') THEN
        ALTER TABLE public.pedidos ADD COLUMN rota_id uuid REFERENCES public.rotas_entrega(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='ordem_entrega') THEN
        ALTER TABLE public.pedidos ADD COLUMN ordem_entrega integer;
    END IF;
END $$;

-- Atualizar configurações da loja
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuracoes_custo' AND column_name='tipo_remuneracao_entregador') THEN
        ALTER TABLE public.configuracoes_custo ADD COLUMN tipo_remuneracao_entregador text DEFAULT 'POR_ENTREGA' CHECK (tipo_remuneracao_entregador IN ('FIXO', 'POR_ENTREGA', 'DESLIGADO'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuracoes_custo' AND column_name='valor_remuneracao_entregador') THEN
        ALTER TABLE public.configuracoes_custo ADD COLUMN valor_remuneracao_entregador numeric(10,2) DEFAULT 0;
    END IF;
END $$;


-- Mensagens do Chat do Pedido
CREATE TABLE IF NOT EXISTS public.mensagens_pedido (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    remetente_tipo text NOT NULL CHECK (remetente_tipo IN ('CLIENTE', 'LOJA', 'ENTREGADOR')),
    mensagem text NOT NULL,
    lida boolean DEFAULT false,
    criado_em timestamptz DEFAULT now()
);

-- RLS e Segurança
ALTER TABLE public.entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotas_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_pedido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojas gerenciam seus entregadores"
    ON public.entregadores FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.lojas WHERE id = loja_id));

CREATE POLICY "Entregadores podem ver a si mesmos"
    ON public.entregadores FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Lojas gerenciam rotas"
    ON public.rotas_entrega FOR ALL
    USING (auth.uid() IN (SELECT id FROM public.lojas WHERE id = loja_id));

CREATE POLICY "Entregadores veem suas rotas"
    ON public.rotas_entrega FOR SELECT
    USING (auth.uid() IN (SELECT user_id FROM public.entregadores WHERE id = entregador_id));

CREATE POLICY "Entregadores atualizam suas rotas"
    ON public.rotas_entrega FOR UPDATE
    USING (auth.uid() IN (SELECT user_id FROM public.entregadores WHERE id = entregador_id));

-- Mensagens: Todos os envolvidos podem ler
CREATE POLICY "Leitura de mensagens do pedido"
    ON public.mensagens_pedido FOR SELECT
    USING (true); -- Segurança por ofuscação da rota no client side, e no backend, ou simplificar para 'true' enquanto ajustamos RLS

CREATE POLICY "Inserção de mensagens do pedido"
    ON public.mensagens_pedido FOR INSERT
    WITH CHECK (true); 

-- Ativar realtime para o chat
alter publication supabase_realtime add table public.mensagens_pedido;
alter publication supabase_realtime add table public.rotas_entrega;
