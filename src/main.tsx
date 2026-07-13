import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import Cardapio from './pages/Cardapio';
import AcompanharPedido from './pages/Pedido';
import Login from './pages/admin/Login';
import PainelPedidos from './pages/admin/PainelPedidos';
import Estoque from './pages/admin/Estoque';
import Entregas from './pages/admin/Entregas';
import Loja from './pages/admin/Loja';
import CardapioAdmin from './pages/admin/Cardapio';
import Financeiro from './pages/admin/Financeiro';
import Marketing from './pages/admin/Marketing';
import Equipe from './pages/admin/Equipe';
import AdminLayout from './pages/admin/AdminLayout';
import SuperAdminLogin from './pages/superadmin/Login';
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import Tenants from './pages/superadmin/Tenants';
import Onboarding from './pages/superadmin/Onboarding';
import Churn from './pages/superadmin/Churn';
import Auditoria from './pages/superadmin/Auditoria';
import Splash from './components/Splash';

function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
      <img src="/logo.png" alt="MiseOn" className="w-72 max-w-full" />
      <p className="mt-6 max-w-md text-sm text-gray-500">
        Cardápio digital, pedidos em tempo real, entrega, pagamento Pix e controle de estoque
        com ficha técnica — tudo em um só lugar.
      </p>
      <a href="/admin" className="mt-6 rounded-xl bg-blue-800 px-6 py-3 text-sm font-semibold text-white">
        Acessar o painel
      </a>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Splash>
        <Routes>
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="pedidos" replace />} />
            <Route path="pedidos" element={<PainelPedidos />} />
            <Route path="entregas" element={<Entregas />} />
            <Route path="cardapio" element={<CardapioAdmin />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="equipe" element={<Equipe />} />
            <Route path="loja" element={<Loja />} />
          </Route>
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          <Route path="/superadmin" element={<SuperAdminLayout />}>
            <Route index element={<Navigate to="tenants" replace />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="churn" element={<Churn />} />
            <Route path="auditoria" element={<Auditoria />} />
          </Route>
          <Route path="/" element={<Home />} />
          <Route path="/pedido/:id" element={<AcompanharPedido />} />
          <Route path="/:slug" element={<Cardapio />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Splash>
    </BrowserRouter>
  </React.StrictMode>,
);
