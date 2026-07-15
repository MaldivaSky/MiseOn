import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { ShoppingBag, Plus, Minus, X, Search, Clock, MapPin, Star, LogIn, LogOut, History, Lock, ShieldCheck, User as UserIcon, Trash2, QrCode, Copy, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ModalAuthCliente from '../components/ModalAuthCliente';
import ModalMinhaConta from '../components/ModalMinhaConta';
import EnderecoMixin, { EnderecoFormData } from '../components/EnderecoMixin';
import {
  Loja, Banner, Categoria, Produto, Cupom, TaxaEntrega, ItemCarrinho, Cliente,
  HorarioFuncionamento, MetodoPgto, fmt, precoItem,
} from '../types';
import { fonteFamilia } from '../lib/personalizacao';
import ThemeToggle from '../components/ThemeToggle';
import CheckoutDrawer from '../components/CheckoutDrawer';

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => setUser(session?.user ?? null));
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
    (async () => {
      const { data: l } = await supabase.from('lojas').select('*').eq('slug', slug).single();
      if (!l) return;
      setLoja(l);
      const [h, b, c, p, t, est] = await Promise.all([
        supabase.from('horarios_funcionamento').select('*').eq('loja_id', l.id),
        supabase.from('banners_destaque').select('*').eq('loja_id', l.id).order('ordem_exibicao'),
        supabase.from('categorias').select('*').eq('loja_id', l.id).order('ordem'),
        supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*))').eq('loja_id', l.id).order('ordem'),
        supabase.from('taxas_entrega').select('*').eq('loja_id', l.id),
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
      document.title = `${l.nome} — Peça online`;
      document.documentElement.style.setProperty('--cor-primaria', l.cor_primaria);
      document.documentElement.style.setProperty('--cor-secundaria', l.cor_secundaria);
      document.documentElement.style.setProperty('--fonte-loja', fonteFamilia(l.fonte));
      document.documentElement.style.setProperty('--cor-texto', l.cor_texto || '#111827');
    })();
  }, [slug]);

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
    <div className="loja-marca min-h-screen bg-gray-50 pb-28 dark:bg-gray-950 lg:pb-16">
      {/* Hero — banner com gradiente da marca, logo/nome sobrepostos */}
      <header className="relative">
        <div
          className="relative h-48 w-full overflow-hidden sm:h-64 lg:h-80"
          style={{ background: `linear-gradient(135deg, ${loja.cor_primaria}, ${loja.cor_secundaria})` }}
        >
          {loja.banner_url && <img src={loja.banner_url} className="h-full w-full object-cover" alt="" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
          <div className="absolute right-3 top-3 flex gap-2 sm:right-6 sm:top-6">
            <ThemeToggle className="rounded-full border border-white/30 bg-black/20 p-2 text-white backdrop-blur-sm" />
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
                : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white/40 bg-white dark:bg-gray-900 dark:border-gray-800/15 text-2xl font-bold text-white shadow-xl backdrop-blur-sm sm:h-24 sm:w-24 sm:text-4xl">
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
                    <span className="rounded-full bg-white dark:bg-gray-900 dark:border-gray-800/15 px-2 py-0.5 text-white/90 backdrop-blur-sm">Pedido mín. {fmt(loja.pedido_minimo)}</span>
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
              <div key={b.id} className="shrink-0 snap-center flex flex-col gap-2 w-72 sm:w-96">
                {b.link_redirecionamento ? (
                  <a href={b.link_redirecionamento} target="_blank" rel="noreferrer" className="block w-full rounded-xl overflow-hidden shadow">
                    <img src={b.imagem_url} alt={b.titulo ?? ''} className="h-32 w-full object-cover sm:h-40 transition-transform hover:scale-105" />
                  </a>
                ) : (
                  <img src={b.imagem_url} alt={b.titulo ?? ''} className="h-32 w-full rounded-xl object-cover shadow sm:h-40" />
                )}
                {b.titulo && (
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200 px-1 truncate">{b.titulo}</p>
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
            <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 px-3 py-2 shadow-sm dark:bg-gray-900">
              <Search size={16} className="text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no cardápio…"
                className="w-full bg-transparent text-sm outline-none dark:text-gray-100"
              />
            </div>
          </div>

          {/* Filtros de categoria */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3 lg:px-0">
            <button
              onClick={() => setCatAtiva(null)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${!catAtiva ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm dark:bg-gray-900 dark:text-gray-300'}`}
            >
              Tudo
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatAtiva(c.id === catAtiva ? null : c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${catAtiva === c.id ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-600 dark:text-gray-300 shadow-sm dark:bg-gray-900 dark:text-gray-300'}`}
              >
                {c.nome}
              </button>
            ))}
          </div>

          {/* Os mais pedidos */}
          {!busca && !catAtiva && maisPedidos.length > 0 && (
            <section className="px-4 lg:px-0">
              <h2 className="mb-2 flex items-center gap-1 font-bold dark:text-gray-100"><Star size={16} className="text-amber-500" /> Os mais pedidos</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {maisPedidos.map((p) => (
                  <button key={p.id} onClick={() => p.tem_estoque !== false && setProdutoAberto(p)}
                    disabled={p.tem_estoque === false}
                    className={`relative w-36 shrink-0 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-2 text-left shadow-sm dark:bg-gray-900 ${p.tem_estoque === false ? 'opacity-50' : ''}`}>
                    {p.imagem_url && <img src={p.imagem_url} className="mb-1 h-20 w-full rounded-lg object-cover" alt="" />}
                    {p.tem_estoque === false && (
                      <span className="absolute right-3 top-3 rounded-full bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-white">ESGOTADO</span>
                    )}
                    <p className="line-clamp-2 text-xs font-medium dark:text-gray-100">{p.nome}</p>
                    <p className="text-sm font-bold text-[var(--cor-primaria)]">{fmt(Number(p.preco))}</p>
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
                  <h2 className="mb-2 font-bold dark:text-gray-100">{c.nome}</h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {doGrupo.map((p) => (
                      <button key={p.id} onClick={() => p.tem_estoque !== false && setProdutoAberto(p)}
                        disabled={p.tem_estoque === false}
                        className={`card-hover flex w-full gap-3 overflow-hidden rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 text-left shadow-sm dark:bg-gray-900 ${p.tem_estoque === false ? 'opacity-50' : ''}`}>
                        {p.imagem_url && <img src={p.imagem_url} className="h-24 w-24 shrink-0 object-cover" alt="" />}
                        <div className="min-w-0 flex-1 py-3 pr-3">
                          <p className="flex flex-wrap items-center gap-2 font-medium dark:text-gray-100">
                            {p.nome}
                            {p.tem_estoque === false && (
                              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[9px] font-bold text-white">ESGOTADO</span>
                            )}
                          </p>
                          {p.descricao && <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{p.descricao}</p>}
                          <p className="mt-1 font-bold text-[var(--cor-primaria)]">{fmt(Number(p.preco))}</p>
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
          <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm dark:bg-gray-900">
            <p className="mb-3 flex items-center gap-2 font-bold dark:text-gray-100"><ShoppingBag size={18} /> Seu carrinho</p>
            {carrinho.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Adicione itens do cardápio.</p>
            ) : (
              <>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {carrinho.map((i, idx) => (
                    <div key={idx} className="flex flex-col gap-1 border-b border-gray-100 dark:border-gray-800/60 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between text-sm leading-tight">
                        <span className="font-medium dark:text-gray-200 pr-2">{i.produto.nome}</span>
                        <span className="font-semibold dark:text-gray-100">{fmt(precoItem(i))}</span>
                      </div>
                      {i.opcoesSelecionadas && i.opcoesSelecionadas.length > 0 && (
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1">{i.opcoesSelecionadas.map(o => o.nome).join(', ')}</p>
                      )}
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700/50 dark:bg-gray-800/50">
                          <button onClick={() => i.quantidade > 1 ? setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade - 1 } : x)) : setCarrinho(carrinho.filter((_, y) => y !== idx))} className="text-gray-500 hover:text-red-500 dark:text-gray-400"><Minus size={14} /></button>
                          <span className="w-4 text-center text-xs font-bold dark:text-gray-200">{i.quantidade}</span>
                          <button onClick={() => setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade + 1 } : x))} className="text-gray-500 hover:text-[var(--cor-primaria)] dark:text-gray-400"><Plus size={14} /></button>
                        </div>
                        <button onClick={() => setCarrinho(carrinho.filter((_, y) => y !== idx))} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 font-bold dark:border-gray-800 dark:text-gray-100">
                  <span>Total</span><span>{fmt(totalCarrinho)}</span>
                </div>
                <button onClick={() => setCheckoutAberto(true)}
                  className="mt-3 w-full rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white">
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
          className="fixed bottom-4 left-1/2 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl bg-[var(--cor-primaria)] px-5 py-3.5 font-semibold text-white shadow-lg lg:hidden"
        >
          <span className="flex items-center gap-2"><ShoppingBag size={18} /> {qtdCarrinho} item(ns)</span>
          <span>{fmt(totalCarrinho)}</span>
        </button>
      )}

      {produtoAberto && (
        <ModalProduto produto={produtoAberto} onClose={() => setProdutoAberto(null)} onAdd={addAoCarrinho} />
      )}
      
      {checkoutAberto && (
        <CheckoutDrawer loja={loja} aberta={aberta} carrinho={carrinho} taxas={taxas} user={user} setCarrinho={setCarrinho}
          onClose={() => setCheckoutAberto(false)} onAbrirAuth={() => setModalAuthAberto(true)}
          onCartao={(info) => { setCheckoutAberto(false); setCartao(info); }}
          onSucesso={(num, id, pixData) => {
            setCarrinho([]); setCheckoutAberto(false); setPedidoNumero(num); setPedidoId(id); setPix(pixData ?? null);
          }} />
      )}

      {cartao && <CartaoModal loja={loja} info={cartao} onFechar={() => setCartao(null)} onAprovado={() => { setCartao(null); setPedidoNumero(cartao.numero); setPedidoId(cartao.pedidoId); }} />}

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

// ── Cartão de crédito online (Efí — porte do MySuperStore) ──
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

  const pagar = async () => {
    setErro('');
    const num = numero.replace(/\s/g, '');
    const [mes, ano] = validade.split('/');
    if (num.length < 13 || !nome || cpf.replace(/\D/g, '').length !== 11 || !mes || !ano || cvv.length < 3) {
      return setErro('Confira os dados do cartão.');
    }
    setProcessando(true);
    try {
      // SDK oficial da Efí: tokeniza o cartão no navegador (o número nunca sai daqui)
      if (!(window as any).EfiPay) {
        await new Promise<void>((ok, err) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/payment-token-efi/dist/payment-token-efi-umd.min.js';
          s.onload = () => ok();
          s.onerror = () => err(new Error('Falha ao carregar SDK Efí'));
          document.head.appendChild(s);
        });
      }
      const EfiPay = (window as any).EfiPay;
      const brand = await EfiPay.CreditCard.setCardNumber(num).verifyCardBrand();
      const result = await EfiPay.CreditCard
        .setAccount(loja.efi_payee_code!)
        .setEnvironment('production')
        .setCreditCardData({
          brand,
          number: num,
          cvv,
          expirationMonth: mes.padStart(2, '0'),
          expirationYear: ano.length === 2 ? `20${ano}` : ano,
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
        setErro(data?.error ?? 'Pagamento recusado. Tente outro cartão.');
      } else {
        onAprovado();
      }
    } catch (e: any) {
      setErro(e?.error_description ?? e?.message ?? 'Erro ao processar o cartão.');
    }
    setProcessando(false);
  };

  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onFechar}>
      <div className="sheet w-full max-w-lg rounded-t-3xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold dark:text-gray-100">💳 Pagar com cartão · {fmt(info.total)}</h3>
          <button onClick={onFechar} className="dark:text-gray-300"><X size={20} /></button>
        </div>
        <div className="mt-3 space-y-2">
          <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric"
            placeholder="Número do cartão" className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Nome impresso no cartão" className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric"
            placeholder="CPF do titular" className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <div className="flex gap-2">
            <input value={validade} onChange={(e) => setValidade(e.target.value)}
              placeholder="Validade (MM/AA)" className="w-1/2 rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            <input value={cvv} onChange={(e) => setCvv(e.target.value)} inputMode="numeric"
              placeholder="CVV" className="w-1/2 rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}
            className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}x de {fmt(info.total / n)}{n === 1 ? ' (à vista)' : ''}</option>
            ))}
          </select>
        </div>
        {erro && <p className="mt-2 text-sm font-medium text-red-500">{erro}</p>}
        <button onClick={pagar} disabled={processando}
          className="mt-3 w-full rounded-xl bg-[var(--cor-primaria)] py-3.5 font-semibold text-white disabled:opacity-40">
          {processando ? 'Processando…' : `Pagar ${fmt(info.total)}`}
        </button>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          Pagamento seguro via Efí Bank. Os dados do cartão são tokenizados e não passam pelos nossos servidores.
        </p>
      </div>
    </div>
  );
}
