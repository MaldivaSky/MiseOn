import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, Boxes, Bike, Store, LogOut, UtensilsCrossed, MoreHorizontal, X, TrendingUp, Megaphone, Users, History, CreditCard, ShoppingCart, Flame, ChevronLeft, Menu, UserCircle, LifeBuoy, LayoutDashboard, Calculator, ChefHat, LayoutGrid } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ThemeToggle from '../../components/ThemeToggle';

export interface CtxLoja {
  lojaId: string;
  lojaNome: string;
  lojaSlug: string;
  papel: string; // admin | operador | entregador
  status_assinatura?: string | null;
  diasAtraso: number;
}

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [ctx, setCtx] = useState<CtxLoja | null>(null);
  const [semLoja, setSemLoja] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  
  // Controle de menu interno no mobile
  const [maisAberto, setMaisAberto] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return nav('/admin/login');
      const { data } = await supabase
        .from('usuarios_loja')
        .select('loja_id, papel, lojas(nome, cor_primaria, cor_secundaria, slug, criado_em)')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (!data) { setSemLoja(true); return; }
      const papel = (data as any).papel ?? 'admin';
      const lojaInfo = (data as any).lojas;

      const vencBase = lojaInfo?.vencimento_assinatura || lojaInfo?.criado_em;
      const vencimento = vencBase ? new Date(vencBase) : new Date();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      vencimento.setHours(0, 0, 0, 0);
      const diffMs = hoje.getTime() - vencimento.getTime();
      let diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diasAtraso < 0) diasAtraso = 0; // Ainda não venceu
      if (lojaInfo?.status_assinatura === 'ATIVO' || lojaInfo?.status_assinatura === 'VITALICIO') diasAtraso = 0;

      setCtx({ 
        lojaId: data.loja_id, 
        lojaNome: lojaInfo?.nome ?? 'Minha loja', 
        lojaSlug: lojaInfo?.slug ?? '', 
        papel,
        status_assinatura: lojaInfo?.status_assinatura,
        diasAtraso
      });

      if (lojaInfo?.cor_primaria) document.documentElement.style.setProperty('--cor-primaria', lojaInfo.cor_primaria);
      if (lojaInfo?.cor_secundaria) document.documentElement.style.setProperty('--cor-secundaria', lojaInfo.cor_secundaria);
      
      // Motor de Bloqueio Seco (Lockdown)
      if (diasAtraso > 5 && papel === 'admin' && !location.pathname.includes('/assinatura')) {
        nav('/admin/assinatura');
      } else if (papel === 'entregador' && !location.pathname.includes('/entregas')) {
        nav('/admin/entregas');
      }
    })();
  }, [nav, loc.pathname]);

  const sair = async () => { await supabase.auth.signOut(); nav('/admin/login'); };

  if (semLoja) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center bg-gray-50 dark:bg-[#0B1120] text-gray-900 dark:text-gray-100">
        <p className="font-semibold text-lg">Sua conta ainda não está vinculada a nenhuma loja.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">Peça para o administrador da loja te convidar pela tela de Equipe, usando este mesmo e-mail.</p>
        <button onClick={sair} className="mt-4 rounded-xl bg-[#004198] hover:bg-[#00337A] px-8 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95">Voltar para o Login</button>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120]">
        <div className="w-8 h-8 border-4 border-[#004198] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Se bloqueado e for admin, a UI morre e força a tela de assinatura
  const isLockdown = ctx.diasAtraso > 5;
  if (isLockdown && ctx.papel !== 'admin') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-8 text-center bg-gray-50 dark:bg-[#0B1120] text-gray-900 dark:text-gray-100">
        <Store size={48} className="text-red-500 mb-2" />
        <h1 className="font-bold text-xl text-red-600">Loja Temporariamente Suspensa</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">O acesso ao sistema operacional está suspenso. Peça para o administrador da loja regularizar a assinatura na plataforma.</p>
        <button onClick={sair} className="mt-4 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 px-8 py-3 text-sm font-bold shadow-sm transition-all active:scale-95">Sair do Sistema</button>
      </div>
    );
  }

  const principal = ctx.papel === 'entregador'
    ? [{ to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas' }]
    : ctx.papel === 'garcom'
    ? [
        { to: '/admin/mesas', icon: <LayoutGrid size={20} />, label: 'Mapa de Mesas' },
        { to: '/admin/pdv', icon: <Calculator size={20} />, label: 'Lançar Pedido' },
      ]
    : ctx.papel === 'operador'
    ? [
        { to: '/admin/pdv', icon: <Calculator size={20} />, label: 'PDV Balcão' },
        { to: '/admin/mesas', icon: <LayoutGrid size={20} />, label: 'Mapa de Mesas' },
        { to: '/admin/pedidos', icon: <ClipboardList size={20} />, label: 'Pedidos' },
        { to: '/admin/kds', icon: <ChefHat size={20} />, label: 'Cozinha (KDS)' },
        { to: '/admin/producao', icon: <Flame size={20} />, label: 'Produção' },
        { to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas' },
      ]
    : [
        { to: '/admin/inicio', icon: <LayoutDashboard size={20} />, label: 'Início' },
        { to: '/admin/pdv', icon: <Calculator size={20} />, label: 'PDV Balcão' },
        { to: '/admin/mesas', icon: <LayoutGrid size={20} />, label: 'Mapa de Mesas' },
        { to: '/admin/pedidos', icon: <ClipboardList size={20} />, label: 'Pedidos' },
        { to: '/admin/kds', icon: <ChefHat size={20} />, label: 'Cozinha (KDS)' },
        { to: '/admin/cardapio', icon: <UtensilsCrossed size={20} />, label: 'Cardápio' },
        { to: '/admin/estoque', icon: <Boxes size={20} />, label: 'Estoque' },
        { to: '/admin/producao', icon: <Flame size={20} />, label: 'Produção' },
        { to: '/admin/entregas', icon: <Bike size={20} />, label: 'Entregas' },
      ];

  const mais = [
    { to: '/admin/compras', icon: <ShoppingCart size={20} />, label: 'Central de Compras' },
    { to: '/admin/financeiro', icon: <TrendingUp size={20} />, label: 'Financeiro' },
    { to: '/admin/historico', icon: <History size={20} />, label: 'Histórico' },
    { to: '/admin/marketing', icon: <Megaphone size={20} />, label: 'Marketing' },
    { to: '/admin/equipe', icon: <Users size={20} />, label: 'Equipe e Acessos' },
    { to: '/admin/assinatura', icon: <CreditCard size={20} />, label: 'Assinatura SaaS' },
    { to: '/admin/loja', icon: <Store size={20} />, label: 'Configurações da Loja' },
    { to: '/admin/ajuda', icon: <LifeBuoy size={20} />, label: 'Central de Ajuda' },
  ];

  // Barra inferior do mobile: só os destinos de uso constante durante o turno
  // (não a lista inteira — isso é o que o menu "Mais" resolve). Derivado de
  // `principal` por rota, então rótulo/ícone nunca ficam fora de sincronia.
  const ROTAS_BOTTOM_NAV: Record<string, string[]> = {
    admin:      ['/admin/inicio', '/admin/pedidos', '/admin/kds', '/admin/pdv'],
    operador:   ['/admin/pdv', '/admin/pedidos', '/admin/kds', '/admin/entregas'],
    garcom:     ['/admin/mesas', '/admin/pdv'],
    entregador: ['/admin/entregas'],
  };
  const bottomNav = (ROTAS_BOTTOM_NAV[ctx.papel] ?? [])
    .map((to) => principal.find((p) => p.to === to))
    .filter((p): p is (typeof principal)[number] => !!p);
  // "Mais" acende quando a rota atual é algo que só existe fora da barra curada
  const emRotaSoDoMenu = !bottomNav.some((p) => p.to === loc.pathname)
    && (principal.some((p) => p.to === loc.pathname) || mais.some((p) => p.to === loc.pathname));

  const isMainRoute = principal.some(p => p.to === loc.pathname) || loc.pathname === '/admin';
  const innerRouteTitle = mais.find(m => m.to === loc.pathname)?.label;

  // Renderiza um link da sidebar
  const renderSidebarLink = (to: string, icon: any, label: string, onClick?: () => void) => (
    <NavLink 
      key={to} 
      to={to}
      onClick={onClick}
      className={({ isActive }) => `
        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group
        ${isActive 
          ? 'bg-[#004198]/10 dark:bg-[#004198]/20 text-[#004198] dark:text-[#6B9EFF]' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'}
      `}
    >
      {({ isActive }) => (
        <>
          <div className={`${isActive ? 'text-[#004198] dark:text-[#6B9EFF]' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'} transition-colors`}>
            {icon}
          </div>
          {label}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="flex h-screen bg-[#F4F7FA] dark:bg-[#0B1120] text-gray-900 dark:text-gray-100 font-sans overflow-hidden selection:bg-[#004198] selection:text-white">
      
      {/* ── SIDEBAR (DESKTOP) ── */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-white dark:bg-[#111827] border-r border-gray-200 dark:border-gray-800 z-40 print:hidden h-full">
        {/* Header da Sidebar (Logo MiseOn) */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="bg-[#004198] p-1.5 rounded-lg shadow-sm">
              <img src="/brand/icon-white.png" alt="" className="h-5 w-5 object-contain" onError={(e) => { e.currentTarget.style.display='none' }} />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-gray-900 dark:text-white">MiseOn</span>
          </div>
        </div>

        {/* Informações da Loja */}
        <div className="px-6 py-5 flex flex-col gap-1">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Loja Atual</span>
          <h2 className="font-bold text-base truncate text-gray-900 dark:text-white">{ctx.lojaNome}</h2>
          {ctx.papel !== 'admin' && (
            <span className="inline-block mt-1 self-start rounded-md bg-[#004198]/10 px-2 py-0.5 text-[10px] font-bold text-[#004198] dark:text-[#6B9EFF] uppercase">
              {ctx.papel}
            </span>
          )}
        </div>

        {/* Navegação Scrollável */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-8 custom-scrollbar">
          
          <div className="space-y-1">
            <p className="px-2 mb-2 text-[10px] font-bold tracking-widest text-gray-400 uppercase">Operação</p>
            {principal.map(p => renderSidebarLink(p.to, p.icon, p.label))}
          </div>

          {ctx.papel === 'admin' && (
            <div className="space-y-1">
              <p className="px-2 mb-2 text-[10px] font-bold tracking-widest text-gray-400 uppercase">Gestão & Mais</p>
              {mais.map(p => renderSidebarLink(p.to, p.icon, p.label))}
            </div>
          )}
        </div>

        {/* Footer da Sidebar (Usuário) */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <a href={`/${ctx.lojaSlug}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Store size={16} /> Ver Loja Online
          </a>
          <NavLink to="/admin/conta" className={({isActive}) => `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-[var(--cor-primaria)] text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <UserCircle size={16} /> Minha Conta
          </NavLink>
          <button onClick={sair} className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors">
            <LogOut size={16} /> Sair do Sistema
          </button>
        </div>
      </aside>

      {/* ── ÁREA DE CONTEÚDO (MAIN) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* ── TOP HEADER GLOBAL ── */}
        <header className="h-16 flex-shrink-0 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 z-30 print:hidden">
          
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button onClick={() => setMenuMobileAberto(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Menu size={24} />
            </button>
            
            {/* Mobile Brand / Back Button */}
            <div className="flex lg:hidden items-center gap-2">
              {!isMainRoute ? (
                <button onClick={() => nav(-1)} className="flex items-center gap-1 text-sm font-bold text-[#004198] dark:text-[#6B9EFF]">
                  <ChevronLeft size={18} /> Voltar
                </button>
              ) : (
                <span className="font-extrabold text-lg text-gray-900 dark:text-white truncate">{ctx.lojaNome}</span>
              )}
            </div>

            {/* Desktop Page Title (Optional) */}
            <div className="hidden lg:flex items-center gap-2">
              {!isMainRoute && (
                <button onClick={() => nav(-1)} className="mr-2 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <ChevronLeft size={20} />
                </button>
              )}
              <h1 className="font-bold text-lg text-gray-900 dark:text-white">
                {!isMainRoute ? innerRouteTitle : 'Painel de Controle'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* ── CONTEÚDO DA PÁGINA (SCROLLÁVEL) ── */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 relative custom-scrollbar">
          
          {/* BANNER DE CARÊNCIA INFECHÁVEL (DIAS 1 A 5) */}
          {ctx.diasAtraso > 0 && ctx.diasAtraso <= 5 && (
            <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 sm:px-6 flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-3">
                <div className="bg-red-500 text-white p-1.5 rounded-lg animate-pulse">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-700 dark:text-red-400 leading-tight">Assinatura Vencida (Atraso: {ctx.diasAtraso} {ctx.diasAtraso === 1 ? 'dia' : 'dias'})</h3>
                  <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">O sistema será totalmente bloqueado em {6 - ctx.diasAtraso} dias.</p>
                </div>
              </div>
              <button onClick={() => nav('/admin/assinatura')} className="whitespace-nowrap px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] uppercase tracking-wider font-bold rounded-lg shadow-sm transition-colors">
                Pagar Agora
              </button>
            </div>
          )}

          <div className="mx-auto max-w-6xl w-full">
            <Outlet context={ctx} />
          </div>
        </main>

      </div>

      {/* ── MOBILE DRAWER (SIDEBAR NO MOBILE) ── */}
      {menuMobileAberto && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={() => setMenuMobileAberto(false)} />
          <div className="relative w-[280px] max-w-[80vw] bg-white dark:bg-[#111827] h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="bg-[#004198] p-1 rounded-md">
                  <img src="/brand/icon-white.png" alt="" className="h-4 w-4" />
                </div>
                <span className="font-bold">MiseOn</span>
              </div>
              <button onClick={() => setMenuMobileAberto(false)} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="space-y-1">
                <p className="px-2 mb-2 text-[10px] font-bold text-gray-400 uppercase">Operação</p>
                {principal.map(p => renderSidebarLink(p.to, p.icon, p.label, () => setMenuMobileAberto(false)))}
              </div>
              {ctx.papel === 'admin' && (
                <div className="space-y-1">
                  <p className="px-2 mb-2 text-[10px] font-bold text-gray-400 uppercase">Gestão</p>
                  {mais.map(p => renderSidebarLink(p.to, p.icon, p.label, () => setMenuMobileAberto(false)))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <NavLink to="/admin/conta" onClick={() => setMenuMobileAberto(false)} className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 font-bold text-gray-700 dark:text-gray-200">
                <UserCircle size={18} /> Minha Conta
              </NavLink>
              <button onClick={sair} className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 font-bold">
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV (SOMENTE MOBILE) ── */}
      {/* 
          Diferente da versão "floating", esta barra é 100% fixa ao chão sem espaçamentos laterais.
          Ela funciona como um BottomNavigationView padrão, não obstrui as telas internas pois 
          telas como Compras terão seu próprio z-index e padding-bottom.
      */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#111827] border-t border-gray-200 dark:border-gray-800 flex justify-around items-center h-16 pb-safe print:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {bottomNav.map((i) => (
          <NavLink key={i.to} to={i.to}
            className={({ isActive }) => `
              flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors
              ${isActive ? 'text-[#004198] dark:text-[#6B9EFF]' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'}
            `}
          >
            {({ isActive }) => (
              <>
                <div className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform duration-200`}>{i.icon}</div>
                <span className="text-[10px] font-bold tracking-tight">{i.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMenuMobileAberto(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${emRotaSoDoMenu ? 'text-[#004198] dark:text-[#6B9EFF]' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'}`}
        >
          <MoreHorizontal size={20} className={emRotaSoDoMenu ? 'scale-110' : 'scale-100'} />
          <span className="text-[10px] font-bold tracking-tight">Mais</span>
        </button>
      </nav>

    </div>
  );
}

