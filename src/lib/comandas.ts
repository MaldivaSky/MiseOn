import { supabase } from './supabase';

/**
 * Retorna o id da comanda ABERTA da mesa (reaproveitando entre várias
 * rodadas de pedido) ou cria uma nova se não houver nenhuma em aberto.
 * Usado tanto pelo cliente pedindo via QR quanto pelo garçom no PDV.
 */
export async function obterOuCriarComandaAberta(lojaId: string, mesaId: string): Promise<string> {
  const { data: existente } = await supabase
    .from('comandas')
    .select('id')
    .eq('mesa_id', mesaId)
    .eq('status', 'ABERTA')
    .order('aberta_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente?.id) return existente.id;

  const { data: loja } = await supabase.from('lojas').select('taxa_servico_padrao_pct').eq('id', lojaId).maybeSingle();
  const { data: nova, error } = await supabase
    .from('comandas')
    .insert({ loja_id: lojaId, mesa_id: mesaId, taxa_servico_pct: loja?.taxa_servico_padrao_pct ?? 0 })
    .select('id')
    .single();
  if (error || !nova) throw error ?? new Error('Falha ao abrir a comanda da mesa');
  return nova.id;
}
