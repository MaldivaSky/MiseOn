import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, ArrowRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MiseOnLogo from '../components/MiseOnLogo';
import { MiseOnLoader } from '../components/MiseOnLoader';

interface LojaResumo {
  slug: string;
  nome: string;
  descricao?: string;
  logo_url?: string;
  banner_url?: string;
  endereco?: string;
  cor_primaria: string;
}

export default function Lojas() {
  const [lojas, setLojas] = useState<LojaResumo[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lojas')
        .select('slug, nome, descricao, logo_url, banner_url, endereco, cor_primaria')
        .eq('ativo', true)
        .order('nome');
      setLojas((data as LojaResumo[]) ?? []);
      setCarregando(false);
    })();
  }, []);

  const visiveis = lojas.filter((l) => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div style={{ background: '#070C18', color: '#EAF1FB', fontFamily: "'Inter', sans-serif" }} className="min-h-screen">
      {/* Glow */}
      <div style={{ background: 'radial-gradient(circle, rgba(252,91,36,0.20) 0%, transparent 70%)', width: 500, height: 500, borderRadius: '50%', position: 'absolute', top: -180, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }} />

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" style={{ color: 'rgba(234,241,251,0.6)' }} className="flex items-center gap-1 text-sm font-medium transition hover:text-white">
            <ChevronLeft size={16} /> Início
          </Link>
          <Link to="/"><MiseOnLogo size={110} /></Link>
        </div>

        <h1 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight">Lojas na MiseOn</h1>
        <p style={{ color: 'rgba(234,241,251,0.6)' }} className="mt-1 mb-5 text-sm">Escolha uma loja e peça direto pelo cardápio, sem app.</p>

        {/* Busca */}
        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          className="mb-5 flex items-center gap-2 rounded-2xl px-4 py-3 transition-all duration-300 focus-within:border-[#FC5B24]/50 focus-within:shadow-[0_0_0_4px_rgba(252,91,36,0.10)]">
          <Search size={18} style={{ color: 'rgba(234,241,251,0.5)' }} className="transition-colors group-focus-within:text-[#FC5B24]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja…"
            style={{ color: '#EAF1FB' }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[rgba(234,241,251,0.4)]" />
        </div>

        {carregando ? (
          <div className="py-10"><MiseOnLoader status="Buscando lojas na sua região" rows={3} /></div>
        ) : (
          <div className="space-y-3">
            {visiveis.map((l, i) => (
              <Link key={l.slug} to={`/${l.slug}`}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  ['--glow' as string]: `${l.cor_primaria || '#FC5B24'}55`,
                  animationDelay: `${i * 70}ms`,
                }}
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 transition-all duration-300 ease-out
                           animate-in fade-in slide-in-from-bottom-3 fill-mode-both
                           hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06]
                           hover:shadow-[0_18px_50px_-14px_var(--glow)]">
                {/* barra de cor da loja que cresce no hover */}
                <span aria-hidden className="absolute left-0 top-0 h-full w-1 origin-top scale-y-0 transition-transform duration-300 group-hover:scale-y-100"
                  style={{ background: l.cor_primaria }} />
                {/* wash sutil na cor da loja */}
                <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: `linear-gradient(100deg, ${l.cor_primaria}14, transparent 60%)` }} />

                {l.logo_url
                  ? <img src={l.logo_url} className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-lg transition-transform duration-300 group-hover:scale-105" alt="" />
                  : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-black text-white shadow-lg transition-transform duration-300 group-hover:scale-105" style={{ background: l.cor_primaria }}>
                      {l.nome.trim()[0]?.toUpperCase()}
                    </div>}
                <div className="relative z-10 min-w-0 flex-1">
                  <p style={{ fontFamily: "'Sora', sans-serif" }} className="truncate text-base font-bold text-white">{l.nome}</p>
                  {l.descricao && <p className="truncate text-xs" style={{ color: 'rgba(234,241,251,0.6)' }}>{l.descricao}</p>}
                  {l.endereco && <p className="mt-1 flex items-center gap-1 truncate text-xs" style={{ color: 'rgba(234,241,251,0.45)' }}><MapPin size={11} /> {l.endereco}</p>}
                </div>
                <ArrowRight size={18} style={{ color: 'rgba(234,241,251,0.4)' }} className="relative z-10 shrink-0 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white" />
              </Link>
            ))}
            {visiveis.length === 0 && <p className="py-16 text-center text-sm" style={{ color: 'rgba(234,241,251,0.5)' }}>Nenhuma loja encontrada.</p>}
          </div>
        )}

        <Link to="/cadastre-se"
          style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(234,241,251,0.75)' }}
          className="group relative mt-8 flex items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FC5B24]/60 hover:shadow-[0_10px_40px_-8px_rgba(252,91,36,0.45)]">
          {/* brilho passando */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
          {/* wash de cor no hover */}
          <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: 'linear-gradient(135deg, rgba(252,91,36,0.16), rgba(10,92,196,0.16))' }} />
          <span className="relative z-10 flex items-center gap-2 transition-colors duration-300 group-hover:text-white">
            Tem uma loja? <b className="font-extrabold" style={{ fontFamily: "'Sora', sans-serif" }}>Cadastre aqui</b>
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}
