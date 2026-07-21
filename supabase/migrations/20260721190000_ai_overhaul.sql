-- ============================================================================
-- AI Overhaul: Configuração Global, Handoff e Otimização
-- ============================================================================

-- 1) Configuração na loja
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS chat_ia_ativo BOOLEAN DEFAULT false;

-- 2) Configuração na conversa (Handoff)
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS ia_ativa BOOLEAN DEFAULT true;

-- 3) Trigger de Handoff (Transbordo)
-- Quando um atendente humano (remetente = LOJA) mandar mensagem, a IA é calada imediatamente nesta conversa.
CREATE OR REPLACE FUNCTION public.fn_chat_handoff() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.remetente_tipo = 'LOJA' THEN
    UPDATE public.chat_conversations SET ia_ativa = false WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_handoff ON public.chat_messages;
CREATE TRIGGER trg_chat_handoff
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_chat_handoff();
