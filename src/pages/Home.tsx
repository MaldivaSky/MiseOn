import { useState } from 'react';
import { ShoppingBag, Bike, Boxes, QrCode, ArrowRight, Zap, Check, Star, ChevronRight, Activity, TrendingUp } from 'lucide-react';
import MiseOnLogo from '../components/MiseOnLogo';

const WHATSAPP_VENDAS = '5511919889233';
const zap = (msg: string) => `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

const RECURSOS = [
  { 
    id: 'kds',
    icon: <ShoppingBag size={24} />, 
    titulo: 'Cardápio Digital KDS', 
    texto: 'Experiência de autoatendimento fluida com integração direta ao Kitchen Display System (KDS).',
    detalhe: 'Elimine atritos operacionais. Cada pedido feito no celular do cliente ou no PDV cai instantaneamente na tela da cozinha, cronometrado e organizado por prioridade.',
    mockup: (
      <div className="flex flex-col gap-3 p-4 bg-[#070C18] rounded-xl h-full border border-gray-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="font-bold text-white text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Painel KDS
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-1 rounded-full">
            2 PREPARANDO
          </div>
        </div>
        <div className="flex gap-4 h-full">
          {/* Coluna Novo */}
          <div className="flex-1 bg-[#0f172a] rounded-lg p-2 border border-gray-800/50">
            <div className="text-[10px] font-bold text-gray-500 mb-2 px-1">NOVO (1)</div>
            <div className="bg-gray-800/80 rounded border border-gray-700 p-2 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <div className="flex justify-between items-start mb-1 ml-2">
                <span className="text-blue-400 text-[10px] font-black">#1044</span>
                <span className="text-gray-400 text-[9px] flex items-center gap-1"><span className="text-blue-400">●</span> 00:12</span>
              </div>
              <div className="text-gray-200 text-xs ml-2 font-medium">1x Combo Duplo</div>
              <div className="text-gray-500 text-[10px] ml-2 mt-1">Retirada</div>
            </div>
          </div>
          {/* Coluna Preparando */}
          <div className="flex-1 bg-[#0f172a] rounded-lg p-2 border border-gray-800/50 relative">
            <div className="text-[10px] font-bold text-gray-500 mb-2 px-1">PREPARANDO (2)</div>
            
            <div className="bg-gray-800/80 rounded border border-gray-700 p-2 shadow-sm relative overflow-hidden mb-2">
              <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
              <div className="flex justify-between items-start mb-1 ml-2">
                <span className="text-orange-400 text-[10px] font-black">#1042</span>
                <span className="text-orange-400 text-[9px] animate-pulse">04:12</span>
              </div>
              <div className="text-gray-200 text-xs ml-2 font-medium">1x Baguete 30cm</div>
              <div className="text-red-400 text-[10px] ml-2 mt-1 font-bold">- Sem cebola</div>
            </div>

            <div className="bg-gray-800/80 rounded border border-gray-700 p-2 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
              <div className="flex justify-between items-start mb-1 ml-2">
                <span className="text-orange-400 text-[10px] font-black">#1043</span>
                <span className="text-gray-400 text-[9px]">02:45</span>
              </div>
              <div className="text-gray-200 text-xs ml-2 font-medium">2x Hambúrguer Artesanal</div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  { 
    id: 'estoque',
    icon: <Boxes size={24} />, 
    titulo: 'Estoque Inteligente', 
    texto: 'Gestão de inventário preditiva baseada em Engenharia de Cardápio.',
    detalhe: 'Controle de insumos via Ficha Técnica com precisão milimétrica. Vendeu um combo? O sistema dá baixa no pão, na carne e na embalagem automaticamente.',
    mockup: (
      <div className="flex flex-col p-4 bg-[#070C18] rounded-xl h-full border border-gray-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
          <div className="font-bold text-white text-sm">Motor de Compras</div>
          <button className="bg-[var(--cor-primaria)] text-white text-[10px] px-3 py-1 rounded-lg font-bold shadow-lg shadow-[var(--cor-primaria)]/30">
            Gerar Lista Automática
          </button>
        </div>
        
        {/* Tabela de Insumos */}
        <div className="border border-gray-800 rounded-lg overflow-hidden bg-[#0a0f1c]">
          <div className="grid grid-cols-4 gap-2 p-2 border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase">
            <div className="col-span-2">Insumo</div>
            <div className="text-center">Estoque</div>
            <div className="text-right">Ação</div>
          </div>
          
          <div className="grid grid-cols-4 gap-2 p-2 border-b border-gray-800/50 items-center">
            <div className="col-span-2 flex flex-col">
              <span className="text-gray-200 text-xs font-medium">Pão Baguete 30cm</span>
              <span className="text-gray-500 text-[9px]">Mín: 50 | Pacote c/ 5</span>
            </div>
            <div className="text-center">
              <span className="inline-flex items-center justify-center bg-red-500/10 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 text-[10px] font-bold animate-pulse">
                12 un
              </span>
            </div>
            <div className="text-right">
              <span className="text-white text-[10px] bg-gray-800 px-2 py-1 rounded">Comprar 8 pct</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 p-2 border-b border-gray-800/50 items-center">
            <div className="col-span-2 flex flex-col">
              <span className="text-gray-200 text-xs font-medium">Blend Angus 180g</span>
              <span className="text-gray-500 text-[9px]">Mín: 100 | Cx c/ 20</span>
            </div>
            <div className="text-center">
              <span className="inline-flex items-center justify-center bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded px-1.5 py-0.5 text-[10px] font-bold">
                105 un
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-500 text-[10px]">-</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 p-2 items-center">
            <div className="col-span-2 flex flex-col">
              <span className="text-gray-200 text-xs font-medium">Coca Cola 600ml</span>
              <span className="text-gray-500 text-[9px]">Mín: 24 | Cx c/ 6</span>
            </div>
            <div className="text-center">
              <span className="inline-flex items-center justify-center bg-green-500/10 text-green-400 border border-green-500/20 rounded px-1.5 py-0.5 text-[10px] font-bold">
                142 un
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-500 text-[10px]">-</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  { 
    id: 'efi',
    icon: <QrCode size={24} />, 
    titulo: 'Split Efí Bank', 
    texto: 'Liquidação financeira transparente e automatizada via Efí Bank.',
    detalhe: 'Split de pagamentos nativo. Pix e Cartão caem direto na sua conta oficial, com taxas negociadas e conciliação bancária em tempo real sem intermediários.',
    mockup: (
      <div className="flex flex-col p-4 bg-[#070C18] rounded-xl h-full border border-gray-800 shadow-2xl relative overflow-hidden">
        {/* Gráfico de Fundo */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 opacity-20 flex items-end">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full text-blue-500 fill-current">
             <path d="M0,40 L0,20 L10,15 L20,25 L30,10 L40,30 L50,5 L60,20 L70,10 L80,25 L90,15 L100,5 L100,40 Z" />
          </svg>
        </div>
        
        <div className="relative z-10 flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
          <div className="font-bold text-white text-sm flex items-center gap-2">
            <div className="bg-[#00B4D8] p-1 rounded"><QrCode size={14} className="text-white" /></div>
            Efí Bank
          </div>
          <div className="text-[10px] text-gray-400 border border-gray-700 px-2 py-1 rounded-lg">
            Conta Conectada
          </div>
        </div>

        <div className="relative z-10 text-center mb-6">
          <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Lucro Líquido Real</div>
          <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#00B4D8]">
            R$ 14.250,00
          </div>
        </div>

        <div className="relative z-10 space-y-2 mt-auto">
          <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-2.5 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-green-500 text-[10px]">PIX</span>
              </div>
              <span className="text-gray-300 text-xs">Pedido #1042</span>
            </div>
            <span className="text-green-400 font-bold text-xs">+ R$ 38,90</span>
          </div>
          <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-2.5 flex justify-between items-center backdrop-blur-md">
             <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-blue-500 text-[10px]">CRT</span>
              </div>
              <span className="text-gray-300 text-xs">Pedido #1041</span>
            </div>
            <span className="text-green-400 font-bold text-xs">+ R$ 112,00</span>
          </div>
        </div>
      </div>
    )
  },
  { 
    id: 'logistica',
    icon: <Bike size={24} />, 
    titulo: 'Logística de Entrega', 
    texto: 'Orquestração completa de frota com roteirização inteligente.',
    detalhe: 'Acompanhamento em tempo real (Live Tracking) para elevar a experiência do seu cliente final. Despache pedidos com um clique para a tela do seu motoboy.',
    mockup: (
      <div className="flex flex-col gap-3 p-4 bg-[#070C18] rounded-xl h-full border border-gray-800 relative overflow-hidden shadow-2xl">
        {/* Mapa Dinâmico Mockado via SVG e CSS */}
        <div className="absolute inset-0 bg-[#0f172a] opacity-60">
           {/* Ruas (grid) */}
           <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
           
           {/* Rota */}
           <svg className="absolute inset-0 w-full h-full" style={{ filter: 'drop-shadow(0 0 4px rgba(252,91,36,0.5))' }}>
              <path d="M 40,200 L 40,100 L 150,100 L 150,50 L 250,50" stroke="#FC5B24" strokeWidth="3" fill="none" strokeDasharray="6,4" />
           </svg>
           
           {/* Marcador Motoboy (Movendo) */}
           <div className="absolute w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center shadow-[0_0_15px_#FC5B24] transition-all duration-[3000ms] top-[80px] left-[138px]">
              <span className="text-white text-[10px]">🛵</span>
           </div>
           
           {/* Marcador Cliente */}
           <div className="absolute top-[40px] left-[240px] w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_10px_#3b82f6]"></div>
        </div>

        {/* UI Overlay */}
        <div className="relative z-10 flex items-center justify-between bg-black/70 backdrop-blur-md border border-gray-700 rounded-xl p-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-orange-400 flex items-center justify-center text-white shadow-md">
              <Bike size={20} />
            </div>
            <div>
              <div className="text-white text-xs font-black">Motoboy Carlos</div>
              <div className="text-orange-400 text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                Em rota (3 min)
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 mt-auto bg-black/70 backdrop-blur-md border border-gray-700 rounded-xl p-3 shadow-lg">
          <div className="flex justify-between items-center mb-1">
            <div className="text-white text-xs font-bold">Entrega #1042</div>
            <div className="text-gray-400 text-[10px]">1.2 km</div>
          </div>
          <div className="text-gray-400 text-[10px] truncate">Av. Paulista, 1578 - Bela Vista</div>
        </div>
      </div>
    )
  },
];

const CHECKLIST = [
  'Cardápio Digital + QR Code',
  'KDS (Tela da Cozinha)',
  'Controle de Estoque com Ficha Técnica',
  'Central de Compras Automática',
  'Motor de Custos Operacionais (Lucro Real)',
  'Pagamentos Pix + Cartão (Efí Bank)',
  'App de Entregas para Motoboy',
  'IA para descrever produtos',
];

export default function Home() {
  const [activeTab, setActiveTab] = useState(RECURSOS[0].id);

  return (
    <div
      style={{ background: '#070C18', color: '#EAF1FB', fontFamily: "'Inter', sans-serif" }}
      className="min-h-screen selection:bg-orange-500 selection:text-white"
    >
      {/* ── Navbar ── */}
      <nav
        style={{ background: 'rgba(7,12,24,0.85)', borderBottom: '1px solid rgba(10,92,196,0.2)', backdropFilter: 'blur(16px)' }}
        className="fixed inset-x-0 top-0 z-50"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="filter drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">
            <MiseOnLogo size={140} />
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/admin/login"
              style={{ color: '#EAF1FB' }}
              className="text-sm font-semibold opacity-70 transition hover:opacity-100"
            >
              Login Lojista
            </a>
            <a
              href="/cadastre-se"
              style={{ background: '#FC5B24', color: '#fff', fontFamily: "'Sora', sans-serif" }}
              className="rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition hover:brightness-110 hover:scale-105"
            >
              Criar minha loja
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-36 pb-24 lg:pt-52 lg:pb-36">
        {/* Glow orbs */}
        <div style={{ background: 'radial-gradient(circle, rgba(10,92,196,0.35) 0%, transparent 70%)', width: 700, height: 700, borderRadius: '50%', position: 'absolute', top: -200, left: '50%', transform: 'translateX(-60%)', pointerEvents: 'none' }} />
        <div style={{ background: 'radial-gradient(circle, rgba(252,91,36,0.2) 0%, transparent 70%)', width: 400, height: 400, borderRadius: '50%', position: 'absolute', top: 50, right: -100, pointerEvents: 'none' }} />

        <div className="mx-auto max-w-5xl px-6 text-center relative z-10">
          {/* Badge */}
          <div
            style={{ border: '1px solid rgba(252,91,36,0.4)', background: 'rgba(252,91,36,0.1)', color: '#FC5B24', fontFamily: "'Sora', sans-serif" }}
            className="mb-8 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold tracking-wider uppercase"
          >
            <Zap size={14} className="fill-current" /> A revolução da sua cozinha chegou
          </div>

          {/* Headline */}
          <h1
            style={{ fontFamily: "'Sora', sans-serif", lineHeight: 1.1 }}
            className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl"
          >
            O sistema de pedidos que a sua cozinha{' '}
            <span style={{ backgroundImage: 'linear-gradient(135deg, #FC5B24, #0A5CC4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              sempre sonhou.
            </span>
          </h1>

          <p style={{ color: 'rgba(234,241,251,0.65)' }} className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed">
            Abandone as planilhas e as taxas abusivas. Cardápio digital, comanda KDS, baixa automática de estoque, central de compras e cálculo do <b>Lucro Líquido Real</b> na sua mão.
          </p>

          {/* CTAs */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/cadastre-se"
              style={{ background: '#0A5CC4', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 32px rgba(10,92,196,0.5)' }}
              className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white transition hover:brightness-125 hover:scale-105 sm:w-auto"
            >
              Teste Grátis Agora <ArrowRight size={20} />
            </a>
            <a
              href="/natureba"
              style={{ border: '2px solid rgba(252,91,36,0.5)', color: '#FC5B24', background: 'rgba(252,91,36,0.08)', fontFamily: "'Sora', sans-serif" }}
              className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-bold transition hover:bg-orange-500/20 sm:w-auto"
            >
              Ver loja de exemplo
            </a>
            <a
              href={zap('Olá! Quero ver o MiseOn funcionando')}
              style={{ border: '2px solid #22c55e', background: 'rgba(34,197,94,0.08)', fontFamily: "'Sora', sans-serif" }}
              className="flex w-full flex-col items-center justify-center rounded-full px-8 py-2.5 transition hover:bg-green-500/20 sm:w-auto"
            >
              <span style={{ color: '#22c55e' }} className="text-xs font-bold uppercase tracking-widest">Falar com Consultor</span>
              <span style={{ color: '#22c55e' }} className="text-xl font-black">{WHATSAPP_VENDAS}</span>
            </a>
          </div>

          <p style={{ color: 'rgba(234,241,251,0.4)' }} className="mt-5 text-md font-medium">
          Cancele quando quiser
          </p>

          {/* Vídeo Showcase Hero */}
          <div className="mt-16 mx-auto w-full max-w-4xl relative">
            {/* Sombreamento nas bordas para fundir suavemente */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#070C18] via-transparent to-[#070C18] z-10 pointer-events-none opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070C18] via-transparent to-[#070C18] z-10 pointer-events-none opacity-80" />
            
            <video 
              src="/videoIntro.mp4" 
              autoPlay 
              loop 
              muted 
              playsInline 
              className="w-full h-auto object-contain opacity-90 mix-blend-screen"
              style={{ maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)' }}
            />
          </div>
        </div>
      </section>

      {/* ── Recursos ── */}
      <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'rgba(10,92,196,0.03)' }} className="py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
              Tecnologia Enterprise acessível ao seu negócio.
            </h2>
            <p style={{ color: 'rgba(234,241,251,0.5)' }} className="mt-4 text-lg">
              Ecossistema completo para gestão gastronômica de alta performance, projetado para escalar o seu delivery.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Menu de Recursos */}
            <div className="flex flex-col gap-3 lg:w-1/2">
              {RECURSOS.map((r) => {
                const isActive = activeTab === r.id;
                return (
                  <div 
                    key={r.id}
                    onClick={() => setActiveTab(r.id)}
                    className={`group cursor-pointer rounded-2xl border transition-all duration-300 p-6 ${
                      isActive 
                        ? 'bg-[rgba(10,92,196,0.1)] border-[rgba(10,92,196,0.4)] shadow-[0_0_30px_rgba(10,92,196,0.15)]' 
                        : 'bg-[#0B1120]/40 border-gray-800 hover:border-gray-700 hover:bg-[#0B1120]/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div 
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-inner ${
                            isActive 
                              ? 'bg-gradient-to-br from-[var(--cor-primaria)] to-[var(--cor-secundaria)] text-white scale-110'
                              : 'bg-gray-800/50 text-gray-400 group-hover:text-[var(--cor-primaria)]'
                          }`}
                        >
                          {r.icon}
                        </div>
                        <h3 style={{ fontFamily: "'Sora', sans-serif" }} className={`text-xl font-bold transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`}>
                          {r.titulo}
                        </h3>
                      </div>
                      <ChevronRight size={20} className={`transition-transform duration-300 ${isActive ? 'text-[var(--cor-primaria)] rotate-90' : 'text-gray-600'}`} />
                    </div>
                    
                    <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isActive ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                      <p style={{ color: 'rgba(234,241,251,0.65)' }} className="leading-relaxed text-sm font-medium mb-3">
                        {r.texto}
                      </p>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        {r.detalhe}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Área do Mockup Visual */}
            <div className="lg:w-1/2">
              <div className="sticky top-32 rounded-3xl border border-[rgba(10,92,196,0.3)] bg-[#070C18]/80 backdrop-blur-xl p-2 shadow-[0_0_50px_rgba(10,92,196,0.1)] h-[500px] overflow-hidden flex flex-col">
                {/* Header estilo janela do Mac */}
                <div className="flex items-center gap-2 px-4 py-3 bg-black/40 rounded-t-2xl border-b border-gray-800">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  <div className="ml-4 text-xs text-gray-500 font-mono">miseon.com/admin</div>
                </div>
                {/* Mockup Dinâmico */}
                <div className="flex-1 bg-black/20 p-6 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#070C18] z-0 pointer-events-none opacity-50" />
                  <div className="relative z-10 w-full h-full transition-all duration-500 animate-in fade-in zoom-in-95">
                    {RECURSOS.find(r => r.id === activeTab)?.mockup}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 Pilares da Marca (do manual) ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: 'rgba(10,92,196,0.04)' }} className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 18 }}>05 — Por que MiseOn</div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { label: 'CONTROLE', bg: 'rgba(0,65,152,.28)', text: 'O estoque baixa por ficha técnica a cada pedido aceito. Custo, margem e lucro por produto — auditáveis.' },
              { label: 'TEMPO REAL', bg: 'rgba(252,91,36,.2)', text: 'Pedidos chegam na hora ao painel. Pix integrado, comanda na cozinha e entrega acompanhada do fogão ao caixa.' },
              { label: 'MARCA PRÓPRIA', bg: 'rgba(255,255,255,.03)', text: 'Cada loja com seu link, seu cardápio e seu visual. Multi-loja na mesma plataforma, uma identidade por trás.' },
            ].map(p => (
              <div key={p.label} style={{ background: `linear-gradient(160deg,${p.bg},rgba(255,255,255,.02))`, border: '1px solid rgba(255,255,255,.09)', borderRadius: 20, padding: 30 }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 15, color: '#FC5B24', letterSpacing: '.04em', marginBottom: 12 }}>{p.label}</div>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: '#AEB9CE', margin: 0 }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold sm:text-5xl">
            Pare de dar seu lucro<br />para aplicativos.
          </h2>

          <div
            style={{ border: '1px solid rgba(252,91,36,0.25)', background: 'rgba(10,92,196,0.06)', borderRadius: 32, position: 'relative', overflow: 'hidden' }}
            className="mx-auto mt-14 max-w-lg shadow-2xl"
          >
            {/* Topo degradê */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #FC5B24, #0A5CC4)', position: 'absolute', top: 0, left: 0, right: 0 }} />
            <div className="p-8 sm:p-10">
              <p style={{ color: '#FC5B24', fontFamily: "'Sora', sans-serif" }} className="text-sm font-extrabold uppercase tracking-widest">Plano Completo</p>
              <div style={{ fontFamily: "'Sora', sans-serif" }} className="mt-4 flex items-center justify-center text-6xl font-extrabold tracking-tight">
                <span style={{ color: 'rgba(234,241,251,0.4)' }} className="text-2xl mr-2">R$</span>
                <span>150</span>
                <span style={{ color: 'rgba(234,241,251,0.4)' }} className="text-xl font-medium">/mês</span>
              </div>
              <p style={{ color: 'rgba(234,241,251,0.4)' }} className="mt-3 text-sm">Valor fixo. Sem pegadinhas, sem taxas extras.</p>

              <ul className="mt-8 space-y-3 text-left">
                {CHECKLIST.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <Check size={16} style={{ color: '#FC5B24', flexShrink: 0 }} />
                    <span style={{ color: 'rgba(234,241,251,0.75)' }}>{item}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/cadastre-se"
                style={{ background: '#FC5B24', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 24px rgba(252,91,36,0.4)' }}
                className="mt-10 block w-full rounded-full py-4 text-center text-lg font-extrabold text-white transition hover:brightness-110 hover:scale-105"
              >
                Começar Agora — Grátis
              </a>
              <p style={{ color: 'rgba(234,241,251,0.35)' }} className="mt-3 text-xs">
                14 dias grátis. Sem cartão.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(10,92,196,0.15)' }} className="py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="mb-8 md:mb-0">
              <MiseOnLogo size={160} />
              <p className="mt-4 text-sm opacity-60 max-w-xs">
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs" style={{ color: 'rgba(234,241,251,0.4)' }}>
              <a href="/termos" className="hover:text-white transition">Termos de Uso</a>
              <a href="/privacidade" className="hover:text-white transition">Privacidade</a>
              <a href={zap('Olá! Preciso de suporte MiseOn')} className="hover:text-white transition">Suporte</a>
            </div>
            <p style={{ color: 'rgba(234,241,251,0.3)' }} className="text-xs">
              © 2026 MiseOn. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
