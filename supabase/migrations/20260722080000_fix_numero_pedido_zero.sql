-- ============================================================
-- MiseOn — Fix: pedidos criados com numero = 0
--
-- Causa raiz: a coluna public.pedidos.numero é INTEGER NOT NULL
-- DEFAULT 0. Todo INSERT que não informa numero explicitamente (hoje
-- TODOS os fluxos: CheckoutDrawer, PedidoMesaDrawer/QR e lib/pedidos
-- do PDV) recebe 0 pelo default — e a trigger fn_trg_numero_pedido só
-- atribuía número quando NEW.numero IS NULL, condição que nunca se
-- tornava verdadeira. Resultado: pedido criado com numero = 0.
--
-- Correção (opção segura, sem mexer no DEFAULT nem nos inserts
-- existentes): a trigger passa a tratar 0 como "não informado".
-- Mantido SECURITY DEFINER e adicionado search_path fixo (hardening,
-- mesmo padrão das demais triggers novas do projeto).
-- ============================================================

create or replace function public.fn_trg_numero_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = 0 THEN
    NEW.numero := public.fn_proximo_numero(NEW.loja_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ── Backfill: renumera pedidos presos no default 0 ──────────────
-- Cada pedido afetado recebe o próximo número da sequência da sua
-- loja (loja_sequencias). Genérico por loja, sem id fixo.
-- Segurança verificada: UPDATE só de `numero` não dispara baixa de
-- estoque, estorno, ledger nem histórico (fn_trg_status_pedido e
-- fn_trg_historico_pedido só agem em mudança de status); não há
-- constraint/índice único sobre (loja_id, numero).
UPDATE public.pedidos
SET numero = public.fn_proximo_numero(loja_id)
WHERE numero = 0;
