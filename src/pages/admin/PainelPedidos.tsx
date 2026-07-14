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
    <div className="p-4 md:p-6 min-h-[calc(100vh-80px)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold dark:text-gray-100">Cozinha & Despacho</h2>
          <p className="text-sm text-gray-500">{ativos.length} pedidos em andamento</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...ativos, ...encerrados].map((p) => (
          <div key={p.id} className="flex flex-col rounded-2xl bg-white shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800 dark:shadow-none overflow-hidden">
            {/* Header da Comanda */}
            <div className={`p-4 border-b-4 ${p.tipo_pedido === 'DELIVERY' ? 'border-[var(--cor-primaria)]' : 'border-emerald-500'} dark:border-opacity-80`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-3xl font-black tracking-tight dark:text-white">#{p.numero}</span>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${FLUXO[p.status].cor}`}>
                  {p.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm font-semibold truncate dark:text-gray-200">{p.identificador_cliente}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{p.telefone_contato}</span>
                <span className="font-medium bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
                  {new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Corpo da Comanda (Itens) */}
            <div className="flex-1 p-4 bg-gray-50/50 dark:bg-gray-900/50">
              <ul className="space-y-4">
                {p.itens_pedido?.map((i) => (
                  <li key={i.id} className="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-200 dark:bg-gray-800 text-sm font-bold dark:text-white">
                        {i.quantidade}
                      </span>
                      <div className="flex-1 pt-0.5">
                        <span className="text-base font-bold leading-tight dark:text-gray-100">{i.nome_produto}</span>
                        
                        {i.itens_pedido_opcoes && i.itens_pedido_opcoes.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {i.itens_pedido_opcoes.map((o, x) => (
                              <span key={x} className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
                                + {o.nome_opcao}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {i.observacao && (
                          <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2">
                            <span className="text-sm font-bold text-red-700 dark:text-red-400 uppercase leading-snug">
                              ATENÇÃO: {i.observacao}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Rodapé da Comanda */}
            <div className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="mb-3 rounded-xl bg-gray-50 dark:bg-gray-800 p-2.5 text-sm">
                {p.tipo_pedido === 'DELIVERY' ? (
                  <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <Bike size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{p.endereco_entrega}</p>
                      {p.bairro && <p className="text-xs text-gray-500 dark:text-gray-400">Bairro: {p.bairro}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 font-bold text-[var(--cor-primaria)]">
                    🏪 Retirada no balcão
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between font-bold dark:text-white mb-4">
                <span>Total</span>
                <span className="text-lg">{fmt(Number(p.valor_total))}</span>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-2">
                {FLUXO[p.status].prox && (
                  <button onClick={() => mudarStatus(p, FLUXO[p.status].prox!)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 font-bold text-white shadow-sm hover:opacity-90">
                    <Check size={18} /> {FLUXO[p.status].label}
                  </button>
                )}
                <button onClick={() => { setImprimir(p); setTimeout(() => window.print(), 100); }}
                  className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white p-3 text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                  <Printer size={20} />
                </button>
                {['NOVO', 'ACEITO'].includes(p.status) && (
                  <button onClick={() => { if (confirm('Cancelar pedido?')) mudarStatus(p, 'CANCELADO'); }}
                    className="flex shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 p-3 text-red-600 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                    <XIcon size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {pedidos.length === 0 && <p className="col-span-full py-12 text-center text-gray-400">Nenhum pedido hoje ainda.</p>}
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
