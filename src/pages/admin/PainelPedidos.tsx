import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Printer, Bike, Check, X as XIcon, Store, ChefHat, Receipt } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loja, Pedido, StatusPedido, fmt } from '../../types';
import { imprimir } from '../../lib/print';

type Via = 'cozinha' | 'romaneio' | 'nota';
import { tocarSom } from '../../lib/som';
import type { CtxLoja } from './AdminLayout';
import { MiseOnLoader } from '../../components/MiseOnLoader';
import MiseOnLogo from '../../components/MiseOnLogo';

/* ── Mapa de status → label + cor brand ── */
const FLUXO: Record<string, { prox?: StatusPedido; label?: string; bg: string; color: string }> = {
  NOVO:       { prox: 'ACEITO',     label: 'Aceitar pedido',   bg: 'rgba(252,91,36,.18)',  color: '#FC5B24' },
  ACEITO:     { prox: 'PREPARANDO', label: 'Preparando',       bg: 'rgba(10,92,196,.18)',  color: '#6B9EFF' },
  PREPARANDO: { prox: 'PRONTO',     label: 'Marcar pronto',    bg: 'rgba(10,92,196,.18)',  color: '#6B9EFF' },
  PRONTO:     { prox: 'EM_ROTA',    label: 'Saiu p/ entrega',  bg: 'rgba(124,58,237,.18)', color: '#A78BFA' },
  EM_ROTA:    { prox: 'FINALIZADO', label: 'Finalizar',        bg: 'rgba(16,185,129,.18)', color: '#34D399' },
  FINALIZADO: { bg: 'rgba(16,185,129,.14)', color: '#34D399' },
  CANCELADO:  { bg: 'rgba(239,68,68,.14)',  color: '#F87171' },
};

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'NOVO', ACEITO: 'ACEITO', PREPARANDO: 'PREP.', PRONTO: 'PRONTO',
  EM_ROTA: 'EM ROTA', FINALIZADO: 'FINALIZADO', CANCELADO: 'CANCELADO',
};

const SELECT = '*, itens_pedido(*, itens_pedido_opcoes(*)), pagamentos(metodo, status, valor_pago)';

