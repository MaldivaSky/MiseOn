-- ============================================================================
-- MÓDULO FISCAL COMPLETO (Focus NFe API v2 + Emissão NFe/NFCe + Importação XML)
-- ============================================================================

-- 1. Tabela de Configurações Fiscais por Loja (Tenant)
CREATE TABLE IF NOT EXISTS public.configuracoes_fiscais (
  loja_id UUID PRIMARY KEY REFERENCES public.lojas(id) ON DELETE CASCADE,
  cnpj TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  cnae_principal TEXT,
  regime_tributario TEXT DEFAULT 'Simples Nacional',
  crt INTEGER DEFAULT 1 CHECK (crt IN (1, 2, 3)), -- 1: Simples Nacional, 2: Simples Excesso, 3: Regime Normal (Lucro Presumido/Real)
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf VARCHAR(2),
  cep TEXT,
  codigo_ibge TEXT,
  telefone TEXT,
  email TEXT,
  nfe_ambiente TEXT DEFAULT 'homologacao' CHECK (nfe_ambiente IN ('homologacao', 'producao')),
  habilita_nfe BOOLEAN DEFAULT true,
  habilita_nfce BOOLEAN DEFAULT true,
  id_csc TEXT,
  csc TEXT,
  certificado_nome TEXT,
  certificado_validade TIMESTAMPTZ,
  certificado_status TEXT DEFAULT 'pendente' CHECK (certificado_status IN ('pendente', 'valido', 'expirado', 'erro')),
  certificado_encrypted TEXT, -- Base64 do .pfx criptografado em AES-256-GCM
  senha_encrypted TEXT,       -- Senha do .pfx criptografada em AES-256-GCM
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Notas Fiscais Emitidas e Importadas
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  tipo TEXT DEFAULT 'NFCE' CHECK (tipo IN ('NFE', 'NFCE', 'ENTRADA_FORNECEDOR')),
  ambiente TEXT DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  ref TEXT UNIQUE,
  status TEXT DEFAULT 'PROCESSANDO' CHECK (status IN ('RASCUNHO', 'PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'ERRO', 'IMPORTADA')),
  chave_nfe TEXT,
  numero TEXT,
  serie TEXT DEFAULT '1',
  xml_url TEXT,
  danfe_url TEXT,
  qrcode_url TEXT,
  protocolo TEXT,
  mensagem_sefaz TEXT,
  erros JSONB,
  payload_envio JSONB,
  retorno_focus JSONB,
  valor_total NUMERIC(10,2) DEFAULT 0.00,
  emitente_cnpj TEXT,
  emitente_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices para Otimização de Consultas Multi-tenant
CREATE INDEX IF NOT EXISTS idx_configuracoes_fiscais_loja ON public.configuracoes_fiscais (loja_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_loja_created ON public.notas_fiscais (loja_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_loja_status ON public.notas_fiscais (loja_id, status);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_chave ON public.notas_fiscais (chave_nfe);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_pedido ON public.notas_fiscais (pedido_id);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.configuracoes_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para configuracoes_fiscais
DROP POLICY IF EXISTS "Usuários da loja podem visualizar suas configuracoes fiscais" ON public.configuracoes_fiscais;
CREATE POLICY "Usuários da loja podem visualizar suas configuracoes fiscais"
  ON public.configuracoes_fiscais FOR SELECT
  USING (
    loja_id IN (
      SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins da loja podem gerenciar configuracoes fiscais" ON public.configuracoes_fiscais;
CREATE POLICY "Admins da loja podem gerenciar configuracoes fiscais"
  ON public.configuracoes_fiscais FOR ALL
  USING (
    loja_id IN (
      SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    loja_id IN (
      SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()
    )
  );

-- 6. Políticas RLS para notas_fiscais
DROP POLICY IF EXISTS "Usuários da loja podem visualizar suas notas fiscais" ON public.notas_fiscais;
CREATE POLICY "Usuários da loja podem visualizar suas notas fiscais"
  ON public.notas_fiscais FOR SELECT
  USING (
    loja_id IN (
      SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuários da loja podem inserir/atualizar suas notas fiscais" ON public.notas_fiscais;
CREATE POLICY "Usuários da loja podem inserir/atualizar suas notas fiscais"
  ON public.notas_fiscais FOR ALL
  USING (
    loja_id IN (
      SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    loja_id IN (
      SELECT loja_id FROM public.usuarios_loja WHERE user_id = auth.uid()
    )
  );

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_configuracoes_fiscais_updated_at ON public.configuracoes_fiscais;
CREATE TRIGGER set_configuracoes_fiscais_updated_at
  BEFORE UPDATE ON public.configuracoes_fiscais
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS set_notas_fiscais_updated_at ON public.notas_fiscais;
CREATE TRIGGER set_notas_fiscais_updated_at
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_column();
