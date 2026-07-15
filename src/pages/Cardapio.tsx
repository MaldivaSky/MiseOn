import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { ShoppingBag, Plus, Minus, X, Search, Clock, MapPin, Star, LogIn, LogOut, History, Lock, ShieldCheck, User as UserIcon, Trash2, QrCode, Copy, CheckCircle, CreditCard, Loader2, ChevronLeft, Check, ArrowRight, Sparkles, Compass } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { maskCartaoCredito, maskValidadeCartao, maskCPF, validarCPF } from '../lib/mascaras';
import ModalAuthCliente from '../components/ModalAuthCliente';
import ModalMinhaConta from '../components/ModalMinhaConta';
import EnderecoMixin, { EnderecoFormData } from '../components/EnderecoMixin';
import {
  Loja, Banner, Categoria, Produto, Cupom, TaxaEntrega, FaixaEntrega, ItemCarrinho, Cliente,
  HorarioFuncionamento, MetodoPgto, fmt, precoItem,
} from '../types';
import { fonteFamilia, isLightColor, obterFundoLojaPorTema, obterTokensLoja } from '../lib/personalizacao';
import { aplicarTema, obterTemaPreferido, type PreferenciaTema } from '../lib/tema';
import CheckoutDrawer from '../components/CheckoutDrawer';
import ThemeToggle from '../components/ThemeToggle';

const guardarUltimoPedido = (slug: string | undefined, pedidoId: string, numero: number) => {
  if (!slug) return;
  localStorage.setItem(`miseon_ultimo_pedido_${slug}`, JSON.stringify({
    pedidoId,
    numero,
    salvoEm: new Date().toISOString(),
  }));
};

const entrarComGoogle = (voltarPara: string) =>
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: voltarPara } });

// ── Loja aberta? (horário automático + override manual) ─────
function lojaAberta(loja: Loja | null, horarios: HorarioFuncionamento[]): boolean {
  if (!loja) return false;
  if (loja.aberto_manual !== null && loja.aberto_manual !== undefined) return loja.aberto_manual;
  const agora = new Date();
  const hoje = horarios.filter((h) => h.dia_semana === agora.getDay());
  const hm = agora.toTimeString().slice(0, 5);
  return hoje.some((h) => hm >= h.abre.slice(0, 5) && hm <= h.fecha.slice(0, 5));
}

