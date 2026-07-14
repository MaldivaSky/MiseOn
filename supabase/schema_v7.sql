-- schema_v7.sql
-- Atualização para o modelo SaaS (MiseOn) e Integração Efí Bank

-- 1. Adicionando campos de integração de pagamento e status da assinatura na tabela lojas
ALTER TABLE lojas 
  ADD COLUMN IF NOT EXISTS efi_payee_code text,
  ADD COLUMN IF NOT EXISTS status_assinatura text DEFAULT 'ATIVO',
  ADD COLUMN IF NOT EXISTS vencimento_assinatura timestamp with time zone;

-- 2. Tabela de faturas do SaaS (O tenant paga para a Plataforma)
CREATE TABLE IF NOT EXISTS faturas_saas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id uuid REFERENCES lojas(id) ON DELETE CASCADE,
  valor numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, PAGO, CANCELADO, VENCIDO
  data_vencimento timestamp with time zone NOT NULL,
  data_pagamento timestamp with time zone,
  link_pagamento text,
  criado_em timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE faturas_saas ENABLE ROW LEVEL SECURITY;

-- Políticas para faturas_saas
CREATE POLICY "Lojistas podem ver suas próprias faturas" ON faturas_saas
  FOR SELECT USING (
    loja_id IN (
      SELECT id FROM lojas WHERE id = loja_id AND auth.uid() IN (
        SELECT user_id FROM membros_loja WHERE loja_id = faturas_saas.loja_id
      )
    )
  );

CREATE POLICY "SuperAdmins podem ver e editar todas as faturas" ON faturas_saas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid())
  );
