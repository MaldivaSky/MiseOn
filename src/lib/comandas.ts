import { supabase } from './supabase';

/**
 * Retorna o id da comanda ABERTA da mesa (reaproveitando entre várias
 * rodadas de pedido) ou cria uma nova se não houver nenhuma em aberto.
 * Usado tanto pelo cliente pedindo via QR quanto pelo garçom no PDV.
 *
 * Passa pelo RPC SECURITY DEFINER fn_comanda_aberta_mesa: a tabela
 * `comandas` não tem mais SELECT/INSERT públicos (vazamento entre lojas —
 * ver migration 20260722070000_seguranca_comandas_mesas_publicas). O RPC
 * valida que a mesa pertence à loja e está ativa antes de abrir/reusar.
 */
export async function obterOuCriarComandaAberta(lojaId: string, mesaId: string): Promise<string> {
  const { data, error } = await supabase.rpc('fn_comanda_aberta_mesa', {
    p_loja_id: lojaId,
    p_mesa_id: mesaId,
  });
  if (error || !data) throw error ?? new Error('Falha ao abrir a comanda da mesa');
  return data as string;
}
