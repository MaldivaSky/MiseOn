import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import {
  DollarSign, ShoppingBag, Ticket, Flame, AlertTriangle, Timer, ArrowRight,
  ClipboardList, UtensilsCrossed, TrendingUp, Boxes, Megaphone, LifeBuoy,
  Check, Circle, X, Rocket, BellRing,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, type Pedido, type ProducaoPreparo } from '../../types';
import type { CtxLoja } from './AdminLayout';

interface DadosDia {
  pedidosHoje: Pedido[];
  insumosBaixos: { id: string; nome: string; quantidade_atual: number; estoque_minimo: number; unidade_medida: string }[];
  lotesVencendo: (ProducaoPreparo & { nomePreparo: string })[];
}

interface Onboarding {
  logo: boolean;
  cardapio: boolean;
  horarios: boolean;
  pagamentos: boolean;
  primeiraVenda: boolean;
}

const PASSOS_ONBOARDING: { chave: keyof Onboarding; titulo: string; descricao: string; to: string }[] = [
  { chave: 'logo', titulo: 'Dê a cara da sua loja', descricao: 'Suba a logo e escolha as cores da sua marca.', to: '/admin/loja' },
  { chave: 'cardapio', titulo: 'Monte o cardápio', descricao: 'Cadastre pelo menos um produto para vender.', to: '/admin/cardapio' },
  { chave: 'horarios', titulo: 'Defina os horários', descricao: 'Diga quando a loja abre e fecha.', to: '/admin/loja' },
  { chave: 'pagamentos', titulo: 'Configure os recebimentos', descricao: 'Conecte sua conta Efí para receber Pix e cartão.', to: '/admin/loja' },
  { chave: 'primeiraVenda', titulo: 'Faça a primeira venda', descricao: 'Compartilhe o link da loja e receba o primeiro pedido.', to: '/admin/loja' },
];

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard() {
  const ctx = useOutletContext<CtxLoja>();
  const { lojaId, lojaNome, lojaSlug, papel } = ctx;
  const [dados, setDados] = useState<DadosDia | null>(null);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [onboardingOculto, setOnboardingOculto] = useState(() => localStorage.getItem(`miseon_onb_ocultar_${lojaId}`) === '1');

  const carregar = async () => {
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
    const limiteVencimento = new Date(Date.now() + 6 * 3600e3).toISOString();

    const [
      { data: pedidosHoje },
      { data: insumosBaixos },
      { data: lotes },
      { data: loja },
      { count: qtdProdutos },
      { count: qtdHorarios },
      { count: qtdPedidosTotal },
      { data: preparosNomes },
    ] = await Promise.all([
      supabase.from('pedidos').select('id, numero, status, valor_total, criado_em, tipo_pedido, identificador_cliente')
        .eq('loja_id', lojaId).gte('criado_em', inicioHoje.toISOString()).order('criado_em', { ascending: false }),
      // comparação coluna x coluna não existe no PostgREST — traz os com mínimo
      // definido e filtra `quantidade_atual <= estoque_minimo` aqui no cliente
      supabase.from('insumos').select('id, nome, quantidade_atual, estoque_minimo, unidade_medida')
        .eq('loja_id', lojaId).eq('ativo', true).gt('estoque_minimo', 0)
        .order('quantidade_atual'),
      supabase.from('producoes_preparo').select('*')
        .eq('loja_id', lojaId).eq('status', 'ATIVO').not('vence_em', 'is', null)
        .lte('vence_em', limiteVencimento).order('vence_em'),
      supabase.from('lojas').select('logo_url, efi_payee_code, efi_titular_documento, efi_conta, pix_chave, aceita_online').eq('id', lojaId).single(),
      supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('horarios_funcionamento').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('insumos').select('id, nome').eq('loja_id', lojaId).eq('is_preparo', true),
    ]);

    const nomes = new Map((preparosNomes ?? []).map((p) => [p.id, p.nome]));
    setDados({
      pedidosHoje: (pedidosHoje as Pedido[]) ?? [],
      insumosBaixos: ((insumosBaixos as DadosDia['insumosBaixos']) ?? [])
        .filter((i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo))
        .slice(0, 50),
      lotesVencendo: ((lotes as ProducaoPreparo[]) ?? []).map((l) => ({ ...l, nomePreparo: nomes.get(l.preparo_id) ?? 'Preparo' })),
    });

    const pagamentosOk = !(loja?.aceita_online ?? true)
      || !!loja?.efi_payee_code
      || !!(loja?.efi_titular_documento && loja?.efi_conta)
      || !!loja?.pix_chave;
    setOnboarding({
      logo: !!loja?.logo_url,
      cardapio: (qtdProdutos ?? 0) > 0,
      horarios: (qtdHorarios ?? 0) > 0,
      pagamentos: pagamentosOk,
      primeiraVenda: (qtdPedidosTotal ?? 0) > 0,
    });
  };

  useEffect(() => {
    if (papel !== 'admin') return;
    carregar();
    const canal = supabase
      .channel(`dashboard-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId, papel]);

  const resumo = useMemo(() => {
    const lista = dados?.pedidosHoje ?? [];
    const validos = lista.filter((p) => p.status !== 'CANCELADO');
    const faturamento = validos.reduce((s, p) => s + Number(p.valor_total), 0);
    return {
      faturamento,
      qtd: validos.length,
      ticket: validos.length > 0 ? faturamento / validos.length : 0,
      abertos: lista.filter((p) => !['FINALIZADO', 'CANCELADO'].includes(p.status)).length,
      aguardando: lista.filter((p) => p.status === 'NOVO').length,
    };
  }, [dados]);

  const passosFeitos = onboarding ? PASSOS_ONBOARDING.filter((p) => onboarding[p.chave]).length : 0;
  const onboardingCompleto = passosFeitos === PASSOS_ONBOARDING.length;
  const mostrarOnboarding = onboarding && !onboardingCompleto && !onboardingOculto;

  const ocultarOnboarding = () => {
    localStorage.setItem(`miseon_onb_ocultar_${lojaId}`, '1');
    setOnboardingOculto(true);
  };

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Operador e entregador não veem números do negócio — vão direto para a operação.
  if (papel !== 'admin') return <Navigate to="/admin/pedidos" replace />;

  if (!dados) return <div className="p-8 text-center text-gray-400">Preparando o seu dia…</div>;

  const lotesVencidos = dados.lotesVencendo.filter((l) => new Date(l.vence_em!) <= new Date());
  const lotesQuaseVencendo = dados.lotesVencendo.filter((l) => new Date(l.vence_em!) > new Date());

  return (
    <div className="mx-auto max-w-5xl p-4 pb-12">
      {/* ── Saudação ── */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{hoje}</p>
        <h2 className="mt-1 text-2xl font-black dark:text-gray-100">{saudacao()}, {lojaNome} 👋</h2>
      </div>

      {/* ── Onboarding (primeiros passos) ── */}
      {mostrarOnboarding && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--cor-primaria)]/30 bg-white shadow-sm dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[var(--cor-primaria)]/10 p-2 text-[var(--cor-primaria)]"><Rocket size={18} /></div>
              <div>
                <p className="text-sm font-black dark:text-gray-100">Deixe sua loja pronta para vender</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{passosFeitos} de {PASSOS_ONBOARDING.length} passos concluídos</p>
              </div>
            </div>
            <button onClick={ocultarOnboarding} title="Ocultar (você pode continuar depois)" className="rounded-lg p-1.5 text-gray-300 hover:text-gray-500"><X size={16} /></button>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800">
            <div className="h-1.5 rounded-r-full bg-[var(--cor-primaria)] transition-all" style={{ width: `${(passosFeitos / PASSOS_ONBOARDING.length) * 100}%` }} />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {PASSOS_ONBOARDING.map((passo) => {
              const feito = !!onboarding?.[passo.chave];
              return (
                <Link key={passo.chave} to={passo.to} className={`flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-gray-50 dark:hover:bg-white/5 ${feito ? 'opacity-55' : ''}`}>
                  <div className="flex items-center gap-3">
                    {feito
                      ? <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"><Check size={13} /></span>
                      : <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 text-gray-300 dark:border-gray-700"><Circle size={8} /></span>}
                    <div>
                      <p className={`text-sm font-semibold dark:text-gray-100 ${feito ? 'line-through' : ''}`}>{passo.titulo}</p>
                      {!feito && <p className="text-[11px] text-gray-400">{passo.descricao}</p>}
                    </div>
                  </div>
                  {!feito && <ArrowRight size={15} className="shrink-0 text-[var(--cor-primaria)]" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Alerta: pedidos aguardando aceite ── */}
      {resumo.aguardando > 0 && (
        <Link to="/admin/pedidos" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-orange-300 bg-orange-50 px-5 py-4 shadow-sm transition hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-900/15 dark:hover:bg-orange-900/25">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
              <BellRing size={18} />
              <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-orange-400" />
            </span>
            <div>
              <p className="text-sm font-black text-orange-700 dark:text-orange-400">
                {resumo.aguardando} pedido{resumo.aguardando > 1 ? 's' : ''} aguardando aceite!
              </p>
              <p className="text-xs text-orange-600/80 dark:text-orange-400/70">O cliente está esperando a confirmação da loja.</p>
            </div>
          </div>
          <ArrowRight size={18} className="shrink-0 text-orange-500" />
        </Link>
      )}

      {/* ── KPIs do dia ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400"><DollarSign size={12} /> Vendas hoje</p>
          <p className="mt-1.5 text-xl font-black dark:text-gray-100">{fmt(resumo.faturamento)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400"><ShoppingBag size={12} /> Pedidos hoje</p>
          <p className="mt-1.5 text-xl font-black dark:text-gray-100">{resumo.qtd}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400"><Ticket size={12} /> Ticket médio</p>
          <p className="mt-1.5 text-xl font-black dark:text-gray-100">{fmt(resumo.ticket)}</p>
        </div>
        <Link to="/admin/pedidos" className="group rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-[var(--cor-primaria)]/40 dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
            <Flame size={12} /> Em andamento
            {resumo.abertos > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-xl font-black dark:text-gray-100">
            {resumo.abertos}
            <ArrowRight size={14} className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--cor-primaria)]" />
          </p>
        </Link>
      </div>

      {/* ── Alertas de operação ── */}
      {(dados.insumosBaixos.length > 0 || dados.lotesVencendo.length > 0) && (
        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          {dados.insumosBaixos.length > 0 && (
            <Link to="/admin/estoque" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-900/15 dark:hover:bg-amber-900/25">
              <p className="flex items-center gap-2 text-sm font-black text-amber-700 dark:text-amber-400">
                <Boxes size={15} /> {dados.insumosBaixos.length} insumo{dados.insumosBaixos.length > 1 ? 's' : ''} com estoque baixo
              </p>
              <div className="mt-2 space-y-1">
                {dados.insumosBaixos.slice(0, 3).map((i) => (
                  <p key={i.id} className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    • {i.nome}: <b>{Number(i.quantidade_atual)} {i.unidade_medida}</b> (mínimo {Number(i.estoque_minimo)})
                  </p>
                ))}
                {dados.insumosBaixos.length > 3 && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">+ {dados.insumosBaixos.length - 3} outros — ver Central de Compras</p>}
              </div>
            </Link>
          )}
          {dados.lotesVencendo.length > 0 && (
            <Link to="/admin/estoque" className="rounded-2xl border border-red-300 bg-red-50 p-4 shadow-sm transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/15 dark:hover:bg-red-900/25">
              <p className="flex items-center gap-2 text-sm font-black text-red-600 dark:text-red-400">
                <Timer size={15} /> Validade de preparos
              </p>
              <div className="mt-2 space-y-1">
                {lotesVencidos.slice(0, 2).map((l) => (
                  <p key={l.id} className="text-xs font-semibold text-red-600 dark:text-red-400">
                    <AlertTriangle size={11} className="mr-1 inline" />{l.nomePreparo}: lote VENCIDO — descarte no Estoque
                  </p>
                ))}
                {lotesQuaseVencendo.slice(0, 2).map((l) => (
                  <p key={l.id} className="text-xs text-red-700/80 dark:text-red-300/80">
                    • {l.nomePreparo}: vence {new Date(l.vence_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ))}
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── Últimos pedidos de hoje ── */}
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-sm font-black dark:text-gray-100">Últimos pedidos de hoje</p>
          <Link to="/admin/pedidos" className="flex items-center gap-1 text-xs font-bold text-[var(--cor-primaria)]">Ver todos <ArrowRight size={13} /></Link>
        </div>
        {dados.pedidosHoje.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            Nenhum pedido ainda hoje. Compartilhe o link da loja: <b className="text-gray-600 dark:text-gray-300">{window.location.origin}/{lojaSlug}</b>
          </p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {dados.pedidosHoje.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-gray-400">#{p.numero}</span>
                  <span className="truncate text-sm font-semibold dark:text-gray-100">{p.identificador_cliente}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === 'CANCELADO' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : p.status === 'FINALIZADO' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>{p.status}</span>
                  <span className="text-sm font-bold dark:text-gray-100">{fmt(Number(p.valor_total))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Atalhos ── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { to: '/admin/pedidos', icon: <ClipboardList size={18} />, label: 'Pedidos' },
          { to: '/admin/cardapio', icon: <UtensilsCrossed size={18} />, label: 'Cardápio' },
          { to: '/admin/financeiro', icon: <TrendingUp size={18} />, label: 'Financeiro' },
          { to: '/admin/estoque', icon: <Boxes size={18} />, label: 'Estoque' },
          { to: '/admin/marketing', icon: <Megaphone size={18} />, label: 'Marketing' },
          { to: '/admin/ajuda', icon: <LifeBuoy size={18} />, label: 'Ajuda' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3.5 text-gray-500 shadow-sm transition hover:border-[var(--cor-primaria)]/40 hover:text-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {a.icon}
            <span className="text-[11px] font-bold">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
