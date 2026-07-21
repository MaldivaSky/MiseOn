/// <reference types="vite-plugin-pwa/client" />
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { ScreenTransition } from './components/ScreenTransition';
import { ToastProvider } from './components/ui/Toast';

// ── Chunk: PUBLIC (carrega imediatamente — rotas do cliente final) ─────────────
import Home from './pages/Home';
import Cardapio from './pages/Cardapio';

// ── Lazy: PUBLIC_AUX (raramente acessadas, baixo impacto no LCP) ─────────────
const Acesso          = lazy(() => import('./pages/Acesso'));
const Lojas           = lazy(() => import('./pages/Lojas'));
const CadastreSuaLoja = lazy(() => import('./pages/CadastreSuaLoja'));
const MeusPedidos     = lazy(() => import('./pages/MeusPedidos'));
const AcompanharPedido= lazy(() => import('./pages/Pedido'));
const Termos          = lazy(() => import('./pages/legal/Termos'));
const Privacidade     = lazy(() => import('./pages/legal/Privacidade'));

// ── Lazy: ADMIN_LAYOUT (único layout compartilhado — carrega rápido) ─────────
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Login       = lazy(() => import('./pages/admin/Login'));

// ── Lazy: ADMIN_OPERACAO (turno de trabalho — pré-carrega após login) ────────
const Dashboard     = lazy(() => import('./pages/admin/Dashboard'));
const PainelPedidos = lazy(() => import('./pages/admin/PainelPedidos'));
const PDV           = lazy(() => import('./pages/admin/PDV'));
const KDS           = lazy(() => import('./pages/admin/KDS'));
const KDSProducao   = lazy(() => import('./pages/admin/KDSProducao'));
const Mesas         = lazy(() => import('./pages/admin/Mesas'));
const Entregas      = lazy(() => import('./pages/admin/Entregas'));

// ── Lazy: ADMIN_GESTAO (chunk separado — só carrega ao navegar) ───────────────
const CardapioAdmin = lazy(() => import('./pages/admin/Cardapio'));
const Estoque       = lazy(() => import('./pages/admin/Estoque'));
const Compras       = lazy(() => import('./pages/admin/Compras'));
const Financeiro    = lazy(() => import('./pages/admin/Financeiro'));
const Historico     = lazy(() => import('./pages/admin/Historico'));
const Marketing     = lazy(() => import('./pages/admin/Marketing'));
const Equipe        = lazy(() => import('./pages/admin/Equipe'));
const Loja          = lazy(() => import('./pages/admin/Loja'));
const Assinatura    = lazy(() => import('./pages/admin/Assinatura'));
const Ajuda         = lazy(() => import('./pages/admin/Ajuda'));
const MinhaConta    = lazy(() => import('./pages/admin/MinhaConta'));
const ChatAdmin     = lazy(() => import('./pages/admin/ChatAdmin'));
const Ifood         = lazy(() => import('./pages/admin/Ifood'));

// ── Lazy: ENTREGADOR (app isolado) ────────────────────────────────────────────
const EntregadorLayout   = lazy(() => import('./pages/entregador/EntregadorLayout'));
const EntregadorLogin    = lazy(() => import('./pages/entregador/Login'));
const EntregadorDashboard= lazy(() => import('./pages/entregador/Dashboard'));
const EntregadorRota     = lazy(() => import('./pages/entregador/Rota'));

// ── Lazy: SUPERADMIN (area interna restrita) ──────────────────────────────────
const SuperAdminLogin  = lazy(() => import('./pages/superadmin/Login'));
const SuperAdminLayout = lazy(() => import('./pages/superadmin/SuperAdminLayout'));
const Tenants          = lazy(() => import('./pages/superadmin/Tenants'));
const Onboarding       = lazy(() => import('./pages/superadmin/Onboarding'));
const Churn            = lazy(() => import('./pages/superadmin/Churn'));
const Auditoria        = lazy(() => import('./pages/superadmin/Auditoria'));

// ── Loading placeholder minimalista (evita CLS durante lazy load) ─────────────
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#F4F7FA] dark:bg-[#0B1120]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#004198] border-t-transparent" />
    </div>
  );
}

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <ScreenTransition>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Admin ── */}
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="inicio" replace />} />
                <Route path="inicio"    element={<Dashboard />} />
                <Route path="pdv"       element={<PDV />} />
                <Route path="kds"       element={<KDS />} />
                <Route path="mesas"     element={<Mesas />} />
                <Route path="pedidos"   element={<PainelPedidos />} />
                <Route path="entregas"  element={<Entregas />} />
                <Route path="cardapio"  element={<CardapioAdmin />} />
                <Route path="estoque"   element={<Estoque />} />
                <Route path="producao"  element={<KDSProducao />} />
                <Route path="compras"   element={<Compras />} />
                <Route path="financeiro" element={<Financeiro />} />
                <Route path="historico" element={<Historico />} />
                <Route path="marketing" element={<Marketing />} />
                <Route path="equipe"    element={<Equipe />} />
                <Route path="loja"      element={<Loja />} />
                <Route path="assinatura" element={<Assinatura />} />
                <Route path="ajuda"     element={<Ajuda />} />
                <Route path="conta"     element={<MinhaConta />} />
                <Route path="chat"      element={<ChatAdmin />} />
                <Route path="ifood"     element={<Ifood />} />
              </Route>

              {/* ── Superadmin ── */}
              <Route path="/superadmin/login" element={<SuperAdminLogin />} />
              <Route path="/superadmin" element={<SuperAdminLayout />}>
                <Route index element={<Navigate to="tenants" replace />} />
                <Route path="tenants"    element={<Tenants />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="churn"      element={<Churn />} />
                <Route path="auditoria"  element={<Auditoria />} />
              </Route>

              {/* ── Entregador ── */}
              <Route path="/entregador/login" element={<EntregadorLogin />} />
              <Route path="/entregador" element={<EntregadorLayout />}>
                <Route index element={<EntregadorDashboard />} />
                <Route path="rota/:id" element={<EntregadorRota />} />
                <Route path="conta"    element={<MinhaConta />} />
              </Route>

              {/* ── Público ── */}
              <Route path="/"              element={<Home />} />
              <Route path="/acesso"        element={<Acesso />} />
              <Route path="/termos"        element={<Termos />} />
              <Route path="/privacidade"   element={<Privacidade />} />
              <Route path="/lojas"         element={<Lojas />} />
              <Route path="/cadastre-se"   element={<CadastreSuaLoja />} />
              <Route path="/pedido/:id"    element={<AcompanharPedido />} />
              <Route path="/:slug/meus-pedidos" element={<MeusPedidos />} />
              <Route path="/:slug"         element={<Cardapio />} />
              <Route path="*"             element={<Home />} />
            </Routes>
          </Suspense>
        </ScreenTransition>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>,
);
