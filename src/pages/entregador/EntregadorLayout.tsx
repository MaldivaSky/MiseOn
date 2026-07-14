import { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Bike, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface CtxEntregador {
  user: User;
  entregadorId: string;
  lojaId: string;
  nome: string;
}

export default function EntregadorLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<CtxEntregador | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuth(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAuth(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async (user: User | null) => {
    if (!user) {
      setCtx(null);
      setLoading(false);
      return;
    }

    // Verifica se esse usuário é um entregador cadastrado
    const { data, error } = await supabase
      .from('entregadores')
      .select('id, loja_id, nome, ativo')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data || !data.ativo) {
      // Loga out se não for entregador ativo
      await supabase.auth.signOut();
      setCtx(null);
      setLoading(false);
      return;
    }

    setCtx({
      user,
      entregadorId: data.id,
      lojaId: data.loja_id,
      nome: data.nome,
    });
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/entregador/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-orange-500" size={32} />
          <p className="text-sm font-semibold text-gray-400">Carregando MiseOn Logistics...</p>
        </div>
      </div>
    );
  }

  if (!ctx) {
    return <Navigate to="/entregador/login" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100 font-sans">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-800 bg-gray-900/80 px-4 py-3 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2 text-orange-500">
          <Bike size={22} className="shrink-0" />
          <span className="font-black text-lg tracking-tight">MiseOn <span className="text-white">Logistics</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-gray-300">{ctx.nome}</p>
            <p className="text-[10px] text-green-400">Online e operando</p>
          </div>
          <button onClick={handleLogout} className="rounded-full bg-gray-800 p-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto">
        <Outlet context={ctx} />
      </main>
    </div>
  );
}
