-- ==========================================
-- SCHEMA: CHAT DE SUPORTE E FATURAS (MiseOn)
-- ==========================================

-- 1. TABELA DE FATURAS (Integração Efí Bank)
CREATE TABLE faturas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid REFERENCES lojas(id) ON DELETE CASCADE,
  valor decimal(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pendente', -- pendente, pago, cancelado
  txid text UNIQUE NOT NULL, -- ID do Pix no Efí Bank
  data_vencimento timestamptz NOT NULL,
  data_pagamento timestamptz,
  qr_code text,
  criado_em timestamptz DEFAULT now()
);

-- Segurança (RLS) para Faturas
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmins podem ver todas as faturas" ON faturas
  FOR ALL USING (auth.uid() IN (SELECT auth_id FROM plataforma_admins));

CREATE POLICY "Lojistas veem suas faturas" ON faturas
  FOR SELECT USING (auth.uid() IN (SELECT id FROM usuarios WHERE loja_id = faturas.loja_id));


-- 2. TABELAS DE CHAT (Suporte SuperAdmin <-> Loja)
CREATE TABLE suporte_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid REFERENCES lojas(id) ON DELETE CASCADE UNIQUE,
  status text DEFAULT 'aberto', -- aberto, fechado
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE suporte_mensagens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id uuid REFERENCES suporte_chats(id) ON DELETE CASCADE,
  remetente_id uuid REFERENCES auth.users(id), -- Quem enviou (Admin ou Lojista)
  texto text NOT NULL,
  lida boolean DEFAULT false,
  criado_em timestamptz DEFAULT now()
);

-- Segurança (RLS) para Chats
ALTER TABLE suporte_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE suporte_mensagens ENABLE ROW LEVEL SECURITY;

-- SuperAdmin tem acesso total aos chats e mensagens
CREATE POLICY "SuperAdmin acessa suporte_chats" ON suporte_chats FOR ALL
  USING (auth.uid() IN (SELECT auth_id FROM plataforma_admins));

CREATE POLICY "SuperAdmin acessa suporte_mensagens" ON suporte_mensagens FOR ALL
  USING (auth.uid() IN (SELECT auth_id FROM plataforma_admins));

-- Lojista acessa apenas o seu chat
CREATE POLICY "Lojista acessa seu chat" ON suporte_chats FOR SELECT
  USING (loja_id IN (SELECT loja_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "Lojista insere no seu chat" ON suporte_chats FOR INSERT
  WITH CHECK (loja_id IN (SELECT loja_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "Lojista acessa suas mensagens" ON suporte_mensagens FOR SELECT
  USING (chat_id IN (SELECT id FROM suporte_chats WHERE loja_id IN (SELECT loja_id FROM usuarios WHERE id = auth.uid())));

CREATE POLICY "Lojista envia mensagens" ON suporte_mensagens FOR INSERT
  WITH CHECK (chat_id IN (SELECT id FROM suporte_chats WHERE loja_id IN (SELECT loja_id FROM usuarios WHERE id = auth.uid())));

-- Habilitar Realtime para mensagens (MUITO IMPORTANTE PARA O CHAT FUNCIONAR AO VIVO)
alter publication supabase_realtime add table suporte_mensagens;
