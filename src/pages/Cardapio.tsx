import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { ShoppingBag, Plus, Minus, X, Search, Clock, MapPin, Star, LogIn, LogOut, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Loja, Banner, Categoria, Produto, Cupom, TaxaEntrega, ItemCarrinho, Cliente,
  HorarioFuncionamento, MetodoPgto, fmt, precoItem,
} from '../types';
import { fonteFamilia } from '../lib/personalizacao';
import ThemeToggle from '../components/ThemeToggle';

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
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
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
                  className="rounded-full border border-white/30 bg-black/20 p-2 text-white backdrop-blur-sm">
                  <History size={16} />
                </Link>
                <button onClick={() => supabase.auth.signOut()} title="Sair"
                  className="rounded-full border border-white/30 bg-black/20 p-2 text-white backdrop-blur-sm">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <button onClick={() => entrarComGoogle(window.location.href)}
                className="flex items-center gap-1.5 rounded-full border border-white/30 bg-black/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm">
                <LogIn size={14} /> Entrar
              </button>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto flex max-w-6xl items-end gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
              {loja.logo_url
                ? <img src={loja.logo_url} className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/40 object-cover shadow-xl sm:h-24 sm:w-24" alt="" />
                : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/15 text-2xl font-bold text-white shadow-xl backdrop-blur-sm sm:h-24 sm:w-24 sm:text-4xl">
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
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-white/90 backdrop-blur-sm">Pedido mín. {fmt(loja.pedido_minimo)}</span>
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
          <div className="flex snap-x gap-3 overflow-x-auto p-4 sm:px-6">
            {banners.map((b) => (
              <img key={b.id} src={b.imagem_url} alt={b.titulo ?? ''} className="h-32 w-72 shrink-0 snap-center rounded-xl object-cover shadow sm:h-40 sm:w-96" />
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-6 lg:px-6 lg:pt-4">
        <main className="min-w-0">
          {/* Busca */}
          <div className="px-4 pt-2 lg:px-0">
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-gray-900">
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
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${!catAtiva ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300'}`}
            >
              Tudo
            </button>
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatAtiva(c.id === catAtiva ? null : c.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${catAtiva === c.id ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300'}`}
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
                    className={`relative w-36 shrink-0 rounded-xl bg-white p-2 text-left shadow-sm dark:bg-gray-900 ${p.tem_estoque === false ? 'opacity-50' : ''}`}>
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
                        className={`card-hover flex w-full gap-3 overflow-hidden rounded-xl bg-white text-left shadow-sm dark:bg-gray-900 ${p.tem_estoque === false ? 'opacity-50' : ''}`}>
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
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
            <p className="mb-3 flex items-center gap-2 font-bold dark:text-gray-100"><ShoppingBag size={18} /> Seu carrinho</p>
            {carrinho.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Adicione itens do cardápio.</p>
            ) : (
              <>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {carrinho.map((i, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="dark:text-gray-200">{i.quantidade}x {i.produto.nome}</span>
                      <span className="font-semibold dark:text-gray-100">{fmt(precoItem(i))}</span>
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

      {checkoutAberto && loja && (
        <Checkout
          loja={loja}
          aberta={aberta}
          carrinho={carrinho}
          taxas={taxas}
          user={user}
          setCarrinho={setCarrinho}
          onClose={() => setCheckoutAberto(false)}
          onSucesso={(n, id, pixInfo) => { setPedidoNumero(n); setPedidoId(id); setPix(pixInfo ?? null); setCarrinho([]); setCheckoutAberto(false); }}
          onCartao={(info) => { setCartao(info); setCarrinho([]); setCheckoutAberto(false); }}
        />
      )}

      {cartao && loja && (
        <CartaoModal
          loja={loja}
          info={cartao}
          onFechar={() => setCartao(null)}
          onAprovado={() => { setPedidoNumero(cartao.numero); setPedidoId(cartao.pedidoId); setCartao(null); }}
        />
      )}

      {pedidoNumero !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center dark:bg-gray-900">
            <p className="text-4xl">✅</p>
            <h3 className="mt-2 text-lg font-bold dark:text-gray-100">Pedido #{pedidoNumero} enviado!</h3>
            {pix ? (
              <div className="mt-3 text-left">
                <p className="text-center text-sm font-semibold dark:text-gray-200">Pague com Pix para confirmar:</p>
                {pix.qr_imagem && <img src={pix.qr_imagem} alt="QR Code Pix" className="mx-auto mt-2 h-44 w-44" />}
                <div className="mt-2 break-all rounded-lg bg-gray-100 p-2 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">{pix.copia_e_cola}</div>
                <button
                  onClick={() => navigator.clipboard.writeText(pix.copia_e_cola)}
                  className="mt-2 w-full rounded-xl border border-[var(--cor-primaria)] py-2 text-sm font-semibold text-[var(--cor-primaria)]"
                >
                  Copiar código Pix
                </button>
                <p className="mt-2 text-center text-xs text-gray-400">Confirmação automática após o pagamento.</p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A loja já recebeu seu pedido.</p>
            )}
            <a href={`/pedido/${pedidoId}`}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white">
              Acompanhar meu pedido
            </a>
            <button onClick={() => { setPedidoNumero(null); setPix(null); setPedidoId(null); }} className="mt-2 w-full rounded-xl border py-3 text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Fechar
            </button>
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

  return (
    <div className="fade fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="sheet max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        {produto.imagem_url && <img src={produto.imagem_url} className="h-44 w-full object-cover" alt="" />}
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
      <div className="sheet w-full max-w-lg rounded-t-3xl bg-white p-4 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
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

// ── Checkout (delivery/retirada, cupom, pagamento, wa.me) ───
function Checkout({ loja, aberta, carrinho, taxas, user, setCarrinho, onClose, onSucesso, onCartao }: {
  loja: Loja;
  aberta: boolean;
  carrinho: ItemCarrinho[];
  taxas: TaxaEntrega[];
  user: User | null;
  setCarrinho: (c: ItemCarrinho[]) => void;
  onClose: () => void;
  onSucesso: (numero: number, pedidoId: string, pix?: { copia_e_cola: string; qr_imagem?: string } | null) => void;
  onCartao?: (info: { pedidoId: string; numero: number; total: number }) => void;
}) {
  const [tipo, setTipo] = useState<'DELIVERY' | 'RETIRADA_BALCAO'>('DELIVERY');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [metodo, setMetodo] = useState<MetodoPgto>('PIX');
  const [trocoPara, setTrocoPara] = useState('');
  const [codCupom, setCodCupom] = useState('');
  const [cupom, setCupom] = useState<Cupom | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [perfilCarregado, setPerfilCarregado] = useState(false);

  useEffect(() => {
    if (!user) { setPerfilCarregado(true); return; }
    (async () => {
      const { data } = await supabase.from('clientes').select('*')
        .eq('loja_id', loja.id).eq('user_id', user.id).maybeSingle();
      const c = data as Cliente | null;
      if (c) {
        setNome(c.nome ?? '');
        setTelefone(c.telefone ?? '');
        setEndereco(c.endereco ?? '');
        setBairro(c.bairro ?? '');
        if (c.forma_pagamento_preferida) setMetodo(c.forma_pagamento_preferida);
      } else if (user.user_metadata?.full_name || user.user_metadata?.name) {
        setNome(user.user_metadata.full_name ?? user.user_metadata.name);
      }
      setPerfilCarregado(true);
    })();
  }, [user, loja.id]);

  const subtotal = carrinho.reduce((s, i) => s + precoItem(i), 0);
  const taxa = tipo === 'DELIVERY' ? Number(taxas.find((t) => t.bairro === bairro)?.valor ?? taxas[0]?.valor ?? 0) : 0;
  const desconto = cupom
    ? cupom.tipo === 'FIXO' ? Number(cupom.valor) : (subtotal * Number(cupom.valor)) / 100
    : 0;
  const total = Math.max(0, subtotal + taxa - desconto);

  const aplicarCupom = async () => {
    setErro('');
    const { data } = await supabase
      .from('cupons').select('*')
      .eq('loja_id', loja.id).eq('codigo', codCupom.trim().toUpperCase()).eq('ativo', true)
      .maybeSingle();
    if (!data) return setErro('Cupom não encontrado.');
    if (subtotal < Number(data.pedido_minimo)) return setErro(`Cupom exige pedido mínimo de ${fmt(Number(data.pedido_minimo))}.`);
    if (data.metodo_exigido && data.metodo_exigido !== metodo) return setErro(`Cupom válido apenas no ${data.metodo_exigido}.`);
    setCupom(data);
  };

  const enviar = async () => {
    setErro('');
    if (!user) return setErro('Entre com sua conta Google pra finalizar o pedido.');
    if (!aberta) return setErro('A loja está fechada no momento.');
    if (!nome || !telefone) return setErro('Preencha nome e telefone.');
    if (tipo === 'DELIVERY' && !endereco) return setErro('Preencha o endereço de entrega.');
    if (subtotal < Number(loja.pedido_minimo)) return setErro(`Pedido mínimo: ${fmt(Number(loja.pedido_minimo))}.`);
    setEnviando(true);

    // perfil do cliente autenticado — vira o "lead" que o lojista consulta depois
    const { data: clienteRow } = await supabase.from('clientes').upsert({
      loja_id: loja.id,
      user_id: user.id,
      telefone, nome,
      email: user.email ?? null,
      endereco: tipo === 'DELIVERY' ? endereco : null,
      bairro: tipo === 'DELIVERY' ? bairro : null,
      forma_pagamento_preferida: metodo,
    }, { onConflict: 'loja_id,user_id' }).select('id').single();

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .insert({
        loja_id: loja.id,
        tipo_pedido: tipo,
        identificador_cliente: nome,
        telefone_contato: telefone,
        cliente_id: clienteRow?.id ?? null,
        cliente_user_id: user.id,
        endereco_entrega: tipo === 'DELIVERY' ? endereco : null,
        bairro: tipo === 'DELIVERY' ? bairro : null,
        subtotal, taxa_entrega: taxa, desconto,
        cupom_id: cupom?.id ?? null,
        valor_total: total,
        troco_para: metodo === 'DINHEIRO' && trocoPara ? Number(trocoPara) : null,
      })
      .select('id, numero')
      .single();

    if (error || !pedido) { setEnviando(false); return setErro('Erro ao enviar pedido. Tente novamente.'); }

    for (const item of carrinho) {
      const { data: it } = await supabase
        .from('itens_pedido')
        .insert({
          pedido_id: pedido.id,
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          preco_unitario: item.produto.preco,
          quantidade: item.quantidade,
          observacao: item.observacao ?? null,
        })
        .select('id').single();
      if (it && item.opcoesSelecionadas.length) {
        await supabase.from('itens_pedido_opcoes').insert(
          item.opcoesSelecionadas.map((o) => ({
            item_id: it.id, opcao_id: o.id, nome_opcao: o.nome, preco_adicional: o.preco_adicional,
          })),
        );
      }
    }

    await supabase.from('pagamentos').insert({ pedido_id: pedido.id, metodo, valor_pago: total });

    // Cartão de crédito online (Efí — tokenização no navegador, PCI-safe)
    if (metodo === 'CREDITO' && loja.efi_payee_code && onCartao) {
      setEnviando(false);
      onCartao({ pedidoId: pedido.id, numero: pedido.numero, total });
      return;
    }

    // Pix dentro da plataforma (Efí Bank — padrão portado do MySuperStore)
    let pixInfo: { copia_e_cola: string; qr_imagem?: string } | null = null;
    if (metodo === 'PIX') {
      const { data: cob, error: e2 } = await supabase.functions.invoke('pix-criar-cobranca', {
        body: { pedido_id: pedido.id },
      });
      if (!e2 && cob?.copia_e_cola) pixInfo = cob;
      // se o Efí não estiver configurado, cai no Pix estático (loja.pix_chave) via mensagem do WhatsApp
    }

    // Mensagem wa.me para a loja
    const linhas = carrinho.map((i) => {
      const ops = i.opcoesSelecionadas.map((o) => `\n   + ${o.nome}`).join('');
      return `▪ ${i.quantidade}x ${i.produto.nome}${ops}${i.observacao ? `\n   Obs: ${i.observacao}` : ''}`;
    }).join('\n');
    const msg =
      `*NOVO PEDIDO #${pedido.numero}* — ${loja.nome}\n\n${linhas}\n\n` +
      `Subtotal: ${fmt(subtotal)}\n` +
      (taxa ? `Entrega: ${fmt(taxa)}\n` : '') +
      (desconto ? `Desconto (${cupom?.codigo}): -${fmt(desconto)}\n` : '') +
      `*Total: ${fmt(total)}*\n\n` +
      `${tipo === 'DELIVERY' ? `📍 ${endereco}${bairro ? ` — ${bairro}` : ''}` : '🏪 Retirada no balcão'}\n` +
      `👤 ${nome} · ${telefone}\n` +
      `💳 ${metodo}${metodo === 'DINHEIRO' && trocoPara ? ` (troco p/ ${fmt(Number(trocoPara))})` : ''}` +
      (metodo === 'PIX' && loja.pix_chave ? `\n🔑 Pix: ${loja.pix_chave}` : '');
    window.open(`https://wa.me/${loja.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');

    setEnviando(false);
    onSucesso(pedido.numero, pedido.id, pixInfo);
  };

  return (
    <div className="fade fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="sheet max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold dark:text-gray-100">Seu pedido</h3>
          <button onClick={onClose} className="dark:text-gray-300"><X size={20} /></button>
        </div>

        <div className="mt-3 space-y-2">
          {carrinho.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-xl border p-2 text-sm dark:border-gray-700">
              <div>
                <p className="font-medium dark:text-gray-100">{i.quantidade}x {i.produto.nome}</p>
                {i.opcoesSelecionadas.map((o) => <p key={o.id} className="text-xs text-gray-500 dark:text-gray-400">+ {o.nome}</p>)}
                {i.observacao && <p className="text-xs italic text-gray-400">{i.observacao}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold dark:text-gray-100">{fmt(precoItem(i))}</span>
                <button onClick={() => setCarrinho(carrinho.filter((_, x) => x !== idx))} className="text-red-400"><X size={15} /></button>
              </div>
            </div>
          ))}
        </div>

        {!user ? (
          <div className="mt-5 rounded-2xl border border-dashed p-5 text-center dark:border-gray-700">
            <p className="text-sm font-semibold dark:text-gray-100">Entre com sua conta pra finalizar</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Usamos sua conta Google só pra guardar seus dados de entrega e seu histórico de pedidos — não postamos nada.
            </p>
            <button
              onClick={() => entrarComGoogle(window.location.href)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-semibold text-white"
            >
              <LogIn size={16} /> Entrar com Google
            </button>
          </div>
        ) : !perfilCarregado ? (
          <p className="mt-5 text-center text-sm text-gray-400">Carregando seus dados…</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(['DELIVERY', 'RETIRADA_BALCAO'] as const).map((t) => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`rounded-xl border py-2 text-sm font-medium dark:border-gray-700 dark:text-gray-200 ${tipo === t ? 'border-[var(--cor-primaria)] bg-green-50 text-[var(--cor-primaria)] dark:bg-green-950' : ''}`}>
                  {t === 'DELIVERY' ? '🛵 Entrega' : '🏪 Retirada'}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="WhatsApp (11) 9…" className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              {tipo === 'DELIVERY' && (
                <>
                  <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço completo" className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                  {taxas.length > 0 && (
                    <select value={bairro} onChange={(e) => setBairro(e.target.value)} className="w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                      <option value="">Bairro (taxa de entrega)</option>
                      {taxas.map((t) => <option key={t.id} value={t.bairro}>{t.bairro} — {fmt(Number(t.valor))}</option>)}
                    </select>
                  )}
                </>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input value={codCupom} onChange={(e) => setCodCupom(e.target.value)} placeholder="Cupom" className="flex-1 rounded-xl border p-2.5 text-sm uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
              <button onClick={aplicarCupom} className="rounded-xl border px-4 text-sm font-medium dark:border-gray-700 dark:text-gray-200">Aplicar</button>
            </div>
            {cupom && <p className="mt-1 text-xs font-medium text-green-600">Cupom {cupom.codigo} aplicado! −{fmt(desconto)}</p>}

            <div className="mt-3 grid grid-cols-4 gap-2">
              {(['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO'] as MetodoPgto[]).map((m) => (
                <button key={m} onClick={() => setMetodo(m)}
                  className={`rounded-xl border py-2 text-xs font-medium dark:border-gray-700 dark:text-gray-200 ${metodo === m ? 'border-[var(--cor-primaria)] bg-green-50 text-[var(--cor-primaria)] dark:bg-green-950' : ''}`}>
                  {m}
                </button>
              ))}
            </div>
            {metodo === 'DINHEIRO' && (
              <input value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} placeholder="Troco para quanto?" type="number" className="mt-2 w-full rounded-xl border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
            )}

            <div className="mt-4 space-y-1 border-t pt-3 text-sm dark:border-gray-700 dark:text-gray-200">
              <p className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></p>
              {tipo === 'DELIVERY' && <p className="flex justify-between"><span>Entrega</span><span>{fmt(taxa)}</span></p>}
              {desconto > 0 && <p className="flex justify-between text-green-600"><span>Desconto</span><span>−{fmt(desconto)}</span></p>}
              <p className="flex justify-between text-base font-bold"><span>Total</span><span>{fmt(total)}</span></p>
            </div>

            {erro && <p className="mt-2 text-sm font-medium text-red-500">{erro}</p>}

            <button onClick={enviar} disabled={enviando || carrinho.length === 0}
              className="mt-3 w-full rounded-xl bg-[var(--cor-primaria)] py-3.5 font-semibold text-white disabled:opacity-40">
              {enviando ? 'Enviando…' : `Enviar pedido · ${fmt(total)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
