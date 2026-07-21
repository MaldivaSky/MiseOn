import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChefHat, Bike, Store, Maximize, Check, Package, UtensilsCrossed, Trophy, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type Pedido, type StatusPedido } from '../../types';
import { tocarSom } from '../../lib/som';
import { traduzirErro, type ErroTraduzido } from '../../lib/erros';
import { ErroAmigavel } from '../../components/ui/ErroAmigavel';
import type { CtxLoja } from './AdminLayout';

/* ─────────────────────────────────────────────────────────────
   KDS — tela da COZINHA, e só da cozinha.
   Fullscreen dark, letras grandes, zero burocracia:
   Fila → Preparando → Pronto, um toque avança.
   Fluxo passa-bastão (docs/PLANO-FLUXO-PEDIDOS.md): só entram aqui
   pedidos com requer_cozinha=true que o BALCÃO já enviou (bastão em
   COZINHA). "Aceitar" (NOVO→ACEITO) é ato do balcão, não da cozinha.
   Itens de revenda direta do mesmo pedido aparecem apagados (contexto,
   sem ação) — quem entrega são eles, não a cozinha.
   ───────────────────────────────────────────────────────────── */

const SELECT = 'id, numero, status, tipo_pedido, identificador_cliente, origem, mesa_numero, agendado_para, criado_em, estacao_atual, requer_cozinha, ' +
  'itens_pedido(id, nome_produto, quantidade, observacao, itens_pedido_opcoes(nome_opcao), produtos(estacao_preparo))';

// minutos até o card mudar de cor (atenção / atraso)
const LIMITE_ATENCAO_MIN = 10;
const LIMITE_ATRASO_MIN = 20;

