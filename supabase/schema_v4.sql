-- ============================================================
-- MiseOn — schema_v4: captação de lead (cadastre sua loja)
-- Rodar DEPOIS de schema.sql + schema_v2.sql + schema_v3.sql.
-- ============================================================

CREATE TABLE leads_cadastro (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_responsavel TEXT NOT NULL,
  nome_loja        TEXT NOT NULL,
  tipo_negocio     TEXT,                          -- lanchonete | restaurante | pizzaria | doceria | mercado | outro
  cidade           TEXT,
  whatsapp         TEXT NOT NULL,
  email            TEXT,
  observacao       TEXT,
  status           TEXT NOT NULL DEFAULT 'novo',  -- novo | contatado | convertido | descartado
  criado_em        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leads_cadastro ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode se cadastrar (form público em /cadastre-se)
CREATE POLICY pub_cria_lead ON leads_cadastro FOR INSERT WITH CHECK (true);

-- Só o superadmin lê/gerencia os leads
CREATE POLICY superadmin_leads ON leads_cadastro FOR ALL USING (fn_sou_superadmin());
