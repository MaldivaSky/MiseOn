import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../types';

interface Loja {
  id: string; slug: string; nome: string; ativo: boolean;
  plano: string; status_assinatura: string; trial_termina_em: string | null; observacao_admin: string | null;
}
interface Metrica { loja_id: string; pedidos_30d: number; gmv_30d: number; ultimo_pedido: string | null }

export default function Tenants() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [metricas, setMetricas] = useState<Record<string, Metrica>>({});
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    const [{ data: l }, { data: m }] = await Promise.all([
      supabase.from('lojas').select('id, slug, nome, ativo, plano, status_assinatura, trial_termina_em, observacao_admin').order('nome'),
      supabase.functions.invoke('superadmin-metricas'),
    ]);
    setLojas((l as Loja[]) ?? []);
    const dict: Record<string, Metrica> = {};
    (m?.data?.metricas ?? []).forEach((x: Metrica) => { dict[x.loja_id] = x; });
    setMetricas(dict);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const registrar = async (loja_id: string, acao: string, detalhes: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('auditoria').insert({ loja_id, ator: user?.id, acao, detalhes });
  };

  const toggleAtivo = async (l: Loja) => {
    await supabase.from('lojas').update({ ativo: !l.ativo }).eq('id', l.id);
    await registrar(l.id, l.ativo ? 'loja_inativada' : 'loja_ativada', {});
    carregar();
  };
  const mudarPlano = async (l: Loja, plano: string) => {
    await supabase.from('lojas').update({ plano }).eq('id', l.id);
    await registrar(l.id, 'plano_alterado', { plano });
    carregar();
  };
  const mudarStatus = async (l: Loja, status_assinatura: string) => {
    await supabase.from('lojas').update({ status_assinatura }).eq('id', l.id);
    await registrar(l.id, 'status_assinatura_alterado', { status_assinatura });
    carregar();
  };
  const salvarNota = async (l: Loja, observacao_admin: string) => {
    if (observacao_admin === (l.observacao_admin ?? '')) return;
    await supabase.from('lojas').update({ observacao_admin: observacao_admin || null }).eq('id', l.id);
    carregar();
  };

  const visiveis = lojas.filter((l) => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()) || l.slug.includes(busca.toLowerCase()));

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Tenants ({lojas.length})</h2>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou slug…"
        className="mb-3 w-full rounded-xl border p-2.5 text-sm" />

      <div className="space-y-2">
        {visiveis.map((l) => {
          const m = metricas[l.id];
          return (
            <div key={l.id} className={`rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm ${!l.ativo ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{l.nome}</p>
                  <p className="text-xs text-gray-400">/{l.slug}</p>
                </div>
                <button onClick={() => toggleAtivo(l)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${l.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 dark:text-gray-400'}`}>
                  {l.ativo ? 'Ativa' : 'Inativa'}
                </button>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Pedidos (30d): <b className="text-gray-700">{m?.pedidos_30d ?? 0}</b></span>
                <span>GMV (30d): <b className="text-gray-700">{fmt(m?.gmv_30d ?? 0)}</b></span>
                <span>Último pedido: <b className="text-gray-700">{m?.ultimo_pedido ? new Date(m.ultimo_pedido).toLocaleDateString('pt-BR') : '—'}</b></span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <select value={l.plano} onChange={(e) => mudarPlano(l, e.target.value)} className="rounded-lg border p-2 text-xs">
                  {['trial', 'basico', 'pro'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={l.status_assinatura} onChange={(e) => mudarStatus(l, e.target.value)} className="rounded-lg border p-2 text-xs">
                  {['trial', 'ativa', 'atrasada', 'cancelada'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <input defaultValue={l.observacao_admin ?? ''} onBlur={(e) => salvarNota(l, e.target.value)}
                placeholder="Nota interna (só o superadmin vê)"
                className="mt-2 w-full rounded-lg border p-2 text-xs" />
            </div>
          );
        })}
        {visiveis.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhuma loja encontrada.</p>}
      </div>
    </div>
  );
}