export default function Cardapio() {
  const { slug } = useParams();
  const [loja, setLoja] = useState<Loja | null>(null);
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [taxas, setTaxas] = useState<TaxaEntrega[]>([]);
  const [faixasDistancia, setFaixasDistancia] = useState<FaixaEntrega[]>([]);
  const [busca, setBusca] = useState('');
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [modalAuthAberto, setModalAuthAberto] = useState(false);
  const [modalContaAberto, setModalContaAberto] = useState(false);
  
  const cartKey = `cart_${slug}`;
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>(() => {
    try {
      const salvo = localStorage.getItem(cartKey);
      return salvo ? JSON.parse(salvo) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (carrinho.length > 0) localStorage.setItem(cartKey, JSON.stringify(carrinho));
    else localStorage.removeItem(cartKey);
  }, [carrinho, cartKey]);

  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [pedidoNumero, setPedidoNumero] = useState<number | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [pix, setPix] = useState<{ copia_e_cola: string; qr_imagem?: string } | null>(null);
  const [cartao, setCartao] = useState<{ pedidoId: string; numero: number; total: number } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [temaCliente, setTemaCliente] = useState<PreferenciaTema>(() => obterTemaPreferido());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    // Só atualiza se o usuário realmente mudou. O Supabase dispara SIGNED_IN/TOKEN_REFRESHED
    // ao focar a aba; sem esta guarda, cada foco recria o objeto user e re-renderiza tudo
    // (podendo atrapalhar quem está digitando o cartão).
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) =>
      setUser((prev) => (prev?.id === session?.user?.id ? prev : (session?.user ?? null))),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Escuta o pagamento Pix em tempo real
  useEffect(() => {
    if (!pedidoId || !pix) return;
    const canal = supabase
      .channel(`pagamento-${pedidoId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagamentos', filter: `pedido_id=eq.${pedidoId}` },
        (payload) => {
          if (payload.new.status === 'PAGO') {
             // O banco confirmou! Tira o QR Code da tela e mostra a tela verde de sucesso
             setPix(null);
             
             // Opcional: Tocar um som de 'caixa registradora' ou 'sucesso'
             try { new Audio('/notificacao.mp3').play(); } catch(e) {}
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [pedidoId, pix]);

  useEffect(() => {
    if (!slug) return;
    localStorage.setItem('miseon_ultima_loja', slug);
    (async () => {
      const { data: l } = await supabase.from('lojas').select('*').eq('slug', slug).single();
      if (!l) return;
      setLoja(l);
      const [h, b, c, p, t, f, est] = await Promise.all([
        supabase.from('horarios_funcionamento').select('*').eq('loja_id', l.id),
        supabase.from('banners_destaque').select('*').eq('loja_id', l.id).order('ordem_exibicao'),
        supabase.from('categorias').select('*').eq('loja_id', l.id).order('ordem'),
        supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*))').eq('loja_id', l.id).order('ordem'),
        supabase.from('taxas_entrega').select('*').eq('loja_id', l.id),
        supabase.from('faixas_entrega').select('*').eq('loja_id', l.id).eq('ativo', true).order('ordem').order('km_ate'),
        supabase.rpc('fn_produtos_com_estoque', { p_loja_id: l.id }),
      ]);
      setHorarios(h.data ?? []);
      setBanners(b.data ?? []);
      setCategorias(c.data ?? []);
      // disponivel = o lojista quer vender; tem_estoque = os insumos da ficha técnica
      // ainda alcançam pra fazer o produto — os dois juntos decidem se aparece pra compra
      const mapaEstoque = new Map<string, boolean>((est.data ?? []).map((e: any) => [e.produto_id, e.tem_estoque]));
      setProdutos((p.data ?? []).map((prod: Produto) => ({ ...prod, tem_estoque: mapaEstoque.get(prod.id) ?? true })));
      setTaxas(t.data ?? []);
      setFaixasDistancia((f.data as FaixaEntrega[]) ?? []);
      document.title = `${l.nome} — Peça online`;
    })();
  }, [slug]);

  useEffect(() => {
    if (!loja) return;
    const padrao = loja.tema_cardapio === 'escuro' ? 'escuro' : 'claro';
    setTemaCliente(obterTemaPreferido(padrao));
    const sincronizarTema = (event: Event) => {
      const tema = (event as CustomEvent<{ tema: PreferenciaTema }>).detail?.tema;
      if (tema === 'claro' || tema === 'escuro') setTemaCliente(tema);
    };
    window.addEventListener('miseon:tema', sincronizarTema as EventListener);
    return () => window.removeEventListener('miseon:tema', sincronizarTema as EventListener);
  }, [loja?.id, loja?.tema_cardapio]);

  useEffect(() => {
    if (!loja) return;
    const raiz = document.documentElement;
    const fundo = obterFundoLojaPorTema(temaCliente, loja);
    const tokens = obterTokensLoja(fundo, temaCliente, loja.cor_texto || loja.cor_primaria || '#FC5B24');
    raiz.style.setProperty('--cor-fundo', fundo);
    raiz.style.setProperty('--cor-primaria', loja.cor_primaria || '#FC5B24');
    raiz.style.setProperty('--cor-secundaria', loja.cor_secundaria || '#0A5CC4');
    raiz.style.setProperty('--fonte-loja', fonteFamilia(loja.fonte));
    raiz.style.setProperty('--cor-texto', tokens.texto);
    raiz.style.setProperty('--cor-texto-suave', tokens.textoSuave);
    raiz.style.setProperty('--cor-texto-fraco', tokens.textoFraco);
    raiz.style.setProperty('--cor-surface', tokens.surface);
    raiz.style.setProperty('--cor-surface-muted', tokens.surfaceMuted);
    raiz.style.setProperty('--cor-card', tokens.card);
    raiz.style.setProperty('--cor-borda', tokens.border);
    raiz.style.setProperty('--cor-borda-forte', tokens.borderStrong);
    raiz.style.setProperty('--cor-destaque', tokens.destaque);
    aplicarTema(temaCliente);
  }, [loja, temaCliente]);

  const aberta = lojaAberta(loja, horarios);

  const maisPedidos = useMemo(
    () => [...produtos].sort((a, b) => b.vendidos - a.vendidos).slice(0, 6).filter((p) => p.vendidos > 0),
    [produtos],
  );

  const visiveis = useMemo(
    () =>
      produtos.filter(
        (p) =>
          (!catAtiva || p.categoria_id === catAtiva) &&
          (!busca || p.nome.toLowerCase().includes(busca.toLowerCase())),
      ),
    [produtos, catAtiva, busca],
  );

  const totalCarrinho = carrinho.reduce((s, i) => s + precoItem(i), 0);
  const qtdCarrinho = carrinho.reduce((s, i) => s + i.quantidade, 0);

  const addAoCarrinho = (item: ItemCarrinho) => {
    setCarrinho((c) => [...c, item]);
    setProdutoAberto(null);
  };

  if (!loja)
    return <div className="flex h-screen items-center justify-center text-gray-400">Carregando cardápio…</div>;

  const iniciais = loja.nome.trim() ? loja.nome.trim()[0].toUpperCase() : '?';

  return (
    <div className="loja-marca min-h-screen pb-28 lg:pb-16">
      {/* Hero — banner com gradiente da marca, logo/nome sobrepostos */}
      <header className="relative">
        <div
          className="relative h-48 w-full overflow-hidden sm:h-64 lg:h-80"
          style={{ background: `linear-gradient(135deg, ${loja.cor_primaria}, ${loja.cor_secundaria})` }}
        >
          {loja.banner_url && <img src={loja.banner_url} className="h-full w-full object-cover" alt="" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
          <div className="absolute left-3 top-3 sm:left-6 sm:top-6">
            <Link
              to="/lojas"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/30"
            >
              <Compass size={14} /> Hall de lojas
            </Link>
          </div>
          <div className="absolute right-3 top-3 flex gap-2 sm:right-6 sm:top-6">
            <ThemeToggle className="rounded-full border border-white/30 bg-black/20 p-2 text-white backdrop-blur-sm transition hover:bg-black/30" />
            {user ? (
              <>
                <Link to={`/${slug}/meus-pedidos`} title="Meus pedidos"
                  className="rounded-full border border-white/30 bg-black/20 p-2 text-white backdrop-blur-sm transition hover:bg-black/30">
                  <History size={16} />
                </Link>
                <button onClick={() => setModalContaAberto(true)} title="Minha Conta"
                  className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/30">
                  <UserIcon size={14} /> Minha Conta
                </button>
              </>
            ) : (
              <button onClick={() => setModalAuthAberto(true)}
                className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/30">
                <LogIn size={14} /> Entrar
              </button>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto flex max-w-6xl items-end gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
              {loja.logo_url
                ? <img src={loja.logo_url} className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/40 object-cover shadow-xl sm:h-24 sm:w-24" alt="" />
                : <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white/40 text-2xl font-bold shadow-xl backdrop-blur-sm sm:h-24 sm:w-24 sm:text-4xl"
                    style={{ background: loja.cor_primaria, color: isLightColor(loja.cor_primaria) ? '#111827' : '#ffffff' }}
                  >
                    {iniciais}
                  </div>}
              <div className="min-w-0 pb-1 text-white">
                <h1 className="truncate text-xl font-bold drop-shadow sm:text-3xl">{loja.nome}</h1>
                <p className="flex items-center gap-1 truncate text-xs text-white/85 sm:text-sm">
                  <MapPin size={12} /> {loja.endereco}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold backdrop-blur-sm ${aberta ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                    <Clock size={11} /> {aberta ? 'Aberto agora' : 'Fechado'}
                  </span>
                  {loja.pedido_minimo > 0 && (
                    <span className="rounded-full px-2 py-0.5 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.92)', color: '#111827' }}>
                      Pedido mín. {fmt(loja.pedido_minimo)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Carrossel de banners promocionais */}
      {banners.length > 0 && (
        <div className="mx-auto max-w-6xl">
          <div className="flex snap-x gap-4 overflow-x-auto p-4 sm:px-6 pb-6 hide-scrollbar">
            {banners.map((b) => (
              <div key={b.id} className="shrink-0 snap-center flex w-72 flex-col gap-2 sm:w-96">
                {b.link_redirecionamento ? (
                  <a href={b.link_redirecionamento} target="_blank" rel="noreferrer" className="vitrine-card block w-full rounded-[22px]">
                    <img src={b.imagem_url} alt={b.titulo ?? ''} className="vitrine-card-media h-32 w-full object-cover sm:h-40" />
                  </a>
                ) : (
                  <div className="vitrine-card rounded-[22px]">
                    <img src={b.imagem_url} alt={b.titulo ?? ''} className="vitrine-card-media h-32 w-full object-cover sm:h-40" />
                  </div>
                )}
                {b.titulo && (
                  <p className="truncate px-2 text-sm font-bold" style={{ color: 'var(--cor-texto)' }}>{b.titulo}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6 lg:px-6 lg:pt-4">
        <main className="min-w-0">
          {/* Busca */}
          <div className="px-4 pt-2 lg:px-0">
            <div className="vitrine-search flex items-center gap-2 rounded-2xl px-4 py-3">
              <Search size={16} style={{ color: 'var(--cor-texto-fraco)' }} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no cardápio…"
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: 'var(--cor-texto)' }}
              />
            </div>
          </div>

          {/* Filtros de categoria */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3 lg:px-0">
            <button
              onClick={() => setCatAtiva(null)}
              className={`vitrine-chip shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${!catAtiva ? 'is-active' : ''}`}
            >
              Tudo
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatAtiva(c.id === catAtiva ? null : c.id)}
                className={`vitrine-chip shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${catAtiva === c.id ? 'is-active' : ''}`}
              >
                {c.nome}
              </button>
            ))}
          </div>

          {/* Os mais pedidos */}
          {!busca && !catAtiva && maisPedidos.length > 0 && (
            <section className="px-4 lg:px-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-black" style={{ color: 'var(--cor-texto)' }}>
                  <Star size={16} className="text-amber-500" /> Os mais pedidos
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-texto-suave)' }}>
                  <Sparkles size={12} /> Selecionados pela casa
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {maisPedidos.map((p) => (
                  <button key={p.id} onClick={() => p.tem_estoque !== false && setProdutoAberto(p)}
                    disabled={p.tem_estoque === false}
                    className={`vitrine-card relative w-40 shrink-0 rounded-[24px] p-2.5 text-left ${p.tem_estoque === false ? 'opacity-50' : ''}`}>
                    {p.imagem_url && <img src={p.imagem_url} className="vitrine-card-media mb-2 h-24 w-full rounded-2xl object-cover" alt="" />}
                    {p.tem_estoque === false && (
                      <span className="absolute right-3 top-3 rounded-full bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-white">ESGOTADO</span>
                    )}
                    <p className="line-clamp-2 text-sm font-bold" style={{ color: 'var(--cor-texto)' }}>{p.nome}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm font-black text-[var(--cor-primaria)]">{fmt(Number(p.preco))}</p>
                      <span className="vitrine-card-cta inline-flex items-center gap-1 text-[11px] font-semibold">
                        Ver <ArrowRight size={13} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Lista por categoria — grid no desktop, lista no mobile */}
          {categorias
            .filter((c) => !catAtiva || c.id === catAtiva)
            .map((c) => {
              const doGrupo = visiveis.filter((p) => p.categoria_id === c.id);
              if (!doGrupo.length) return null;
              return (
                <section key={c.id} className="px-4 pt-4 lg:px-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-black" style={{ color: 'var(--cor-texto)' }}>{c.nome}</h2>
                    <span className="text-xs font-semibold" style={{ color: 'var(--cor-texto-fraco)' }}>{doGrupo.length} opcoes</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {doGrupo.map((p) => (
                      <button key={p.id} onClick={() => p.tem_estoque !== false && setProdutoAberto(p)}
                        disabled={p.tem_estoque === false}
                        className={`vitrine-card flex w-full gap-3 rounded-[24px] p-2.5 text-left ${p.tem_estoque === false ? 'opacity-50' : ''}`}>
                        {p.imagem_url && <img src={p.imagem_url} className="vitrine-card-media h-24 w-24 shrink-0 rounded-2xl object-cover" alt="" />}
                        <div className="min-w-0 flex-1 py-3 pr-3">
                          <p className="flex flex-wrap items-center gap-2 font-bold" style={{ color: 'var(--cor-texto)' }}>
                            {p.nome}
                            {p.tem_estoque === false && (
                              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-white">ESGOTADO</span>
                            )}
                          </p>
                          {p.descricao && <p className="line-clamp-2 text-xs" style={{ color: 'var(--cor-texto-suave)' }}>{p.descricao}</p>}
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="font-black text-[var(--cor-primaria)]">{fmt(Number(p.preco))}</p>
                            <span className="vitrine-card-cta inline-flex items-center gap-1 text-xs font-semibold">
                              Personalizar <ArrowRight size={14} />
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
        </main>

        {/* Carrinho — barra flutuante no mobile, painel fixo no desktop */}
        <aside className="hidden lg:sticky lg:top-4 lg:block">
          <div className="vitrine-panel overflow-hidden rounded-[28px] p-4">
            <div className="mb-4 rounded-[22px] p-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cor-primaria) 18%, transparent), color-mix(in srgb, var(--cor-secundaria) 10%, transparent))' }}>
              <p className="mb-1 flex items-center gap-2 font-black" style={{ color: 'var(--cor-texto)' }}><ShoppingBag size={18} /> Seu carrinho</p>
              <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>Revise seus itens e finalize com seguranca.</p>
            </div>
            {carrinho.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--cor-texto-fraco)' }}>Adicione itens do cardápio.</p>
            ) : (
              <>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {carrinho.map((i, idx) => (
                    <div key={idx} className="rounded-2xl border p-3" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
                      <div className="flex items-start justify-between text-sm leading-tight">
                        <span className="pr-2 font-semibold" style={{ color: 'var(--cor-texto)' }}>{i.produto.nome}</span>
                        <span className="font-black" style={{ color: 'var(--cor-texto)' }}>{fmt(precoItem(i))}</span>
                      </div>
                      {i.opcoesSelecionadas && i.opcoesSelecionadas.length > 0 && (
                        <p className="line-clamp-1 text-[11px]" style={{ color: 'var(--cor-texto-fraco)' }}>{i.opcoesSelecionadas.map(o => o.nome).join(', ')}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center gap-3 rounded-full border px-2.5 py-1.5" style={{ background: 'var(--cor-surface-muted)', borderColor: 'var(--cor-borda)' }}>
                          <button onClick={() => i.quantidade > 1 ? setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade - 1 } : x)) : setCarrinho(carrinho.filter((_, y) => y !== idx))} className="transition-colors hover:text-red-500" style={{ color: 'var(--cor-texto-suave)' }}><Minus size={14} /></button>
                          <span className="w-4 text-center text-xs font-bold" style={{ color: 'var(--cor-texto)' }}>{i.quantidade}</span>
                          <button onClick={() => setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade + 1 } : x))} className="transition-colors hover:text-[var(--cor-primaria)]" style={{ color: 'var(--cor-texto-suave)' }}><Plus size={14} /></button>
                        </div>
                        <button onClick={() => setCarrinho(carrinho.filter((_, y) => y !== idx))} className="transition-colors hover:text-red-500" style={{ color: 'var(--cor-texto-fraco)' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-4 font-black" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }}>
                  <span>Total</span><span>{fmt(totalCarrinho)}</span>
                </div>
                <button onClick={() => setCheckoutAberto(true)}
                  className="vitrine-floating-cart mt-4 w-full rounded-2xl py-3.5 font-bold text-white transition hover:brightness-110">
                  Finalizar pedido
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Botão do carrinho — só no mobile */}
      {qtdCarrinho > 0 && (
        <button
          onClick={() => setCheckoutAberto(true)}
          className="vitrine-floating-cart fixed bottom-4 left-1/2 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-between rounded-3xl px-5 py-3.5 font-semibold text-white lg:hidden"
        >
          <span className="flex items-center gap-2"><ShoppingBag size={18} /> {qtdCarrinho} item(ns)</span>
          <span>{fmt(totalCarrinho)}</span>
        </button>
      )}

      {produtoAberto && (
        <ModalProduto produto={produtoAberto} onClose={() => setProdutoAberto(null)} onAdd={addAoCarrinho} />
      )}
      
      {checkoutAberto && (
        <CheckoutDrawer loja={loja} aberta={aberta} carrinho={carrinho} taxas={taxas} faixasDistancia={faixasDistancia} user={user} setCarrinho={setCarrinho}
          onClose={() => setCheckoutAberto(false)} onAbrirAuth={() => setModalAuthAberto(true)}
          onCartao={(info) => { setCheckoutAberto(false); setCartao(info); }}
          onSucesso={(num, id, pixData) => {
            guardarUltimoPedido(slug, id, num);
            setCarrinho([]); setCheckoutAberto(false); setPedidoNumero(num); setPedidoId(id); setPix(pixData ?? null);
          }} />
      )}

      {cartao && <CartaoModal loja={loja} info={cartao} onFechar={() => setCartao(null)} onAprovado={() => {
        guardarUltimoPedido(slug, cartao.pedidoId, cartao.numero);
        setCartao(null); setPedidoNumero(cartao.numero); setPedidoId(cartao.pedidoId);
      }} />}

      <ModalAuthCliente isOpen={modalAuthAberto} onClose={() => setModalAuthAberto(false)} />
      
      <ModalMinhaConta 
        isOpen={modalContaAberto} 
        onClose={() => setModalContaAberto(false)} 
        lojaId={loja.id}
        userId={user?.id ?? ''}
        userEmail={user?.email}
      />

      {pedidoNumero !== null && (
        <div className="fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 shadow-2xl">
            
            {pix ? (
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600 mb-4 shadow-inner">
                  <QrCode size={32} />
                </div>
                <h3 className="text-xl font-black dark:text-gray-100 text-center">Pedido #{pedidoNumero} Reservado!</h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 text-center mt-1">
                  A cozinha começará o preparo assim que o Pix for confirmado.
                </p>

                <div className="mt-6 w-full p-5 bg-white dark:bg-gray-950 rounded-2xl border-2 border-teal-500 shadow-xl shadow-teal-500/10 relative overflow-hidden">
                   <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-400 to-teal-600"></div>
                   
                   {pix.qr_imagem ? (
                     <img src={pix.qr_imagem} alt="QR Code Pix" className="mx-auto h-48 w-48 object-contain" />
                   ) : (
                     <div className="h-48 w-48 mx-auto flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-xl">
                       <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-teal-500 rounded-full"></div>
                     </div>
                   )}
                   
                   <div className="mt-5 w-full">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Pix Copia e Cola</p>
                      <div className="flex items-center gap-2">
                        <input readOnly value={pix.copia_e_cola} 
                          className="w-full rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 text-xs text-gray-600 dark:text-gray-400 font-mono truncate focus:outline-none" />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pix.copia_e_cola);
                            const btn = document.getElementById('btn-copy-pix');
                            if(btn) {
                              btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>';
                              btn.classList.replace('bg-teal-100', 'bg-green-600');
                              btn.classList.replace('text-teal-700', 'text-white');
                              setTimeout(() => {
                                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
                                btn.classList.replace('bg-green-600', 'bg-teal-100');
                                btn.classList.replace('text-white', 'text-teal-700');
                              }, 2000);
                            }
                          }}
                          id="btn-copy-pix"
                          className="shrink-0 flex items-center justify-center p-3 rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 hover:bg-teal-200 transition-colors"
                        >
                          <Copy size={18} />
                        </button>
                      </div>
                   </div>
                </div>

                <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-500">
                   <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                   Aguardando confirmação do banco...
                </div>
                
                <div className="mt-4 flex w-full gap-2">
                  <Link to="/lojas"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-white">
                    Ver outras lojas
                  </Link>
                  <button onClick={() => { setPedidoNumero(null); setPix(null); setPedidoId(null); }} 
                    className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 py-3.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-200">
                    Fechar
                  </button>
                  <a href={`/pedido/${pedidoId}`}
                    className="flex-1 text-center rounded-xl bg-[var(--cor-primaria)] py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                    Ver Pedido
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4 shadow-inner">
                  <CheckCircle size={32} />
                </div>
                <h3 className="text-2xl font-black dark:text-gray-100 text-center">Pedido #{pedidoNumero} Recebido!</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                  A cozinha já foi notificada e logo iniciará o preparo do seu pedido.
                </p>
                <a href={`/pedido/${pedidoId}`}
                  className="mt-6 flex w-full items-center justify-center rounded-xl bg-[var(--cor-primaria)] py-4 font-semibold text-white shadow-md hover:shadow-lg transition-all">
                  Acompanhar meu pedido
                </a>
                <button onClick={() => { setPedidoNumero(null); setPix(null); setPedidoId(null); }} 
                  className="mt-3 w-full rounded-xl py-3 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Voltar ao Cardápio
                </button>
              </div>
            )}
            
            <p className="mt-5 text-center text-[10px] font-semibold text-gray-400 flex items-center justify-center gap-1">
              <ShieldCheck size={12} /> Transação protegida de ponta a ponta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal do produto (opções/extras + observação) ───────────
function ModalProduto({ produto, onClose, onAdd }: {
  produto: Produto;
  onClose: () => void;
  onAdd: (i: ItemCarrinho) => void;
}) {
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');
  const [sel, setSel] = useState<Record<string, string[]>>({}); // grupo_id -> opcao_ids

  const grupos = produto.grupos_opcoes ?? [];
  const opcoesSelecionadas = grupos.flatMap((g) => g.opcoes.filter((o) => (sel[g.id] ?? []).includes(o.id)));
  const valido = grupos.every((g) => (sel[g.id]?.length ?? 0) >= g.min_escolhas);
  const total = (Number(produto.preco) + opcoesSelecionadas.reduce((s, o) => s + Number(o.preco_adicional), 0)) * qtd;

  const toggle = (g: { id: string; max_escolhas: number }, opcaoId: string) => {
    setSel((s) => {
      const atual = s[g.id] ?? [];
      if (atual.includes(opcaoId)) return { ...s, [g.id]: atual.filter((x) => x !== opcaoId) };
      if (atual.length >= g.max_escolhas) return g.max_escolhas === 1 ? { ...s, [g.id]: [opcaoId] } : s;
      return { ...s, [g.id]: [...atual, opcaoId] };
    });
  };

  const imgs = produto.galeria?.length ? produto.galeria : (produto.imagem_url ? [produto.imagem_url] : []);

  return (
    <div className="fade fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="sheet max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white dark:bg-gray-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        
        {imgs.length > 0 && (
          <div className="relative w-full bg-gray-100 dark:bg-gray-800">
            <div className="flex w-full snap-x snap-mandatory overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {imgs.map((url, i) => (
                <div key={i} className="min-w-full snap-center bg-black/20 flex items-center justify-center">
                  <img src={url} className="max-h-80 w-full object-contain" alt={`${produto.nome} - foto ${i+1}`} />
                </div>
              ))}
            </div>
            {imgs.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                {imgs.map((_, i) => (
                   <div key={i} className="h-1.5 w-1.5 rounded-full bg-black/30 dark:bg-white/50 backdrop-blur-sm" />
                ))}
              </div>
            )}
            {imgs.length > 1 && (
              <div className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                1/{imgs.length} <span className="opacity-70">(deslize)</span>
              </div>
            )}
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-bold dark:text-gray-100">{produto.nome}</h3>
            <button onClick={onClose} className="dark:text-gray-300"><X size={20} /></button>
          </div>
          {produto.descricao && <p className="mt-1 whitespace-pre-line text-sm text-gray-500 dark:text-gray-400">{produto.descricao}</p>}

          {grupos.map((g) => (
            <div key={g.id} className="mt-4">
              <p className="text-sm font-semibold dark:text-gray-200">
                {g.nome}{' '}
                <span className="font-normal text-gray-400">
                  ({g.min_escolhas > 0 ? `obrigatório · ` : ''}até {g.max_escolhas})
                </span>
              </p>
              <div className="mt-1 space-y-1">
                {g.opcoes.filter((o) => o.disponivel).map((o) => (
                  <label key={o.id} className="flex items-center justify-between rounded-lg border p-2 text-sm dark:border-gray-700 dark:text-gray-200">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(sel[g.id] ?? []).includes(o.id)}
                        onChange={() => toggle(g, o.id)}
                      />
                      {o.nome}
                    </span>
                    {Number(o.preco_adicional) > 0 && <span className="text-gray-500 dark:text-gray-400">+{fmt(Number(o.preco_adicional))}</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Alguma observação? Ex: sem cebola…"
            className="mt-4 w-full rounded-xl border p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            rows={2}
          />

          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border px-3 py-2 dark:border-gray-700 dark:text-gray-200">
              <button onClick={() => setQtd((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
              <span className="w-5 text-center font-semibold">{qtd}</span>
              <button onClick={() => setQtd((q) => q + 1)}><Plus size={16} /></button>
            </div>
            <button
              disabled={!valido}
              onClick={() => onAdd({ produto, quantidade: qtd, observacao: obs || undefined, opcoesSelecionadas })}
              className="flex-1 rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white disabled:opacity-40"
            >
              Adicionar {fmt(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detecção de bandeira (feedback imediato nos primeiros dígitos) ──
type Bandeira = { id: string; nome: string; re: RegExp };
const BANDEIRAS: Bandeira[] = [
  { id: 'visa', nome: 'Visa', re: /^4/ },
  { id: 'mastercard', nome: 'Mastercard', re: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/ },
  { id: 'amex', nome: 'American Express', re: /^3[47]/ },
  { id: 'elo', nome: 'Elo', re: /^(4011|4312|4389|4514|4576|5041|5066|5067|509\d|6277|6362|6363|650|651|655)/ },
  { id: 'hipercard', nome: 'Hipercard', re: /^(606282|3841)/ },
  { id: 'diners', nome: 'Diners', re: /^3(0[0-5]|[68])/ },
  { id: 'discover', nome: 'Discover', re: /^(6011|65|64[4-9])/ },
];
const detectarBandeira = (digits: string): Bandeira | null =>
  digits.length >= 4 ? (BANDEIRAS.find((b) => b.re.test(digits)) ?? null) : null;

// Luhn — valida o número do cartão localmente (some feedback antes de enviar)
const luhnValido = (digits: string): boolean => {
  if (digits.length < 13) return false;
  let soma = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    soma += n; alt = !alt;
  }
  return soma % 10 === 0;
};

// Ícone de bandeira estilo "flag" (retângulo arredondado, como no cartão real)
function BandeiraMark({ id, className = 'h-6 w-auto' }: { id: string; className?: string }) {
  const p = { viewBox: '0 0 40 26', className, role: 'img', 'aria-label': id } as const;
  switch (id) {
    case 'visa':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#fff" stroke="#E6E8EF" />
          <text x="20" y="17.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#1A1F71">VISA</text>
        </svg>
      );
    case 'mastercard':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#fff" stroke="#E6E8EF" />
          <circle cx="16.5" cy="13" r="7.5" fill="#EB001B" />
          <circle cx="23.5" cy="13" r="7.5" fill="#F79E1B" fillOpacity="0.9" />
        </svg>
      );
    case 'amex':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#1F72CF" />
          <text x="20" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="7.5" fill="#fff">AMEX</text>
        </svg>
      );
    case 'elo':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#000" />
          <text x="20" y="17.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" fill="#fff">elo</text>
        </svg>
      );
    case 'hipercard':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#822124" />
          <text x="20" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="6" fill="#fff">Hipercard</text>
        </svg>
      );
    case 'diners':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#0079BE" />
          <text x="20" y="16.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="6.5" fill="#fff">Diners</text>
        </svg>
      );
    case 'discover':
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#fff" stroke="#E6E8EF" />
          <circle cx="31" cy="17" r="6" fill="#F79E1B" />
          <text x="16" y="16.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="6" fill="#111">Discover</text>
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <rect width="40" height="26" rx="4" fill="#E5E7EB" />
        </svg>
      );
  }
}
const BANDEIRAS_ACEITAS = ['visa', 'mastercard', 'amex', 'elo', 'hipercard'];

// ── Tela dedicada de pagamento com cartão (Efí — tokenização no navegador) ──
function CartaoModal({ loja, info, onFechar, onAprovado }: {
  loja: Loja;
  info: { pedidoId: string; numero: number; total: number };
  onFechar: () => void;
  onAprovado: () => void;
}) {
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [validade, setValidade] = useState(''); // MM/AA
  const [cvv, setCvv] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);
  const [verso, setVerso] = useState(false); // vira o cartão ao focar o CVV
  const [tocado, setTocado] = useState<Record<string, boolean>>({});
  const numeroRef = useRef<HTMLInputElement>(null);

  // Comportamento de modal profissional: foco no 1º campo, trava o scroll do fundo e fecha no Esc.
  useEffect(() => {
    const t = setTimeout(() => numeroRef.current?.focus(), 120);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !processando) onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const efiEnvironment =
    import.meta.env.VITE_MISEON_EFI_SANDBOX === 'true' || import.meta.env.VITE_EFI_SANDBOX === 'true'
      ? 'sandbox'
      : 'production';

  const digitos = numero.replace(/\D/g, '');
  const bandeira = detectarBandeira(digitos);
  const [mm, aa] = validade.split('/');
  const validadeOk = (() => {
    if (!mm || !aa || aa.length < 2 || Number(mm) < 1 || Number(mm) > 12) return false;
    const fim = new Date(2000 + Number(aa), Number(mm), 0, 23, 59, 59);
    return fim >= new Date();
  })();
  const okNumero = luhnValido(digitos);
  const okNome = nome.trim().length >= 3;
  const okCpf = validarCPF(cpf);
  const okCvv = /^\d{3,4}$/.test(cvv);
  const tudoOk = okNumero && okNome && okCpf && validadeOk && okCvv;

  // Número renderizado no cartão visual (dígitos digitados + placeholders)
  const numeroDisplay = (() => {
    const base = digitos.padEnd(16, '•').slice(0, 16);
    return base.replace(/(.{4})/g, '$1 ').trim();
  })();

  const pagar = async () => {
    setErro('');
    if (!loja.efi_payee_code?.trim()) {
      return setErro('Cartão online indisponível para esta loja no momento.');
    }
    if (!tudoOk) {
      setTocado({ numero: true, nome: true, cpf: true, validade: true, cvv: true });
      return setErro('Confira os dados do cartão destacados em vermelho.');
    }
    setProcessando(true);
    try {
      // SDK oficial da Efí: tokeniza o cartão no navegador (o número nunca sai daqui)
      if (!(window as any).EfiPay) {
        await new Promise<void>((ok, err) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/payment-token-efi/dist/payment-token-efi-umd.min.js';
          s.onload = () => ok();
          s.onerror = () => err(new Error('Não foi possível carregar o ambiente seguro da Efí. Verifique sua conexão.'));
          document.head.appendChild(s);
        });
      }
      const EfiPay = (window as any).EfiPay;
      const brand = await EfiPay.CreditCard.setCardNumber(digitos).verifyCardBrand();
      const result = await EfiPay.CreditCard
        .setAccount(loja.efi_payee_code!)
        .setEnvironment(efiEnvironment)
        .setCreditCardData({
          brand: brand || bandeira?.id,
          number: digitos,
          cvv,
          expirationMonth: mm.padStart(2, '0'),
          expirationYear: aa.length === 2 ? `20${aa}` : aa,
          holderName: nome,
          holderDocument: cpf.replace(/\D/g, ''),
          reuse: false,
        })
        .getPaymentToken();

      const { data, error } = await supabase.functions.invoke('cartao-pagar', {
        body: {
          pedido_id: info.pedidoId,
          payment_token: result.payment_token,
          installments: parcelas,
          customer: { name: nome, cpf },
        },
      });
      if (error || !data?.aprovado) {
        if ((data as any)?.detail) console.warn('[cartao-pagar] detalhe Efí:', (data as any).detail);
        let msg: unknown = data?.error ?? 'Pagamento não autorizado. Confira os dados ou tente outro cartão.';
        if (error) {
          try {
            const b = await (error as any)?.context?.json?.();
            if (b?.detail) console.warn('[cartao-pagar] detalhe Efí:', b.detail);
            msg = b?.error ?? msg;
          } catch { /* mantém msg */ }
        }
        // Garante texto: nunca joga objeto no JSX (senão o React quebra a tela).
        setErro(typeof msg === 'string' ? msg : 'Pagamento não autorizado. Confira os dados ou tente outro cartão.');
      } else {
        onAprovado();
      }
    } catch (e: any) {
      setErro(e?.error_description ?? e?.message ?? 'Não foi possível processar o cartão. Tente novamente.');
    }
    setProcessando(false);
  };

  const marcar = (k: string) => setTocado((t) => ({ ...t, [k]: true }));
  const invalido = (k: string, ok: boolean) => tocado[k] && !ok;
  const campoCls = (k: string, ok: boolean) =>
    `w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition-colors dark:bg-gray-800 dark:text-gray-100 ${
      invalido(k, ok)
        ? 'border-red-400 focus:border-red-500 dark:border-red-500/60'
        : 'border-gray-200 focus:border-[var(--cor-primaria)] dark:border-gray-700'
    }`;
  const rotuloCls = 'mb-0.5 block text-[11px] font-semibold text-gray-500 dark:text-gray-400';

  return (
    <div className="fade fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm">
      {/* Painel único e compacto (não fecha ao digitar; só no X) */}
      <div className="sheet my-auto w-full max-w-[400px] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">
            <Lock size={15} className="text-emerald-500" /> Pagamento seguro
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: 'var(--cor-primaria)' }}>{fmt(info.total)}</span>
            <button onClick={onFechar} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
          </div>
        </div>

        <div className="px-4 py-3">
          {/* Mini-cartão compacto que reage ao que é digitado (flip no CVV) */}
          <div className="mb-3 [perspective:1000px]">
            <div className={`relative h-36 w-full transition-transform duration-500 [transform-style:preserve-3d] ${verso ? '[transform:rotateY(180deg)]' : ''}`}>
              {/* Frente */}
              <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl p-4 text-white shadow-lg [backface-visibility:hidden]"
                style={{ background: 'linear-gradient(135deg, var(--cor-primaria) 0%, rgba(17,17,17,0.92) 100%)' }}>
                <div className="flex items-start justify-between">
                  <div className="h-7 w-10 rounded bg-gradient-to-br from-yellow-200 to-yellow-400 shadow-inner" />
                  {bandeira ? <BandeiraMark id={bandeira.id} className="h-7 w-auto" /> : <CreditCard size={22} className="opacity-70" />}
                </div>
                <div className="font-mono text-[15px] tracking-[0.12em]">{numeroDisplay}</div>
                <div className="flex items-end justify-between gap-2 text-[11px]">
                  <span className="truncate font-semibold uppercase">{nome || 'SEU NOME'}</span>
                  <span className="font-mono font-semibold">{validade || 'MM/AA'}</span>
                </div>
              </div>
              {/* Verso */}
              <div className="absolute inset-0 overflow-hidden rounded-xl bg-gray-800 text-white shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="mt-4 h-8 w-full bg-black/80" />
                <div className="flex items-center gap-2 px-4 pt-3">
                  <div className="flex h-8 flex-1 items-center rounded bg-gray-200 px-3 font-mono text-sm tracking-widest text-gray-800">
                    <span className="ml-auto">{cvv || '•••'}</span>
                  </div>
                </div>
                <p className="px-4 pt-1.5 text-right text-[10px] opacity-70">CVV</p>
              </div>
            </div>
          </div>

          {/* Formulário compacto */}
          <div className="space-y-2.5">
            <label className="block">
              <span className={rotuloCls}>Número do cartão</span>
              <div className="relative">
                <input ref={numeroRef} value={numero} onChange={(e) => setNumero(maskCartaoCredito(e.target.value))} onBlur={() => marcar('numero')}
                  inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
                  className={campoCls('numero', okNumero) + ' pr-16 font-mono tracking-wide'} />
                <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                  {okNumero && <Check size={15} className="text-emerald-500" />}
                  {bandeira && <BandeiraMark id={bandeira.id} className="h-5 w-auto shadow-sm" />}
                </div>
              </div>
            </label>

            <label className="block">
              <span className={rotuloCls}>Nome impresso no cartão</span>
              <input value={nome} onChange={(e) => setNome(e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').toUpperCase())} onBlur={() => marcar('nome')}
                autoComplete="cc-name" placeholder="COMO ESTÁ NO CARTÃO" className={campoCls('nome', okNome)} />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className={rotuloCls}>Validade</span>
                <input value={validade} onChange={(e) => setValidade(maskValidadeCartao(e.target.value))} onBlur={() => marcar('validade')}
                  inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" className={campoCls('validade', validadeOk)} />
              </label>
              <label className="block">
                <span className={rotuloCls}>CVV</span>
                <input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onFocus={() => setVerso(true)} onBlur={() => { setVerso(false); marcar('cvv'); }}
                  inputMode="numeric" autoComplete="cc-csc" placeholder="000" className={campoCls('cvv', okCvv)} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className={rotuloCls}>CPF do titular</span>
                <input value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} onBlur={() => marcar('cpf')}
                  inputMode="numeric" placeholder="000.000.000-00" className={campoCls('cpf', okCpf)} />
              </label>
              <label className="block">
                <span className={rotuloCls}>Parcelamento</span>
                <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  {[1, 2, 3].map((n) => (<option key={n} value={n}>{n}x de {fmt(info.total / n)}</option>))}
                </select>
              </label>
            </div>
          </div>

          {erro && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
              <X size={15} className="mt-0.5 shrink-0" /> <span>{erro}</span>
            </div>
          )}

          {/* Botão pagar */}
          <button onClick={pagar} disabled={processando}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 text-[15px] font-black text-white shadow-lg shadow-[var(--cor-primaria)]/30 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50">
            {processando ? <><Loader2 size={17} className="animate-spin" /> Processando…</> : <><Lock size={15} /> Pagar {fmt(info.total)}</>}
          </button>

          {/* Rodapé de confiança — compacto, uma linha */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><Lock size={11} className="text-emerald-500" /> SSL</span>
            <span>·</span>
            <span className="flex items-center gap-1"><ShieldCheck size={11} className="text-emerald-500" /> Tokenizado (PCI)</span>
            <span>·</span>
            <span className="flex items-center gap-1">via <img src="/selo_efi_bank.png" alt="Efí Bank" className="h-3.5 w-auto" /></span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5 opacity-90">
            {BANDEIRAS_ACEITAS.map((b) => (
              <BandeiraMark key={b} id={b} className={`h-[18px] w-auto rounded-sm transition-opacity ${bandeira && bandeira.id !== b ? 'opacity-25' : 'opacity-100'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
