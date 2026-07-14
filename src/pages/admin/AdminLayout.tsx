import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ClipboardList, Boxes, Bike, Store, LogOut, UtensilsCrossed, MoreHorizontal, X, TrendingUp, Megaphone, Users, History, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ThemeToggle from '../../components/ThemeToggle';

export interface CtxLoja {
  lojaId: string;
  lojaNome: string;
  lojaSlug: string;
  papel: string; // admin | operador | entregador
}

export default function AdminLayout() {
  const nav = useNavigate();
  const [ctx, setCtx] = useState<CtxLoja | null>(null);
  const [semLoja, setSemLoja] = useState(false);
  const [maisAberto, setMaisAberto] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return nav('/admin/login');
      const { data } = await supabase
        .from('usuarios_loja')
        .select('loja_id, papel, lojas(nome, cor_primaria, cor_secundaria, slug)')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (!data) { setSemLoja(true); return; }
      const papel = (data as any).papel ?? 'admin';
      const lojaInfo = (data as any).lojas;
      setCtx({ lojaId: data.loja_id, lojaNome: lojaInfo?.nome ?? 'Minha loja', lojaSlug: lojaInfo?.slug ?? '', papel });
      if (lojaInfo?.cor_primaria) document.documentElement.style.setProperty('--cor-primaria', lojaInfo.cor_primaria);
      if (lojaInfo?.cor_secundaria) document.documentElement.style.setProperty('--cor-secundaria', lojaInfo.cor_secundaria);
      // entregador cai direto na fila de entregas
      if (papel === 'entregador' && !location.pathname.includes('/entregas')) nav('/admin/entregas');
    })();
  }, []);

  const sair = async () => { await supabase.auth.signOut(); nav('/admin/login'); };

  if (semLoja) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-semibold">Sua conta ainda não está vinculada a nenhuma loja.</p>
        <p className="text-sm text-gray-500">Peça para o administrador da loja te convidar pela tela de Equipe, usando este mesmo e-mail.</p>
        <button onClick={sair} className="mt-3 rounded-xl bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white">Sair</button>
      </div>
    );
  }

  if (!ctx) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Carregando…</div>;
  }

  const principal = ctx.papel === 'entregador'
    ? [{ to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas' }]
    : ctx.papel === 'operador'
    ? [
        { to: '/admin/pedidos', icon: <ClipboardList size={20} />, label: 'Pedidos' },
        { to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas' },
      ]
    : [
        { to: '/admin/pedidos', icon: <ClipboardList size={20} />, label: 'Pedidos' },
        { to: '/admin/cardapio', icon: <UtensilsCrossed size={20} />, label: 'Cardápio' },
        { to: '/admin/estoque', icon: <Boxes size={20} />, label: 'Estoque' },
        { to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas' },
      ];

  const mais = [
    { to: '/admin/financeiro', icon: <TrendingUp size={18} />, label: 'Financeiro' },
    { to: '/admin/historico', icon: <History size={18} />, label: 'Histórico' },
    { to: '/admin/marketing', icon: <Megaphone size={18} />, label: 'Marketing' },
    { to: '/admin/equipe', icon: <Users size={18} />, label: 'Equipe' },
    { to: '/admin/assinatura', icon: <CreditCard size={18} />, label: 'Assinatura' },
    { to: '/admin/loja', icon: <Store size={18} />, label: 'Configurar Loja' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white px-4 py-3 shadow-sm dark:bg-gray-900 dark:border-b dark:border-gray-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between lg:max-w-5xl">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="" className="h-8 w-8" />
            <h1 className="font-bold dark:text-gray-100">{ctx.lojaNome}</h1>
            {ctx.papel !== 'admin' && (
              <span className="rounded-full bg-[var(--cor-primaria)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--cor-primaria)] capitalize">
                {ctx.papel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={sair} className="text-gray-400 dark:text-gray-500"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl lg:max-w-5xl">
        <Outlet context={ctx} />
      </div>

      <nav className="fixed bottom-0 left-1/2 flex w-full max-w-3xl -translate-x-1/2 justify-around border-t bg-white py-2 dark:border-gray-800 dark:bg-gray-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] dark:shadow-none">
        {principal.map((i) => (
          <NavLink key={i.to} to={i.to}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 px-4 py-1 text-xs ${isActive ? 'font-semibold text-[var(--cor-primaria)]' : 'text-gray-400 dark:text-gray-500'}`}>
            {i.icon}
            {i.label}
          </NavLink>
        ))}
        {ctx.papel === 'admin' && (
          <button onClick={() => setMaisAberto(true)} className="flex flex-col items-center gap-0.5 px-4 py-1 text-xs text-gray-400 dark:text-gray-500">
            <MoreHorizontal size={20} />
            Mais
          </button>
        )}
      </nav>

      {maisAberto && (
        <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setMaisAberto(false)}>
          <div className="sheet w-full max-w-lg rounded-t-3xl bg-white p-4 pb-8 dark:bg-gray-900 dark:border-t dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold dark:text-gray-100">Mais</h3>
              <button onClick={() => setMaisAberto(false)} className="dark:text-gray-300"><X size={20} /></button>
            </div>
            <div className="space-y-1">
              <a href={`/${ctx.lojaSlug}`} target="_blank" rel="noreferrer" onClick={() => setMaisAberto(false)}
                className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium text-[var(--cor-primaria)] hover:bg-gray-50 dark:hover:bg-gray-800">
                <Store size={18} /> Ver página da loja
              </a>
              {mais.map((i) => (
                <NavLink key={i.to} to={i.to} onClick={() => setMaisAberto(false)}
                  className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                  {i.icon} {i.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
