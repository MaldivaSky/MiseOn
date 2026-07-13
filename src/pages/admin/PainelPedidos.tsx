import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Printer, Bike, Check, X as XIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Pedido, StatusPedido, fmt } from '../../types';
import { tocarSom } from '../../lib/som';
import type { CtxLoja } from './AdminLayout';

const FLUXO: Record<string, { prox?: StatusPedido; label?: string; cor: string }> = {
  NOVO:       { prox: 'ACEITO',     label: 'Aceitar',          cor: 'bg-amber-100 text-amber-700' },
  ACEITO:     { prox: 'PREPARANDO', label: 'Preparando',       cor: 'bg-blue-100 text-blue-700' },
  PREPARANDO: { prox: 'PRONTO',     label: 'Pronto',           cor: 'bg-indigo-100 text-indigo-700' },
  PRONTO:     { prox: 'EM_ROTA',    label: 'Saiu p/ entrega',  cor: 'bg-purple-100 text-purple-700' },
  EM_ROTA:    { prox: 'FINALIZADO', label: 'Finalizar',        cor: 'bg-cyan-100 text-cyan-700' },
  FINALIZADO: { cor: 'bg-green-100 text-green-700' },
  CANCELADO:  { cor: 'bg-red-100 text-red-600' },
};

const SELECT = '*, itens_pedido(*, itens_pedido_opcoes(*)), pagamentos(metodo, status, valor_pago)';

