import MiseOnLogo from '../components/MiseOnLogo';

import HeroSection from '../components/home/HeroSection';
import PainPoints from '../components/home/PainPoints';
import FeaturesGrid from '../components/home/FeaturesGrid';
import Testimonials from '../components/home/Testimonials';
import Pricing from '../components/home/Pricing';
import FaqSection from '../components/home/FaqSection';
import Showcase from '../components/home/Showcase';
import ComparativoSection from '../components/home/ComparativoSection';

const WHATSAPP_VENDAS = '5511919889233';
const zap = (msg: string) => `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

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
          <div className="drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] filter">
            <MiseOnLogo size={140} />
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/acesso"
              style={{ color: '#EAF1FB' }}
              className="hidden text-sm font-semibold opacity-70 transition hover:opacity-100 sm:inline"
            >
              Acessos
            </a>
            <a
              href="/cadastre-se"
              style={{ background: '#FC5B24', color: '#fff', fontFamily: "'Sora', sans-serif" }}
              className="rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition hover:scale-105 hover:brightness-110"
            >
              Criar minha loja
            </a>
          </div>
        </div>
      </nav>

      {/* ── Módulos ── */}
      <HeroSection />
      <PainPoints />
      <FeaturesGrid />
      <Showcase />
      <ComparativoSection />
      <Testimonials />
      <Pricing />
      <FaqSection />

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(10,92,196,0.15)' }} className="py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="mb-8 md:mb-0">
              <MiseOnLogo size={160} />
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs" style={{ color: 'rgba(234,241,251,0.4)' }}>
              <a href="/termos" className="transition hover:text-white">Termos de Uso</a>
              <a href="/privacidade" className="transition hover:text-white">Privacidade</a>
              <a href={zap('Olá! Preciso de suporte MiseOn')} className="transition hover:text-white">Suporte</a>
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
