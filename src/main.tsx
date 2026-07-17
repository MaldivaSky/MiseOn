/// <reference types="vite-plugin-pwa/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import Home from './pages/Home';
import Acesso from './pages/Acesso';
import Lojas from './pages/Lojas';
import CadastreSuaLoja from './pages/CadastreSuaLoja';
import Cardapio from './pages/Cardapio';
import MeusPedidos from './pages/MeusPedidos';
import AcompanharPedido from './pages/Pedido';
import Login from './pages/admin/Login';
import PainelPedidos from './pages/admin/PainelPedidos';
import Estoque from './pages/admin/Estoque';
import KDSProducao from './pages/admin/KDSProducao';
import Compras from './pages/admin/Compras';
import Entregas from './pages/admin/Entregas';
import Loja from './pages/admin/Loja';
import CardapioAdmin from './pages/admin/Cardapio';
import Financeiro from './pages/admin/Financeiro';
import Historico from './pages/admin/Historico';
import Marketing from './pages/admin/Marketing';
import Equipe from './pages/admin/Equipe';
import Assinatura from './pages/admin/Assinatura';
import AdminLayout from './pages/admin/AdminLayout';
import MinhaConta from './pages/admin/MinhaConta';
import Ajuda from './pages/admin/Ajuda';
import Dashboard from './pages/admin/Dashboard';
import PDV from './pages/admin/PDV';
import KDS from './pages/admin/KDS';
import Mesas from './pages/admin/Mesas';

// Entregador App
import EntregadorLayout from './pages/entregador/EntregadorLayout';
import EntregadorLogin from './pages/entregador/Login';
import EntregadorDashboard from './pages/entregador/Dashboard';
import EntregadorRota from './pages/entregador/Rota';

import SuperAdminLogin from './pages/superadmin/Login';
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import Tenants from './pages/superadmin/Tenants';
import Onboarding from './pages/superadmin/Onboarding';
import Churn from './pages/superadmin/Churn';
import Auditoria from './pages/superadmin/Auditoria';
import Termos from './pages/legal/Termos';
import Privacidade from './pages/legal/Privacidade';
import { ScreenTransition } from './components/ScreenTransition';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ScreenTransition>
        <Routes>
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="inicio" replace />} />
            <Route path="inicio" element={<Dashboard />} />
            <Route path="pdv" element={<PDV />} />
            <Route path="kds" element={<KDS />} />
            <Route path="mesas" element={<Mesas />} />
            <Route path="pedidos" element={<PainelPedidos />} />
            <Route path="entregas" element={<Entregas />} />
            <Route path="cardapio" element={<CardapioAdmin />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="producao" element={<KDSProducao />} />
            <Route path="compras" element={<Compras />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="historico" element={<Historico />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="equipe" element={<Equipe />} />
            <Route path="loja" element={<Loja />} />
            <Route path="assinatura" element={<Assinatura />} />
            <Route path="ajuda" element={<Ajuda />} />
            <Route path="conta" element={<MinhaConta />} />
          </Route>
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          <Route path="/superadmin" element={<SuperAdminLayout />}>
            <Route index element={<Navigate to="tenants" replace />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="churn" element={<Churn />} />
            <Route path="auditoria" element={<Auditoria />} />
          </Route>
          
          <Route path="/entregador/login" element={<EntregadorLogin />} />
          <Route path="/entregador" element={<EntregadorLayout />}>
            <Route index element={<EntregadorDashboard />} />
            <Route path="rota/:id" element={<EntregadorRota />} />
            <Route path="conta" element={<MinhaConta />} />
          </Route>

          <Route path="/" element={<Home />} />
          <Route path="/acesso" element={<Acesso />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/lojas" element={<Lojas />} />
          <Route path="/cadastre-se" element={<CadastreSuaLoja />} />
          <Route path="/pedido/:id" element={<AcompanharPedido />} />
          <Route path="/:slug/meus-pedidos" element={<MeusPedidos />} />
          <Route path="/:slug" element={<Cardapio />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </ScreenTransition>
    </BrowserRouter>
  </React.StrictMode>,
);
