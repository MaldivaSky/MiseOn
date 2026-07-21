-- Migration: email_schema
-- Description: Tabelas para log de e-mails transacionais e preferências

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template_type text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL,
  message_id text,
  error_message text,
  metadata jsonb,
  sent_at timestamp with time zone DEFAULT now(),
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  marketing_allowed boolean DEFAULT false,
  transactional_allowed boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS para email_preferences
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias preferências"
  ON public.email_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias preferências"
  ON public.email_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias preferências"
  ON public.email_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);