function minutosDesde(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function corDoTempo(min: number) {
  if (min >= LIMITE_ATRASO_MIN) return { borda: '#EF4444', texto: '#F87171', pulso: true };
  if (min >= LIMITE_ATENCAO_MIN) return { borda: '#F59E0B', texto: '#FBBF24', pulso: false };
  return { borda: 'rgba(255,255,255,0.12)', texto: '#6C7A96', pulso: false };
}

interface Operador { user_id: string; nome: string | null }
interface Metricas {
  meta_min: number;
  por_dia: { dia: string; pedidos: number; media_total_min: number; pct_dentro_meta: number }[];
  ranking_operadores: { operador_user_id: string | null; operador_nome: string; pedidos: number; media_min: number }[];
  media_hoje_min: number | null;
  pedidos_hoje: number | null;
}

export default function KDS() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [antecedenciaMin, setAntecedenciaMin] = useState<number | null>(null); // null = ainda não carregou a config da loja
  const [, setTick] = useState(0); // re-render por minuto para os cronômetros
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadorAtivo, setOperadorAtivo] = useState<string | null>(() => localStorage.getItem(`miseon_kds_operador_${lojaId}`));
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [celebrar, setCelebrar] = useState(false);
  const [erroAcao, setErroAcao] = useState<ErroTraduzido | null>(null);

  useEffect(() => {
    supabase.from('lojas').select('agendamento_antecedencia_min').eq('id', lojaId).single()
      .then(({ data }) => setAntecedenciaMin(data?.agendamento_antecedencia_min ?? 30));
    supabase.from('usuarios_loja').select('user_id, nome').eq('loja_id', lojaId).in('papel', ['admin', 'operador'])
      .then(({ data }) => setOperadores((data as Operador[]) ?? []));
  }, [lojaId]);

  const carregarMetricas = async () => {
    const { data, error } = await supabase.rpc('fn_metricas_cozinha', { p_loja_id: lojaId });
    if (error || !data) return;
    const m = data as Metricas;
    setMetricas((anterior) => {
      // Celebra quando o dia vira "dentro da meta" pela primeira vez nesta sessão
      // (não precisa de histórico de recorde — já é uma vitória real e não-bloqueante).
      if (anterior && m.pedidos_hoje && m.media_hoje_min != null
        && m.media_hoje_min <= m.meta_min && !(anterior.media_hoje_min != null && anterior.media_hoje_min <= anterior.meta_min)) {
        setCelebrar(true);
        setTimeout(() => setCelebrar(false), 4000);
      }
      return m;
    });
  };

  // Pedidos agendados só entram na fila da cozinha perto da hora (antecedência da
  // loja) — senão um agendamento pra amanhã apareceria hoje como se estivesse atrasado.
  const carregar = async () => {
    if (antecedenciaMin === null) return;
    const cutoffProducao = new Date(Date.now() + antecedenciaMin * 60000).toISOString();
    const cutoff24h = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { data } = await supabase
      .from('pedidos').select(SELECT)
      .eq('loja_id', lojaId)
      .eq('requer_cozinha', true)
      .in('status', ['ACEITO', 'PREPARANDO', 'PRONTO'])
      // só aparece quando o balcão já passou o bastão (ou, na coluna Pronto,
      // como confirmação de quem acabou de sair da cozinha)
      .or('estacao_atual.eq.COZINHA,status.eq.PRONTO')
      // relevante hoje: criado recentemente OU tem agendamento
      .or(`criado_em.gte.${cutoff24h},agendado_para.not.is.null`)
      // só entra na fila quando está perto da hora de começar a preparar
      .or(`agendado_para.is.null,agendado_para.lte.${cutoffProducao}`)
      .order('criado_em', { ascending: true });
    setPedidos((data as unknown as Pedido[]) ?? []);
  };

  useEffect(() => {
    if (antecedenciaMin === null) return;
    carregar();
    carregarMetricas();
    const canal = supabase
      .channel(`kds-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, (payload) => {
        if (payload.eventType === 'INSERT') tocarSom();
        carregar();
      })
      .subscribe();
    const timer = setInterval(() => { setTick((t) => t + 1); carregar(); carregarMetricas(); }, 60_000);
    return () => { supabase.removeChannel(canal); clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaId, antecedenciaMin]);

  const escolherOperador = (userId: string) => {
    const novo = operadorAtivo === userId ? null : userId;
    setOperadorAtivo(novo);
    if (novo) localStorage.setItem(`miseon_kds_operador_${lojaId}`, novo);
    else localStorage.removeItem(`miseon_kds_operador_${lojaId}`);
  };

  const avancar = async (p: Pedido) => {
    const prox: StatusPedido = p.status === 'ACEITO' ? 'PREPARANDO' : 'PRONTO';
    const { error } = await supabase.rpc('fn_avancar_status_pedido', {
      p_pedido_id: p.id, p_novo_status: prox, p_operador_user_id: operadorAtivo,
    });
    // Antes isto quebrava em silêncio (promise rejeitada sem catch): a cozinha
    // tocava no card e nada acontecia. Agora o motivo aparece em linguagem humana.
    if (error) {
      setErroAcao(traduzirErro(error));
      return;
    }
    setErroAcao(null);
    carregar();
    carregarMetricas();
  };

  const fila = pedidos.filter((p) => p.status === 'ACEITO');
  const preparando = pedidos.filter((p) => p.status === 'PREPARANDO');
  const prontos = pedidos.filter((p) => p.status === 'PRONTO');

  // "O que a cozinha precisa produzir agora" — itens agregados da fila + preparo,
  // só os de preparo (revenda direta não entra na conta da cozinha).
  const agregado = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of [...fila, ...preparando]) {
      for (const i of p.itens_pedido ?? []) {
        if ((i as any).produtos?.estacao_preparo === 'DIRETO') continue;
        mapa.set(i.nome_produto, (mapa.get(i.nome_produto) ?? 0) + i.quantidade);
      }
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [pedidos]);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  const Card = ({ p, acao }: { p: Pedido; acao: string }) => {
    // Pedido agendado: o cronômetro conta a partir da hora marcada, não da criação
    // (senão um agendamento de ontem apareceria como "1440min atrasado").
    const referencia = p.agendado_para && new Date(p.agendado_para) > new Date(p.criado_em) ? p.agendado_para : p.criado_em;
    const min = minutosDesde(referencia);
    const cor = corDoTempo(min);
    const finalizadoCozinha = p.status === 'PRONTO'; // despacho/entrega é papel do Painel de Pedidos
    return (
      <button onClick={() => !finalizadoCozinha && avancar(p)} disabled={finalizadoCozinha}
        className="w-full rounded-2xl bg-[#0F172A] p-4 text-left transition active:scale-[0.98] disabled:active:scale-100"
        style={{ border: `2px solid ${finalizadoCozinha ? 'rgba(16,185,129,0.4)' : cor.borda}`, animation: cor.pulso && !finalizadoCozinha ? 'pulse 1.6s infinite' : undefined }}>
        <div className="flex items-center justify-between">
          <span className="font-['Sora'] text-2xl font-black text-white">#{p.numero}</span>
          <span className="font-['JetBrains_Mono'] text-lg font-bold" style={{ color: cor.texto }}>
            {min >= 0 ? `${Math.floor(min)}min` : `em ${Math.ceil(-min)}min`}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#6C7A96]">
          {p.tipo_pedido === 'SALAO'
            ? <UtensilsCrossed size={12} />
            : p.origem === 'balcao' ? <Store size={12} /> : p.tipo_pedido === 'DELIVERY' ? <Bike size={12} /> : <Package size={12} />}
          {p.tipo_pedido === 'SALAO' ? `MESA ${p.mesa_numero ?? '—'}` : p.origem === 'balcao' ? 'BALCÃO' : p.tipo_pedido === 'DELIVERY' ? 'DELIVERY' : 'RETIRADA'} · {p.identificador_cliente}
          {p.agendado_para && (
            <span className="ml-auto shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400">
              Agendado {new Date(p.agendado_para).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {p.itens_pedido?.map((i) => {
            const revenda = (i as any).produtos?.estacao_preparo === 'DIRETO';
            if (revenda) {
              return (
                <p key={i.id} className="text-[12px] italic text-[#4B5872]">
                  <Store size={10} className="mr-1 inline" /> no balcão: {i.quantidade}× {i.nome_produto}
                </p>
              );
            }
            return (
              <div key={i.id}>
                <p className="text-[15px] font-bold leading-tight text-[#EAF1FB]">
                  <span className="text-orange-400">{i.quantidade}×</span> {i.nome_produto}
                </p>
                {i.itens_pedido_opcoes?.map((o, x) => (
                  <p key={x} className="pl-5 text-[12px] text-[#8FA0BC]">+ {o.nome_opcao}</p>
                ))}
                {i.observacao && <p className="pl-5 text-[12px] font-bold text-red-400">⚠ {i.observacao.toUpperCase()}</p>}
              </div>
            );
          })}
        </div>
        {finalizadoCozinha ? (
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 py-2 text-center text-[12px] font-black uppercase tracking-wider text-emerald-400">
            <Check size={13} /> Devolvido ao balcão
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-white/5 py-2 text-center text-[12px] font-black uppercase tracking-wider text-white/70">
            Toque → {acao}
          </div>
        )}
      </button>
    );
  };

  const Coluna = ({ titulo, cor, lista, acao, vazio }: { titulo: string; cor: string; lista: Pedido[]; acao: string; vazio: string }) => (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="font-['JetBrains_Mono'] text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: cor }}>{titulo}</span>
        <span className="rounded-full px-2.5 py-0.5 font-['Sora'] text-sm font-black text-white" style={{ background: cor }}>{lista.length}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pb-4 pr-1">
        {lista.map((p) => <Card key={p.id} p={p} acao={acao} />)}
        {lista.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-[13px] text-[#3D4A63]">{vazio}</div>
        )}
      </div>
    </div>
  );

  const dentroDaMeta = metricas?.media_hoje_min != null && metricas.media_hoje_min <= metricas.meta_min;
  const corMeta = metricas?.media_hoje_min == null ? '#6C7A96' : dentroDaMeta ? '#34D399' : '#F87171';

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#070C18] px-4 pt-3 lg:h-screen">
      {/* ── Cabeçalho ── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <ChefHat size={22} className="text-orange-500" />
          <h2 className="font-['Sora'] text-xl font-black text-white">Cozinha</h2>
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
        </div>
        <div className="flex items-center gap-2">
          {metricas && (
            <div className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold" style={{ color: corMeta }}>
              <Flame size={13} />
              {metricas.media_hoje_min != null ? `${metricas.media_hoje_min}min hoje` : 'sem dados hoje'} · meta {metricas.meta_min}min
            </div>
          )}
          <button onClick={fullscreen} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-white/60 transition hover:text-white">
            <Maximize size={13} /> Tela cheia
          </button>
        </div>
      </div>

      {/* ── Erro de ação (ex.: pedido ainda não enviado pelo balcão) ── */}
      {erroAcao && (
        <div className="mb-3 max-w-2xl">
          <ErroAmigavel erro={erroAcao} onFechar={() => setErroAcao(null)} />
        </div>
      )}

      {/* ── Seletor de operador (quem está na cozinha agora) ── */}
      {operadores.length > 0 && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[0.2em] text-[#6C7A96]">Na cozinha:</span>
          {operadores.map((op) => (
            <button key={op.user_id} onClick={() => escolherOperador(op.user_id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
                operadorAtivo === op.user_id
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
              }`}>
              {op.nome || 'Sem nome'}
            </button>
          ))}
        </div>
      )}

      {/* ── Para produzir agora (agregado) ── */}
      {agregado.length > 0 && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2">
          <span className="shrink-0 font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">Na fila:</span>
          {agregado.map(([nome, qtd]) => (
            <span key={nome} className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[12px] font-bold text-[#EAF1FB]">
              <span className="text-orange-400">{qtd}×</span> {nome}
            </span>
          ))}
        </div>
      )}

      {/* ── Colunas ── */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        <Coluna titulo="Fila" cor="#FC5B24" lista={fila} acao="iniciar preparo" vazio="Fila limpa 🎉" />
        <Coluna titulo="Preparando" cor="#0A5CC4" lista={preparando} acao="marcar pronto" vazio="Nada no fogo" />
        <Coluna titulo="Pronto" cor="#10B981" lista={prontos} acao="—" vazio="Nada aguardando" />
      </div>

      {/* ── Celebração não-bloqueante ao entrar na meta ── */}
      {celebrar && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-emerald-300 shadow-2xl backdrop-blur-sm" style={{ animation: 'mo-screen-in .3s ease-out' }}>
          <Trophy size={20} /> <span className="font-['Sora'] text-sm font-black">Dentro da meta hoje! 🔥</span>
        </div>
      )}
    </div>
  );
}
