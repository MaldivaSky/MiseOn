import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Building2, UserPlus, TrendingDown, ScrollText, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function SuperAdminLayout() {
  const nav = useNavigate();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return nav('/superadmin/login');
      const { data } = await supabase.from('plataforma_admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!data) { setOk(false); return; }
      setOk(true);
    })();
  }, []);

  const sair = async () => { await supabase.auth.signOut(); nav('/superadmin/login'); };

  if (ok === null) return <div className="flex h-screen items-center justify-center text-gray-400">Carregando…</div>;
  if (ok === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-900 p-8 text-center text-white">
        <p className="font-semibold">Sua conta não tem acesso ao painel SuperAdmin.</p>
        <button onClick={sair} className="mt-2 rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold">Sair</button>
      </div>
    );
  }

  const itens = [
    { to: '/superadmin/tenants', icon: <Building2 size={18} />, label: 'Tenants' },
    { to: '/superadmin/onboarding', icon: <UserPlus size={18} />, label: 'Onboarding' },
    { to: '/superadmin/churn', icon: <TrendingDown size={18} />, label: 'Churn' },
    { to: '/superadmin/auditoria', icon: <ScrollText size={18} />, label: 'Auditoria' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex items-center justify-between bg-gray-900 px-4 py-3 text-white">
        <p className="text-sm font-bold">MiseOn · SuperAdmin</p>
        <button onClick={sair} className="text-gray-300"><LogOut size={18} /></button>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b bg-white px-2">
        {itens.map((i) => (
          <NavLink key={i.to} to={i.to}
            className={({ isActive }) => `flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium ${isActive ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'}`}>
            {i.icon} {i.label}
          </NavLink>
        ))}
      </nav>
      <div className="mx-auto max-w-4xl p-4">
        <Outlet />
      </div>
    </div>
  );
}
