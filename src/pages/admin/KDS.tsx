import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChefHat, Bike, Store, Maximize, Check, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type Pedido, type StatusPedido } from '../../types';
import { tocarSom } from '../../lib/som';
import type { CtxLoja } from './AdminLayout';

/* ─────────────────────────────────────────────────────────────
   KDS — tela da COZINHA, e só da cozinha.
   Fullscreen dark, letras grandes, zero burocracia:
   Fila → Preparando → Pronto, um toque avança.
   Sem preços, sem impressão, sem cancelamento (isso é do
   Painel de Pedidos, que é a visão da gerência/despacho).
   ───────────────────────────────────────────────────────────── */

const SELECT = 'id, numero, status, tipo_pedido, identificador_cliente, origem, criado_em, itens_pedido(id, nome_produto, quantidade, observacao, itens_pedido_opcoes(nome_opcao))';

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

export default function KDS() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [, setTick] = useState(0); // re-render por minuto para os cronômetros

  const carregar = async () => {
    const { data } = await supabase
      .from('pedidos').select(SELECT)
      .eq('loja_id', lojaId)
      .in('status', ['NOVO', 'ACEITO', 'PREPARANDO', 'PRONTO'])
      .gte('criado_em', new Date(Date.now() - 24 * 3600e3).toISOString())
      .order('criado_em', { ascending: true });
    setPedidos((data as unknown as Pedido[]) ?? []);
  };

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel(`kds-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, (payload) => {
        if (payload.eventType === 'INSERT') tocarSom();
        carregar();
      })
      .subscribe();
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => { supabase.removeChannel(canal); clearInterval(timer); };
  }, [lojaId]);

  const avancar = async (p: Pedido) => {
    const prox: StatusPedido = p.status === 'NOVO' ? 'ACEITO' : p.status === 'ACEITO' ? 'PREPARANDO' : 'PRONTO';
    await supabase.from('pedidos').update({ status: prox }).eq('id', p.id);
    carregar();
  };

  const fila = pedidos.filter((p) => ['NOVO', 'ACEITO'].includes(p.status));
  const preparando = pedidos.filter((p) => p.status === 'PREPARANDO');
  const prontos = pedidos.filter((p) => p.status === 'PRONTO');

  // "O que a cozinha precisa produzir agora" — itens agregados da fila + preparo
  const agregado = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of [...fila, ...preparando]) {
      for (const i of p.itens_pedido ?? []) {
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
    const min = minutosDesde(p.criado_em);
    const cor = corDoTempo(min);
    const finalizadoCozinha = p.status === 'PRONTO'; // despacho/entrega é papel do Painel de Pedidos
    return (
      <button onClick={() => !finalizadoCozinha && avancar(p)} disabled={finalizadoCozinha}
        className="w-full rounded-2xl bg-[#0F172A] p-4 text-left transition active:scale-[0.98] disabled:active:scale-100"
        style={{ border: `2px solid ${finalizadoCozinha ? 'rgba(16,185,129,0.4)' : cor.borda}`, animation: cor.pulso && !finalizadoCozinha ? 'pulse 1.6s infinite' : undefined }}>
        <div className="flex items-center justify-between">
          <span className="font-['Sora'] text-2xl font-black text-white">#{p.numero}</span>
          <span className="font-['JetBrains_Mono'] text-lg font-bold" style={{ color: cor.texto }}>
            {Math.floor(min)}min
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#6C7A96]">
          {p.origem === 'balcao' ? <Store size={12} /> : p.tipo_pedido === 'DELIVERY' ? <Bike size={12} /> : <Package size={12} />}
          {p.origem === 'balcao' ? 'BALCÃO' : p.tipo_pedido === 'DELIVERY' ? 'DELIVERY' : 'RETIRADA'} · {p.identificador_cliente}
        </div>
        <div className="mt-3 space-y-2">
          {p.itens_pedido?.map((i) => (
            <div key={i.id}>
              <p className="text-[15px] font-bold leading-tight text-[#EAF1FB]">
                <span className="text-orange-400">{i.quantidade}×</span> {i.nome_produto}
              </p>
              {i.itens_pedido_opcoes?.map((o, x) => (
                <p key={x} className="pl-5 text-[12px] text-[#8FA0BC]">+ {o.nome_opcao}</p>
              ))}
              {i.observacao && <p className="pl-5 text-[12px] font-bold text-red-400">⚠ {i.observacao.toUpperCase()}</p>}
            </div>
          ))}
        </div>
        {finalizadoCozinha ? (
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 py-2 text-center text-[12px] font-black uppercase tracking-wider text-emerald-400">
            <Check size={13} /> Aguardando retirada/despacho
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

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#070C18] px-4 pt-3 lg:h-screen">
      {/* ── Cabeçalho ── */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat size={22} className="text-orange-500" />
          <h2 className="font-['Sora'] text-xl font-black text-white">Cozinha</h2>
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
        </div>
        <button onClick={fullscreen} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-bold text-white/60 transition hover:text-white">
          <Maximize size={13} /> Tela cheia
        </button>
      </div>

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
        <Coluna titulo="Fila" cor="#FC5B24" lista={fila} acao={fila.some((p) => p.status === 'NOVO') ? 'aceitar / iniciar' : 'iniciar preparo'} vazio="Fila limpa 🎉" />
        <Coluna titulo="Preparando" cor="#0A5CC4" lista={preparando} acao="marcar pronto" vazio="Nada no fogo" />
        <Coluna titulo="Pronto" cor="#10B981" lista={prontos} acao="—" vazio="Nada aguardando" />
      </div>
    </div>
  );
}