export default function PainelPedidos() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [imprimir, setImprimir] = useState<Pedido | null>(null);

  const carregar = async () => {
    const { data } = await supabase
      .from('pedidos').select(SELECT)
      .eq('loja_id', lojaId)
      .gte('criado_em', new Date(Date.now() - 24 * 3600e3).toISOString())
      .order('criado_em', { ascending: false });
    setPedidos((data as Pedido[]) ?? []);
  };

  useEffect(() => {
    carregar();
    Notification?.requestPermission?.();
    const canal = supabase
      .channel('pedidos-loja')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          carregar();
          if (payload.eventType === 'INSERT') {
            tocarSom();
            const p = payload.new as Pedido;
            if (Notification.permission === 'granted') {
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

  return (
    <div className="p-4">
      <h2 className="mb-3 font-bold">Pedidos de hoje ({ativos.length} ativos)</h2>
      <div className="space-y-3">
        {[...ativos, ...encerrados].map((p) => (
          <div key={p.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold">#{p.numero}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${FLUXO[p.status].cor}`}>
                  {p.status.replace('_', ' ')}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <p className="mt-1 text-sm font-medium">{p.identificador_cliente} · {p.telefone_contato}</p>
            <p className="text-xs text-gray-500">
              {p.tipo_pedido === 'DELIVERY' ? <>🛵 {p.endereco_entrega}{p.bairro ? ` — ${p.bairro}` : ''}</> : '🏪 Retirada no balcão'}
            </p>

            <ul className="mt-2 space-y-1 border-t pt-2 text-sm">
              {p.itens_pedido?.map((i) => (
                <li key={i.id}>
                  <span className="font-medium">{i.quantidade}x {i.nome_produto}</span>
                  {i.itens_pedido_opcoes?.map((o, x) => <span key={x} className="block pl-4 text-xs text-gray-500">+ {o.nome_opcao}</span>)}
                  {i.observacao && <span className="block pl-4 text-xs italic text-amber-600">Obs: {i.observacao}</span>}
                </li>
              ))}
            </ul>

            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
              <span className="text-gray-500">
                {p.pagamentos?.[0]?.metodo}
                {p.pagamentos?.[0]?.status === 'PAGO' && <span className="ml-1 font-semibold text-green-600">· PAGO ✓</span>}
                {p.troco_para && <> · troco p/ {fmt(Number(p.troco_para))}</>}
              </span>
              <span className="font-bold">{fmt(Number(p.valor_total))}</span>
            </div>

            <div className="mt-3 flex gap-2">
              {FLUXO[p.status].prox && (
                <button
                  onClick={() => mudarStatus(p, FLUXO[p.status].prox!)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white"
                >
                  {p.status === 'PRONTO' ? <Bike size={15} /> : <Check size={15} />} {FLUXO[p.status].label}
                </button>
              )}
              <button onClick={() => { setImprimir(p); setTimeout(() => window.print(), 100); }}
                className="rounded-xl border px-3 py-2.5 text-gray-500"><Printer size={16} /></button>
              {p.status === 'NOVO' && (
                <button onClick={() => mudarStatus(p, 'CANCELADO')} className="rounded-xl border border-red-200 px-3 py-2.5 text-red-500">
                  <XIcon size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
        {pedidos.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum pedido nas últimas 24h.</p>}
      </div>

      {/* Comanda térmica 80mm — 2 vias: cozinha (sem preço) + cliente (com preço) */}
      {imprimir && (
        <>
          <div className="comanda-print hidden print:block">
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15 }}>VIA COZINHA</p>
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>PEDIDO #{imprimir.numero}</p>
            <p style={{ textAlign: 'center' }}>{new Date(imprimir.criado_em).toLocaleString('pt-BR')}</p>
            <hr />
            <p style={{ fontWeight: 'bold' }}>{imprimir.tipo_pedido === 'DELIVERY' ? '🛵 ENTREGA' : '🏪 RETIRADA NO BALCAO'}</p>
            <hr />
            {imprimir.itens_pedido?.map((i) => (
              <div key={i.id} style={{ marginBottom: 6 }}>
                <p style={{ fontWeight: 'bold', fontSize: 14 }}>{i.quantidade}x {i.nome_produto}</p>
                {i.itens_pedido_opcoes?.map((o, x) => <p key={x}>&nbsp;&nbsp;+ {o.nome_opcao}</p>)}
                {i.observacao && <p style={{ fontWeight: 'bold' }}>&nbsp;&nbsp;OBS: {i.observacao}</p>}
              </div>
            ))}
            <hr />
            <p style={{ textAlign: 'center' }}>MiseOn · pedido online</p>
          </div>

          <div className="comanda-print hidden print:block">
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15 }}>VIA CLIENTE</p>
            <p style={{ textAlign: 'center', fontWeight: 'bold' }}>PEDIDO #{imprimir.numero}</p>
            <p style={{ textAlign: 'center' }}>{new Date(imprimir.criado_em).toLocaleString('pt-BR')}</p>
            <hr />
            <p>{imprimir.identificador_cliente} — {imprimir.telefone_contato}</p>
            <p>{imprimir.tipo_pedido === 'DELIVERY' ? `ENTREGA: ${imprimir.endereco_entrega} ${imprimir.bairro ?? ''}` : 'RETIRADA NO BALCAO'}</p>
            <hr />
            {imprimir.itens_pedido?.map((i) => (
              <div key={i.id}>
                <p><b>{i.quantidade}x {i.nome_produto}</b> — {fmt(Number(i.preco_unitario) * i.quantidade)}</p>
                {i.itens_pedido_opcoes?.map((o, x) => <p key={x}>&nbsp;&nbsp;+ {o.nome_opcao}</p>)}
                {i.observacao && <p>&nbsp;&nbsp;OBS: {i.observacao}</p>}
              </div>
            ))}
            <hr />
            <p>Subtotal: {fmt(Number(imprimir.subtotal))}</p>
            {Number(imprimir.taxa_entrega) > 0 && <p>Entrega: {fmt(Number(imprimir.taxa_entrega))}</p>}
            {Number(imprimir.desconto) > 0 && <p>Desconto: -{fmt(Number(imprimir.desconto))}</p>}
            <p style={{ fontWeight: 'bold' }}>TOTAL: {fmt(Number(imprimir.valor_total))}</p>
            <p>Pgto: {imprimir.pagamentos?.[0]?.metodo}{imprimir.troco_para ? ` (troco p/ ${fmt(Number(imprimir.troco_para))})` : ''}</p>
            <hr />
            <p style={{ textAlign: 'center' }}>MiseOn · pedido online</p>
          </div>
        </>
      )}
    </div>
  );
}
