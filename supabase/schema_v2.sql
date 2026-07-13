-- ============================================================
-- MiseOn — schema_v2: rastreio de entrega + painel SuperAdmin
-- Rodar DEPOIS de schema.sql (+ seed_natureba.sql se for local).
-- Mudanças aditivas — não re-executa nem substitui o schema.sql.
-- ============================================================

-- ── Rastreio de entrega em tempo real ────────────────────────
ALTER TABLE entregas ADD COLUMN lat NUMERIC(10,7);
ALTER TABLE entregas ADD COLUMN lng NUMERIC(10,7);
ALTER TABLE entregas ADD COLUMN localizacao_atualizada_em TIMESTAMPTZ;

-- cliente acompanha a entrega do próprio pedido (mesmo padrão do pub_le_pedido: uuid como token)
CREATE POLICY pub_le_entrega ON entregas FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE entregas;

-- ── SuperAdmin (dono do SaaS) — tenants, plano/assinatura, auditoria ──
ALTER TABLE lojas ADD COLUMN plano TEXT NOT NULL DEFAULT 'trial';                -- trial | basico | pro
ALTER TABLE lojas ADD COLUMN status_assinatura TEXT NOT NULL DEFAULT 'trial';    -- trial | ativa | atrasada | cancelada
ALTER TABLE lojas ADD COLUMN trial_termina_em TIMESTAMPTZ DEFAULT now() + interval '14 days';
ALTER TABLE lojas ADD COLUMN observacao_admin TEXT;                              -- nota interna do dono do SaaS

CREATE TABLE plataforma_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE auditoria (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id    UUID REFERENCES lojas(id) ON DELETE SET NULL,  -- null = ação de plataforma
  ator       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao       TEXT NOT NULL,
  detalhes   JSONB,
  criado_em  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plataforma_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria         ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fn_sou_superadmin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM plataforma_admins WHERE user_id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER;

-- policy adicional em `lojas` (permissiva, soma com adm_lojas já existente — não conflita)
CREATE POLICY superadmin_lojas     ON lojas             FOR ALL    USING (fn_sou_superadmin());
CREATE POLICY superadmin_auditoria ON auditoria         FOR SELECT USING (fn_sou_superadmin());
CREATE POLICY superadmin_admins    ON plataforma_admins FOR SELECT USING (fn_sou_superadmin());

-- Superadmin também pode inserir auditoria e gerenciar plataforma_admins via client
-- (a criação de lojas/convites em si roda via Edge Function com service role, que ignora RLS)
CREATE POLICY superadmin_ins_auditoria ON auditoria FOR INSERT WITH CHECK (fn_sou_superadmin());

-- Métricas cross-tenant (pedidos/GMV por loja) NÃO ganham policy aqui de propósito —
-- são servidas por Edge Function com service role (supabase/functions/superadmin-metricas),
-- para não abrir a operação de cada restaurante para o client do superadmin.
