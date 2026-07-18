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
  itensMaisPedidos: Array<{ nome: string; quantidade: number }>;
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
      { data: itensMaisPedidos },
      { data: insumosBaixos },
      { data: lotes },
      { data: loja },
      { count: qtdProdutos },
      { count: qtdHorarios },
      { count: qtdPedidosTotal },
      { data: preparosComNomes },
    ] = await Promise.all([
      supabase.from('pedidos').select('id, numero, status, valor_total, criado_em, tipo_pedido, identificador_cliente')
        .eq('loja_id', lojaId).gte('criado_em', inicioHoje.toISOString()).order('criado_em', { ascending: false }),
      // Get most popular items today (try RPC first, fallback to client-side)
      (async () => {
        try {
          const { data } = await supabase.rpc('get_itens_mais_pedidos_hoje', { p_loja_id: lojaId });
          return data;
        } catch (e) {
          // Fallback: calculate client-side
          const itensMap = new Map<string, number>();
          (pedidosHoje as Pedido[]).forEach(pedido => {
            (pedido.itens_pedido || []).forEach(item => {
              const current = itensMap.get(item.nome_produto) || 0;
              itensMap.set(item.nome_produto, current + item.quantidade);
            });
          });
          return Array.from(itensMap.entries())
            .map(([nome, quantidade]) => ({ nome, quantidade }))
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 10);
        }
      })(),
      // comparação coluna x coluna não existe no PostgREST — traz os com mínimo
      // definido e filtra `quantidade_atual <= estoque_minimo` aqui no cliente
      supabase.from('insumos').select('id, nome, quantidade_atual, estoque_minimo, unidade_medida')
        .eq('loja_id', lojaId).eq('ativo', true).gt('estoque_minimo', 0)
        .order('quantidade_atual'),
      supabase.from('producoes_preparo').select('*, produto:preparo_id!inner(id, nome)')
        .eq('loja_id', lojaId).eq('status', 'ATIVO').not('vence_em', 'is', null)
        .lte('vence_em', limiteVencimento).order('vence_em'),
      supabase.from('lojas').select('logo_url, efi_payee_code, efi_titular_documento, efi_conta, pix_chave, aceita_online').eq('id', lojaId).single(),
      supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('horarios_funcionamento').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      supabase.from('produtos').select('id, nome').eq('loja_id', lojaId).eq('ativo', true),
    ]);

    const produtoNomes = new Map((preparosComNomes ?? []).map((p) => [
      p.produto?.id ?? '',
      p.produto?.nome ?? 'Produto desconocido'
    ]));
    setDados({
      pedidosHoje: (pedidosHoje as Pedido[]) ?? [],
      itensMaisPedidos: (itensMaisPedidos as { nome: string; quantidade: number }[]) ?? [],
      insumosBaixos: ((insumosBaixos as DadosDia['insumosBaixos']) ?? [])
        .filter((i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo))
        .slice(0, 50),
      lotesVencendo: ((lotes as ProducaoPreparo[]) ?? []).map((l) => ({
        ...l,
        nomePreparo: produtoNomes.get(l.preparo_id) ?? 'Produto desconocido'
      })),
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


  const getHorarioPico = (pedidos: Pedido[]): string => {
    if (pedidos.length === 0) return "00:00";

    // Conta pedidos por hora (excluindo cancelados)
    const contagemPorHora: Record<number, number> = {};

    pedidos.forEach(pedido => {
      if (pedido.status === 'CANCELADO') return;
      const hora = new Date(pedido.criado_em).getHours();
      contagemPorHora[hora] = (contagemPorHora[hora] || 0) + 1;
    });

    // Encontra a hora com mais pedidos
    let maxHora = 0;
    let maxContagem = 0;

    Object.keys(contagemPorHora).forEach(h => {
      const horaNum = parseInt(h);
      if (contagemPorHora[horaNum] > maxContagem) {
        maxContagem = contagemPorHora[horaNum];
        maxHora = horaNum;
      }
    });

    return `${maxHora.toString().padStart(2, '0')}:00`;
  };

  const getPercentualHorarioPico = (pedidos: Pedido[]): number => {
    if (pedidos.length === 0) return 0;

    // Conta pedidos por hora (excluindo cancelados)
    const contagemPorHora: Record<number, number> = {};

    pedidos.forEach(pedido => {
      if (pedido.status === 'CANCELADO') return;
      const hora = new Date(pedido.criado_em).getHours();
      contagemPorHora[hora] = (contagemPorHora[hora] || 0) + 1;
    });

    // Encontra a hora com mais pedidos
    let maxContagem = 0;
    Object.keys(contagemPorHora).forEach(h => {
      const horaNum = parseInt(h);
      if (contagemPorHora[horaNum] > maxContagem) {
        maxContagem = contagemPorHora[horaNum];
      }
    });

    return Math.round((maxContagem / pedidos.filter(p => p.status !== 'CANCELADO').length) * 100);
  };

  const getContagemHorarioPico = (pedidos: Pedido[]): number => {
    if (pedidos.length === 0) return 0;

    // Conta pedidos por hora (excluindo cancelados)
    const contagemPorHora: Record<number, number> = {};

    pedidos.forEach(pedido => {
      if (pedido.status === 'CANCELADO') return;
      const hora = new Date(pedido.criado_em).getHours();
      contagemPorHora[hora] = (contagemPorHora[hora] || 0) + 1;
    });

    // Encontra a hora com mais pedidos
    let maxContagem = 0;
    Object.keys(contagemPorHora).forEach(h => {
      const horaNum = parseInt(h);
      if (contagemPorHora[horaNum] > maxContagem) {
        maxContagem = contagemPorHora[horaNum];
      }
    });

    return maxContagem;
  };

  const calcularTicketMedioPorHora = (pedidos: Pedido[]): number => {
    if (pedidos.length === 0) return 0;

    // Agrupa pedidos por hora do dia
    const horas: Record<number, { total: number; count: number }> = {};

    pedidos.forEach(pedido => {
      if (pedido.status === 'CANCELADO') return;

      const hora = new Date(pedido.criado_em).getHours();
      if (!horas[hora]) {
        horas[hora] = { total: 0, count: 0 };
      }
      horas[hora].total += Number(pedido.valor_total);
      horas[hora].count += 1;
    });

    // Calcula a média de ticket por hora e retorna a maior média
    let maxMediaPorHora = 0;

    Object.keys(horas).forEach(h => {
      const horaNum = parseInt(h);
      if (horas[horaNum].count > 0) {
        const media = horas[horaNum].total / horas[horaNum].count;
        if (media > maxMediaPorHora) {
          maxMediaPorHora = media;
        }
      }
    });

    return maxMediaPorHora;
  };

  const getTicketMedioPorHora = (pedidos: Pedido[]): number => {
    return calcularTicketMedioPorHora(pedidos);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const calcularHorariosDePico = (pedidos: Pedido[]): string[] => {
    if (pedidos.length === 0) return [];

    // Conta pedidos por hora (excluindo cancelados)
    const contagemPorHora: Record<number, number> = {};

    pedidos.forEach(pedido => {
      if (pedido.status === 'CANCELADO') return;
      const hora = new Date(pedido.criado_em).getHours();
      contagemPorHora[hora] = (contagemPorHora[hora] || 0) + 1;
    });

    // Encontra as 3 horas com mais pedidos
    return Object.entries(contagemPorHora)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hora]) => {
        const horaNum = parseInt(hora);
        return `${horaNum.toString().padStart(2, '0')}:00-${((horaNum + 1) % 24).toString().padStart(2, '0')}:00`;
      });
  };

  // Funções para cálculo de tempo de preparo (métricas da cozinha)
  const calcularTempoPreparoMedio = (pedidos: Pedido[]): number => {
    const pedidosComTempo = pedidos
      .filter(p => p.status === 'PRONTO' || p.status === 'FINALIZADO' || p.status === 'EM_ROTA' || p.status === 'RETIRADA_BALCAO')
      .map(p => {
        const criadoEm = new Date(p.criado_em).getTime();
        // Consideramos o tempo até ficar PRONTO como tempo de preparo (aproximação)
        // Em um sistema ideal, teríamos timestamps específicos para início/fim de preparo
        const prontoEm = new Date().getTime(); // Aproximação - em um sistema real, teríamos um timestamp específico
        // Para melhor aproximação, usamos o tempo até o status atual se for recente
        // Esta é uma simplificação - em produção, seria melhor ter timestamps explícitos
        return prontoEm - criadoEm;
      });

    if (pedidosComTempo.length === 0) return 0;
    const soma = pedidosComTempo.reduce((acc, tempo) => acc + tempo, 0);
    return Math.round(soma / pedidosComTempo.length / 1000 / 60); // Converte para minutos
  };

  const calcularTempoPreparoPorProduto = (pedidos: Pedido[]): Array<{ nome: string; tempoMedio: number; quantidade: number }> => {
    const produtoStats = new Map<string, { totalTempo: number; count: number }>();

    pedidos.forEach(pedido => {
      if (pedido.status !== 'PRONTO' && pedido.status !== 'FINALIZADO' &&
          pedido.status !== 'EM_ROTA' && pedido.status !== 'RETIRADA_BALCAO') {
        return;
      }

      const criadoEm = new Date(p.criado_em).getTime();
      const tempoPedido = Date.now() - criadoEm; // Aproximação

      (pedido.itens_pedido || []).forEach(item => {
        const stats = produtoStats.get(item.nome_produto) || { totalTempo: 0, count: 0 };
        stats.totalTempo += tempoPedido;
        stats.count += 1;
        produtoStats.set(item.nome_produto, stats);
      });
    });

    return Array.from(produtoStats.entries())
      .map(([nome, stats]) => ({
        nome,
        tempoMedio: Math.round(stats.totalTempo / stats.count / 1000 / 60), // minutos
        quantidade: stats.count
      }))
      .sort((a, b) => b.tempoMedio - a.tempoMedio); // Ordena por tempo decrescente
  };

  const formatarTempo = (minutos: number): string => {
    if (isNaN(minutos) || minutos < 0) return '0 min';
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    if (horas > 0) {
      return `${horas}h ${mins}min`;
    }
    return `${mins} min`;
  };

  const passosFeitos = onboarding ? PASSOS_ONBOARDING.filter((p) => onboarding[p.chave]).length : 0;
  const onboardingCompleto = passosFeitos === PASSOS_ONBOARDING.length;
  const mostrarOnboarding = onboarding && !onboardingCompleto && !onboardingOculto;

  const ocultarOnboarding = () => {
    localStorage.setItem(`miseon_onb_ocultar_${lojaId}`, '1');
    setOnboardingOculto(true);
  };

  if (!dados) return <div className="p-8 text-center text-gray-400">Preparando o seu dia…</div>;

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Processar lotes vencendo para a seção de alertas
  const lotesVencidos = dados?.lotesVencendo?.filter(l => new Date(l.vence_em!) < new Date()) || [];
  const lotesQuaseVencendo = dados?.lotesVencendo?.filter(l => new Date(l.vence_em!) >= new Date()) || [];

  // Operador e entregador não veem números do negócio — vão direto para a operação.
  if (papel !== 'admin') return <Navigate to="/admin/pedidos" replace />;

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

      {/* ── Métricas da Cozinha ── */}
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Itens Mais Populares</h3>
          {dados.itensMaisPedidos.length === 0 ? (
            <p className="text-center text-sm text-gray-500">Nenhum dado disponível</p>
          ) : (
            <div className="space-y-2">
              {dados.itensMaisPedidos.slice(0, 5).map((item, index) => (
                <div key={index} className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <span className="font-medium">{item.nome}</span>
                  <span className="font-bold text-[var(--cor-primaria)]">+{item.quantidade}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Distribuição de Horários</h3>
          <div className="space-y-3">
            {/* Hora de pico simples baseado nos pedidos de hoje */}
            {dados.pedidosHoje.length > 0 ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Pedidos por hora (hoje):</span>
                  <span className="font-medium">{getHorarioPico(dados.pedidosHoje)}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--cor-primaria)]"
                       style={{ width: `${getPercentualHorarioPico(dados.pedidosHoje)}%` }}></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getContagemHorarioPico(dados.pedidosHoje)} pedidos na hora de pico
                </p>
              </>
            ) : (
              <p className="text-center text-sm text-gray-500">Aguardando dados...</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Ticket Médio por Hora</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatCurrency(getTicketMedioPorHora(dados.pedidosHoje))}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Valor médio por pedido em horários de maior movimento
          </p>
        </div>
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
            <>
              {/* Calcular lotes vencidos e prestes a vencer */}
              {(() => {
                const agora = new Date();
                const lotesVencidos = dados.lotesVencendo.filter(l => new Date(l.vence_em!) < agora);
                const lotesQuaseVencendo = dados.lotesVencendo.filter(l => new Date(l.vence_em!) >= agora);
                return null;
              })()}
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
                  {lotesVencidos.length > 2 && <p key="vencidos-mais" className="text-xs text-red-600 dark:text-red-400 text-center">+ {lotesVencidos.length - 2} outros vencidos</p>}

                  {lotesQuaseVencendo.slice(0, 2).map((l) => (
                    <p key={l.id} className="text-xs text-red-700/80 dark:text-red-300/80">
                      • {l.nomePreparo}: vence {new Date(l.vence_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ))}
                  {lotesQuaseVencendo.length > 2 && <p key="quase-vencendo-mais" className="text-xs text-red-700/80 dark:text-red-300/80 text-center">+ {lotesQuaseVencendo.length - 2} outros por vencer</p>}
                </div>
              </Link>
            </>
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
