-- ============================================================
-- Hardening do E1 (fluxo passa-bastão) apontado pelo advisor:
--  - search_path mutável em SECURITY DEFINER é vetor de sequestro
--    de função (alguém cria um objeto com mesmo nome num schema
--    antes no search_path). Fixar search_path=public,pg_temp.
--  - RPCs staff-only (checam usuarios_loja por dentro) não devem
--    ficar expostas ao papel anon via PostgREST — defesa em
--    profundidade, mesmo a checagem interna já bloqueando.
--  - Funções de trigger não são chamáveis fora de contexto de
--    trigger, mas não precisam aparecer como RPC pública.
-- ============================================================

alter function fn_trg_promove_requer_cozinha() set search_path = public, pg_temp;
alter function fn_valida_transicao_pedido() set search_path = public, pg_temp;
alter function fn_valida_estacao_pedido() set search_path = public, pg_temp;
alter function fn_trg_historico_pedido() set search_path = public, pg_temp;
alter function fn_avancar_status_pedido(uuid, status_pedido, uuid) set search_path = public, pg_temp;
alter function fn_enviar_pedido_cozinha(uuid) set search_path = public, pg_temp;
alter function fn_metricas_cozinha(uuid, date, date) set search_path = public, pg_temp;

-- Funções de trigger: nunca devem ser chamadas via RPC direta.
revoke all on function fn_trg_promove_requer_cozinha() from public, anon, authenticated;
revoke all on function fn_valida_transicao_pedido() from public, anon, authenticated;
revoke all on function fn_valida_estacao_pedido() from public, anon, authenticated;
revoke all on function fn_trg_historico_pedido() from public, anon, authenticated;

-- RPCs staff-only: só authenticated (a checagem de usuarios_loja
-- continua sendo a autoridade real; isto é defesa em profundidade).
revoke all on function fn_avancar_status_pedido(uuid, status_pedido, uuid) from public, anon;
grant execute on function fn_avancar_status_pedido(uuid, status_pedido, uuid) to authenticated;

revoke all on function fn_enviar_pedido_cozinha(uuid) from public, anon;
grant execute on function fn_enviar_pedido_cozinha(uuid) to authenticated;

revoke all on function fn_metricas_cozinha(uuid, date, date) from public, anon;
grant execute on function fn_metricas_cozinha(uuid, date, date) to authenticated;
