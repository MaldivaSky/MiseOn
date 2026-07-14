import { ShoppingBag, Bike, Boxes, QrCode, ArrowRight, Zap, Check, Star } from 'lucide-react';

const WHATSAPP_VENDAS = '5511919889233';
const zap = (msg: string) => `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

// Logo SVG oficial extraído do manual da marca MiseOn
function MiseOnLogo({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 380 210" xmlns="http://www.w3.org/2000/svg">
      {/* Ícone do chapéu de chef / seta ascendente */}
      <g transform="translate(70 110)">
        <path d="M-60 80 L-20 -30 L10 10 L60 -70" fill="none" stroke="#0A5CC4" strokeWidth="23" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 10 L60 -70" fill="none" stroke="#FC5B24" strokeWidth="23" strokeLinecap="round" strokeLinejoin="round"/>
        <polygon points="70,-80 35,-70 60,-35" fill="#FC5B24"/>
        <circle cx="-20" cy="-50" r="23" fill="#EAF1FB" stroke="#0A5CC4" strokeWidth="5"/>
      </g>
      {/* Nome MISE ON */}
      <text x="155" y="125" fontFamily="Sora,sans-serif" fontSize="72" fontWeight="800" letterSpacing="4">
        <tspan fill="#0A5CC4">MISE</tspan><tspan fill="#FC5B24"> ON</tspan>
      </text>
    </svg>
  );
}

const RECURSOS = [
  { icon: <ShoppingBag size={28} />, titulo: 'Cardápio Digital KDS', texto: 'Seu cliente pede pelo celular e o pedido cai direto na tela KDS da cozinha. Sem intermediários, sem atrasos.' },
  { icon: <Boxes size={28} />, titulo: 'Estoque Inteligente', texto: 'Cada venda dá baixa automática nos ingredientes pela Ficha Técnica. Saiba exatamente o que comprar.' },
  { icon: <QrCode size={28} />, titulo: 'Split Efí Bank', texto: 'O dinheiro do Pix e Cartão cai direto na sua conta bancária oficial. Nós não tocamos no seu dinheiro.' },
  { icon: <Bike size={28} />, titulo: 'Logística de Entrega', texto: 'Sistema integrado de rotas para o seu motoboy, com acompanhamento em tempo real para o cliente.' },
];

const CHECKLIST = [
  'Cardápio Digital + QR Code',
  'KDS (Tela da Cozinha)',
  'Controle de Estoque com Ficha Técnica',
  'Pagamentos Pix + Cartão (Efí Bank)',
  'App de Entregas para Motoboy',
  'CRM de Clientes e Recompras',
  'Painel SuperAdmin multi-restaurante',
  'IA para descrever produtos',
];

export default function Home() {
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
          <img src="/brand/logo.png" alt="MiseOn" style={{ height: 44 }} />
          <div className="flex items-center gap-4">
            <a
              href="/admin/login"
              style={{ color: '#EAF1FB' }}
              className="hidden text-sm font-semibold opacity-70 transition hover:opacity-100 sm:block"
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
            Abandone as planilhas e as taxas abusivas. Cardápio digital, comanda KDS, baixa automática de estoque por ficha técnica e pagamento direto na sua conta.
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

          <p style={{ color: 'rgba(234,241,251,0.4)' }} className="mt-5 text-sm font-medium">
            Sem cartão de crédito · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── Recursos ── */}
      <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'rgba(10,92,196,0.03)' }} className="py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Nível Enterprise, preço de padaria.
            </h2>
            <p style={{ color: 'rgba(234,241,251,0.5)' }} className="mt-4 text-lg">
              Tudo que as grandes redes usam, agora disponível para o seu delivery.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {RECURSOS.map((r, i) => (
              <div
                key={i}
                style={{ border: '1px solid rgba(10,92,196,0.2)', background: 'rgba(10,92,196,0.05)', borderRadius: 24 }}
                className="group p-8 transition hover:border-blue-500/50 hover:bg-blue-500/10"
              >
                <div
                  style={{ background: 'rgba(10,92,196,0.2)', color: '#0A5CC4', borderRadius: 16, width: 56, height: 56 }}
                  className="mb-5 flex items-center justify-center group-hover:scale-110 transition-transform"
                >
                  {r.icon}
                </div>
                <h3 style={{ fontFamily: "'Sora', sans-serif" }} className="mb-3 text-xl font-bold">{r.titulo}</h3>
                <p style={{ color: 'rgba(234,241,251,0.55)' }} className="leading-relaxed">{r.texto}</p>
              </div>
            ))}
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
            <img src="/brand/logo.png" alt="MiseOn" style={{ height: 48, opacity: 1 }} />
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