/* ── Card de pedido com visual oficial MiseOn ── */
function CardPedido({
  p, onAvancar, onCancelar, onImprimir,
}: {
  p: Pedido;
  onAvancar: () => void;
  onCancelar: () => void;
  onImprimir: (via: Via) => void;
}) {
  const fluxo = FLUXO[p.status] ?? FLUXO.CANCELADO;
  const hora = new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDelivery = p.tipo_pedido === 'DELIVERY';

  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [menu]);

  const escolher = (via: Via) => { setMenu(false); onImprimir(via); };

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0B1120]"
      style={{ animation: 'mo-screen-in .45s cubic-bezier(.2,.8,.2,1) both' }}
    >
      {/* ── Header azul ── */}
      <div style={{ background: '#004198', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <img src="/brand/icon.png" alt="MiseOn" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </div>
          <span style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: 18,
            color: '#EAF1FB',
            letterSpacing: '.02em',
          }}>
            #{p.numero}
          </span>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          padding: '4px 10px',
          borderRadius: 8,
          background: fluxo.bg,
          color: fluxo.color,
          border: `1px solid ${fluxo.color}40`,
        }}>
          {STATUS_LABEL[p.status] || p.status}
        </span>
      </div>

      {/* ── Info cliente ── */}
      <div className="border-b border-gray-100 px-4 py-3 dark:border-white/5">
        <p className="m-0 font-['Sora'] text-sm font-semibold text-gray-900 dark:text-[#EAF1FB]">
          {p.identificador_cliente}
        </p>
        <div className="mt-1 flex justify-between">
          <span className="font-['JetBrains_Mono'] text-[11px] text-gray-500 dark:text-[#6C7A96]">{p.telefone_contato}</span>
          <span className="rounded-md bg-gray-100 px-2 py-[1px] font-['JetBrains_Mono'] text-[11px] text-gray-500 dark:bg-white/5 dark:text-[#6C7A96]">{hora}</span>
        </div>
      </div>

      {/* ── Status em destaque (se preparando/novo) ── */}
      {['NOVO','ACEITO','PREPARANDO'].includes(p.status) && (
        <div style={{ margin: '12px 16px 0', background: 'rgba(252,91,36,.1)', border: '1px solid rgba(252,91,36,.35)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, color: '#FE7A47' }}>
            {p.status === 'NOVO' ? 'Aguardando aceite' : p.status === 'ACEITO' ? 'Aceito — preparando na cozinha' : 'Preparando na cozinha'}
          </div>
          <div style={{ fontSize: 12, color: '#AEB9CE', marginTop: 4 }}>Estoque baixado por ficha técnica ✓</div>
        </div>
      )}

      {/* ── Itens ── */}
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {p.itens_pedido?.map((i) => (
          <div key={i.id} className="flex justify-between text-[13px]">
            <span className="text-gray-700 dark:text-[#AEB9CE]">
              {i.quantidade}× {i.nome_produto}
              {i.itens_pedido_opcoes?.map((o, x) => (
                <span key={x} className="mt-0.5 block text-[11px] text-gray-500 dark:text-[#6C7A96]">+ {o.nome_opcao}</span>
              ))}
              {i.observacao && (
                <span className="mt-0.5 block text-[11px] font-semibold text-red-500 dark:text-red-400">⚠ {i.observacao}</span>
              )}
            </span>
            <span className="ml-2 whitespace-nowrap font-['Sora'] font-semibold text-gray-900 dark:text-[#EAF1FB]">
              {fmt(Number(i.preco_unitario) * i.quantidade)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Entrega/Balcão ── */}
      <div className="mx-4 border-t border-gray-100 py-2.5 dark:border-white/5">
        {p.tipo_pedido === 'DELIVERY' ? (
          <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#AEB9CE]">
            <Bike size={14} className="mt-0.5 shrink-0 text-blue-500 dark:text-[#6B9EFF]" />
            <span>{p.endereco_entrega}{p.bairro ? ` — ${p.bairro}` : ''}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <Store size={14} /> Retirada no balcão
          </div>
        )}
      </div>

      <div className="px-4 py-3 flex justify-between border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
        <span className="font-['Sora'] font-bold text-[15px] text-gray-900 dark:text-gray-100">Total</span>
        <span className="font-['Sora'] font-bold text-[15px] text-orange-500">{fmt(Number(p.valor_total))}</span>
      </div>

      <div className="p-4 flex gap-2 border-t border-gray-100 dark:border-white/5">
        {fluxo.prox && (
          <button
            onClick={onAvancar}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-2.5 font-['Sora'] font-bold text-sm shadow-lg shadow-orange-500/20 hover:brightness-110 transition"
          >
            <Check size={16} /> {p.tipo_pedido === 'RETIRADA_BALCAO' && p.status === 'PRONTO' ? 'Finalizar' : fluxo.label}
          </button>
        )}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenu((m) => !m)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition"
            title="Imprimir via"
          >
            <Printer size={18} />
          </button>
          {menu && (
            <div className="absolute bottom-12 right-0 z-20 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0B1120]">
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Imprimir via</p>
              <button onClick={() => escolher('cozinha')} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
                <ChefHat size={16} className="text-orange-500" /> Comanda da Cozinha
              </button>
              {isDelivery && (
                <button onClick={() => escolher('romaneio')} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
                  <Bike size={16} className="text-blue-500" /> Romaneio do Entregador
                </button>
              )}
              <button onClick={() => escolher('nota')} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5">
                <Receipt size={16} className="text-emerald-500" /> Nota do Cliente
              </button>
            </div>
          )}
        </div>
        {['NOVO','ACEITO'].includes(p.status) && (
          <button
            onClick={onCancelar}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition"
          >
            <XIcon size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Filtros rápidos por status ── */
const FILTROS: { id: string; label: string; status: StatusPedido[] }[] = [
  { id: 'TODOS',      label: 'Todos',       status: [] },
  { id: 'ABERTOS',    label: 'Abertos',     status: ['NOVO', 'ACEITO'] },
  { id: 'PREPARANDO', label: 'Preparando',  status: ['PREPARANDO'] },
  { id: 'PRONTOS',    label: 'Prontos',     status: ['PRONTO'] },
  { id: 'EM_ROTA',    label: 'Em rota',     status: ['EM_ROTA'] },
  { id: 'FINALIZADOS',label: 'Finalizados', status: ['FINALIZADO'] },
  { id: 'CANCELADOS', label: 'Cancelados',  status: ['CANCELADO'] },
];

export default function PainelPedidos() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [filtro, setFiltro] = useState('TODOS');

  useEffect(() => {
    supabase.from('lojas').select('*').eq('id', lojaId).single()
      .then(({ data }) => setLoja((data as Loja) ?? null));
  }, [lojaId]);

  const carregar = async () => {
    const { data } = await supabase
      .from('pedidos').select(SELECT)
      .eq('loja_id', lojaId)
      .gte('criado_em', new Date(Date.now() - 24 * 3600e3).toISOString())
      .order('criado_em', { ascending: false });
    setPedidos((data as Pedido[]) ?? []);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    if ('Notification' in window) Notification.requestPermission?.();
    const canal = supabase
      .channel('pedidos-loja')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          carregar();
          if (payload.eventType === 'INSERT') {
            tocarSom();
            const p = payload.new as Pedido;
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`🛎 Novo pedido #${p.numero}`, {
                body: `${p.identificador_cliente} · ${fmt(Number(p.valor_total))}`,
              });
            }
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId]);

  const mudarStatus = async (p: Pedido, status: StatusPedido) => {
    await supabase.from('pedidos').update({ status }).eq('id', p.id);
    carregar();
  };

  const ativos = pedidos.filter((p) => !['FINALIZADO', 'CANCELADO'].includes(p.status));
  const encerrados = pedidos.filter((p) => ['FINALIZADO', 'CANCELADO'].includes(p.status));

  const contagem = (f: (typeof FILTROS)[number]) =>
    f.status.length === 0 ? pedidos.length : pedidos.filter((p) => f.status.includes(p.status)).length;

  const filtroAtivo = FILTROS.find((f) => f.id === filtro) ?? FILTROS[0];
  const visiveis = [...ativos, ...encerrados].filter(
    (p) => filtroAtivo.status.length === 0 || filtroAtivo.status.includes(p.status),
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-5 dark:bg-[#070C18]">
      <div className="print:hidden mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-['JetBrains_Mono'] text-[11px] tracking-[0.28em] text-orange-500 uppercase">PAINEL · AO VIVO</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
        </div>
        <h2 className="m-0 font-['Sora'] text-[26px] font-extrabold text-gray-900 dark:text-white">Cozinha &amp; Despacho</h2>
        <p className="mt-1 font-['JetBrains_Mono'] text-xs text-gray-500 dark:text-gray-400">
          {pedidos.length} pedidos hoje · {ativos.length} em andamento
        </p>

        {/* ── Filtro por status ── */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {FILTROS.map((f) => {
            const qtd = contagem(f);
            const ativo = filtro === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-['Sora'] text-xs font-bold transition ${
                  ativo
                    ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/25'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
                }`}
              >
                {f.label}
                <span className={`rounded-full px-1.5 py-px font-['JetBrains_Mono'] text-[10px] ${ativo ? 'bg-white/25' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                  {qtd}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {carregando && (
        <div className="flex justify-center pt-16">
          <MiseOnLoader status="Sincronizando pedidos" rows={3} />
        </div>
      )}

      {!carregando && (
        <div className="print:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visiveis.map((p) => (
            <CardPedido
              key={p.id}
              p={p}
              onAvancar={() => {
                let proxStatus = FLUXO[p.status]?.prox!;
                if (p.tipo_pedido === 'RETIRADA_BALCAO' && p.status === 'PRONTO') proxStatus = 'FINALIZADO';
                mudarStatus(p, proxStatus);
              }}
              onCancelar={() => { if (confirm('Cancelar pedido?')) mudarStatus(p, 'CANCELADO'); }}
              onImprimir={(v) => {
                const map: Record<Via, any> = { cozinha: 'COMANDA_COZINHA', romaneio: 'VIA_ENTREGADOR', nota: 'RECIBO_CLIENTE' };
                imprimir({ template: map[v], lojaNome: loja?.nome || 'MiseOn', loja, pedido: p, itens: p.itens_pedido });
              }}
            />
          ))}
          {visiveis.length === 0 && (
            <div className="col-span-full pt-16 text-center">
              <img src="/brand/icon.png" alt="" className="mx-auto mb-4 w-14 opacity-30 dark:opacity-20" />
              <p className="font-['JetBrains_Mono'] text-[13px] tracking-wider text-gray-500 dark:text-[#6C7A96]">
                {pedidos.length === 0 ? 'NENHUM PEDIDO AINDA.' : `NENHUM PEDIDO EM "${filtroAtivo.label.toUpperCase()}".`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
