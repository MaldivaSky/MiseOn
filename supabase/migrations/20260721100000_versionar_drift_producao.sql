-- ============================================================================
-- Versionamento do drift de produção (capturado via `supabase db dump --linked`)
-- Objetos que existiam em produção mas não estavam em nenhuma migration.
-- Tudo é idempotente (IF NOT EXISTS / CREATE OR REPLACE) pois o banco remoto
-- já contém estes objetos.
-- ============================================================================

-- plataforma_admins + fn_sou_superadmin --------------------------------------

CREATE TABLE IF NOT EXISTS public.plataforma_admins (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.plataforma_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_sou_superadmin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM plataforma_admins WHERE user_id = auth.uid());
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'plataforma_admins' AND policyname = 'superadmin_admins'
  ) THEN
    CREATE POLICY superadmin_admins ON public.plataforma_admins
      FOR SELECT USING (public.fn_sou_superadmin());
  END IF;
END $$;

-- clientes.user_id / pedidos.cliente_user_id ---------------------------------

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clientes_user_id_fkey'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cliente_user_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_cliente_user_id_fkey'
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_cliente_user_id_fkey
      FOREIGN KEY (cliente_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- historico_pedidos -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.historico_pedidos (
  id              uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  pedido_id       uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  status          public.status_pedido NOT NULL,
  criado_em       timestamptz DEFAULT now(),
  operador_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_historico_pedidos
  ON public.historico_pedidos USING btree (pedido_id, criado_em);

ALTER TABLE public.historico_pedidos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'historico_pedidos' AND policyname = 'adm_historico'
  ) THEN
    CREATE POLICY adm_historico ON public.historico_pedidos
      USING (public.fn_meu_acesso((
        SELECT p.loja_id FROM public.pedidos p
        WHERE p.id = historico_pedidos.pedido_id)));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'historico_pedidos' AND policyname = 'cliente_historico'
  ) THEN
    CREATE POLICY cliente_historico ON public.historico_pedidos
      FOR SELECT USING (pedido_id IN (
        SELECT p.id FROM public.pedidos p
        WHERE p.cliente_user_id = auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_trg_historico_pedido() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_operador uuid;
begin
  if TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status) then
    v_operador := nullif(current_setting('miseon.operador_atual', true), '')::uuid;
    insert into historico_pedidos (pedido_id, status, operador_user_id) values (NEW.id, NEW.status, v_operador);
  end if;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS trg_historico_pedido ON public.pedidos;
CREATE TRIGGER trg_historico_pedido
  AFTER INSERT OR UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_historico_pedido();

-- fn_produtos_com_estoque (usada pelo Cardápio para esgotar itens sem estoque)

CREATE OR REPLACE FUNCTION public.fn_produtos_com_estoque(p_loja_id uuid)
  RETURNS TABLE(produto_id uuid, tem_estoque boolean)
  LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id,
    CASE
      WHEN NOT p.controla_estoque THEN true
      WHEN NOT EXISTS (SELECT 1 FROM fichas_tecnicas WHERE produto_id = p.id) THEN true
      ELSE NOT EXISTS (
        SELECT 1 FROM fichas_tecnicas ft
        JOIN insumos i ON i.id = ft.insumo_id
        WHERE ft.produto_id = p.id AND i.quantidade_atual < ft.quantidade_consumida
      )
    END AS tem_estoque
  FROM produtos p
  WHERE p.loja_id = p_loja_id;
$$;

GRANT EXECUTE ON FUNCTION public.fn_produtos_com_estoque(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_sou_superadmin() TO anon, authenticated, service_role;
