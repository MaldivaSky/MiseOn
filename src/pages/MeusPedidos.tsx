import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, LogIn, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Pedido, StatusPedido, fmt } from '../types';

const STATUS_LABEL: Record<StatusPedido, string> = {
  NOVO: 'Recebido', ACEITO: 'Aceito', PREPARANDO: 'Preparando',
  PRONTO: 'Pronto', EM_ROTA: 'Em rota', FINALIZADO: 'Entregue', CANCELADO: 'Cancelado',
};
const STATUS_COR: Record<StatusPedido, string> = {
  NOVO: 'bg-amber-100 text-amber-700', ACEITO: 'bg-blue-100 text-blue-700', PREPARANDO: 'bg-indigo-100 text-indigo-700',
  PRONTO: 'bg-purple-100 text-purple-700', EM_ROTA: 'bg-cyan-100 text-cyan-700',
  FINALIZADO: 'bg-green-100 text-green-700', CANCELADO: 'bg-red-100 text-red-600',
};

export default function MeusPedidos() {
  const { slug } = useParams();
  const [logado, setLogado] = useState<boolean | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLogado(false); setCarregando(false); return; }
      setLogado(true);

      const { data: loja } = await supabase.from('lojas').select('id').eq('slug', slug).single();
      if (!loja) { setCarregando(false); return; }

      const { data } = await supabase
        .from('pedidos')
        .select('*, itens_pedido(*)')
        .eq('loja_id', loja.id)
        .eq('cliente_user_id', user.id)
        .order('criado_em', { ascending: false });
      setPedidos((data as Pedido[]) ?? []);
      setCarregando(false);
    })();
  }, [slug]);

  const entrar = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-gray-50 pb-10">
      <header className="flex items-center gap-2 bg-white p-4 shadow-sm">
        <Link to={`/${slug}`} className="text-gray-400"><ChevronLeft size={20} /></Link>
        <h1 className="font-bold">Meus pedidos</h1>
      </header>

      <div className="p-4">
        {logado === false && (
          <div className="mt-6 rounded-2xl border border-dashed p-6 text-center">
            <p className="text-sm font-semibold">Entre pra ver seu histórico</p>
            <button onClick={entrar} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 py-3 text-sm font-semibold text-white">
              <LogIn size={16} /> Entrar com Google
            </button>
          </div>
        )}

        {carregando && logado !== false && <p className="py-10 text-center text-sm text-gray-400">Carregando…</p>}

        {logado && !carregando && (
          <div className="space-y-2">
            {pedidos.map((p) => (
              <Link key={p.id} to={`/pedido/${p.id}`} className="card-hover flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{p.numero}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(p.criado_em).toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-gray-500">{p.itens_pedido?.length ?? 0} item(ns)</p>
                </div>
                <span className="font-bold">{fmt(Number(p.valor_total))}</span>
              </Link>
            ))}
            {pedidos.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">
                <Package size={28} className="mx-auto mb-2 text-gray-300" />
                Você ainda não fez nenhum pedido aqui.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
