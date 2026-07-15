-- Correção das políticas de RLS de Logística.
-- Bug: as policies "Lojas gerenciam ..." comparavam auth.uid() (UUID do usuário Auth)
-- com lojas.id (UUID da loja) — condição sempre falsa. Isso impedia o admin de
-- cadastrar/gerenciar entregadores e de despachar rotas.
-- Correção: usar fn_meu_acesso(loja_id), o mesmo padrão do restante do schema.

-- ── entregadores ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Lojas gerenciam seus entregadores" ON public.entregadores;
CREATE POLICY "Lojas gerenciam seus entregadores"
    ON public.entregadores FOR ALL
    USING (fn_meu_acesso(loja_id))
    WITH CHECK (fn_meu_acesso(loja_id));
-- ── rotas_entrega ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Lojas gerenciam rotas" ON public.rotas_entrega;
CREATE POLICY "Lojas gerenciam rotas"
    ON public.rotas_entrega FOR ALL
    USING (fn_meu_acesso(loja_id))
    WITH CHECK (fn_meu_acesso(loja_id));
