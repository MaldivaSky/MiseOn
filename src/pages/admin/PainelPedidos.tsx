import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Printer, Bike, Check, X as XIcon, Store } from 'lucide-react';
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
      <div className="print:hidden">
        <h2 className="mb-1 text-xl font-bold dark:text-white">Cozinha & Despacho</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{pedidos.length} pedidos em andamento</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:hidden">
        {[...ativos, ...encerrados].map((p) => (
          <div key={p.id} className="flex flex-col rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800 dark:shadow-none overflow-hidden">
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
                    <Store size={18} /> Retirada no balcão
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
                  <button 
                    onClick={() => {
                      let proxStatus = FLUXO[p.status].prox!;
                      // Se for retirada no balcão, pula de PRONTO direto para FINALIZADO
                      if (p.tipo_pedido === 'RETIRADA_BALCAO' && p.status === 'PRONTO') {
                        proxStatus = 'FINALIZADO';
                      }
                      mudarStatus(p, proxStatus);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 font-bold text-white shadow-sm hover:opacity-90">
                    <Check size={18} /> 
                    {p.tipo_pedido === 'RETIRADA_BALCAO' && p.status === 'PRONTO' ? 'Finalizar Retirada' : FLUXO[p.status].label}
                  </button>
                )}
                <button onClick={() => { setImprimir(p); setTimeout(() => window.print(), 100); }}
                  className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 dark:border-gray-800 p-3 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
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
        <div className="hidden print:block font-mono text-black leading-tight" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', fontSize: '12px' }}>
          
          {/* VIA COZINHA */}
          <div className="comanda-print">
            <div className="text-center mb-2">
              <p className="font-bold text-base">================================</p>
              <h1 className="font-bold text-2xl uppercase mt-1">MISE ON</h1>
              <p className="text-xs uppercase">Gestão Inteligente</p>
              <p className="font-bold text-base mt-1">================================</p>
              
              <h2 className="font-bold text-lg uppercase mt-2">VIA DA COZINHA</h2>
            </div>
            
            <div className="mb-2">
              <p className="font-bold text-xl uppercase border-y-2 border-black border-dashed py-1 text-center my-2">
                PEDIDO #{imprimir.numero}
              </p>
              <p className="font-bold uppercase text-base text-center mb-2">
                * {imprimir.tipo_pedido === 'DELIVERY' ? 'ENTREGA' : 'RETIRADA NO BALCÃO'} *
              </p>
              <p>EMISSÃO: {new Date().toLocaleString('pt-BR')}</p>
              <p>PEDIDO : {new Date(imprimir.criado_em + (!imprimir.criado_em.includes('Z') && !imprimir.criado_em.includes('+') ? 'Z' : '')).toLocaleString('pt-BR')}</p>
            </div>

            <p className="font-bold text-base text-center mt-3 mb-1">--------------------------------</p>
            
            <div className="py-1">
              {imprimir.itens_pedido?.map((i) => (
                <div key={i.id} className="mb-3">
                  <div className="flex items-start">
                    <span className="font-bold text-base mr-2">{i.quantidade}x</span>
                    <span className="font-bold text-base uppercase leading-tight">{i.nome_produto}</span>
                  </div>
                  {i.itens_pedido_opcoes?.map((o, x) => (
                    <p key={x} className="text-xs ml-6 uppercase">
                      + {o.nome_opcao}
                    </p>
                  ))}
                  {i.observacao && (
                    <div className="ml-6 mt-1 border-l-2 border-black pl-2">
                      <p className="text-sm font-bold uppercase">OBS: {i.observacao}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <p className="font-bold text-base text-center mt-2 mb-2">================================</p>
            <div className="text-center text-[10px] mb-8">
              <p>*** FIM DA VIA COZINHA ***</p>
            </div>
          </div>
          
          <div className="break-after-page"></div>

          {/* VIA CLIENTE */}
          <div className="comanda-print">
            <div className="text-center mb-2">
              <p className="font-bold text-base">================================</p>
              <h1 className="font-bold text-2xl uppercase mt-1">MISE ON</h1>
              <p className="text-xs uppercase">Gestão Inteligente</p>
              <p className="font-bold text-base mt-1">================================</p>
              
              <h2 className="font-bold text-lg uppercase mt-2">CUPOM NÃO FISCAL</h2>
            </div>
            
            <div className="mb-2">
              <p className="font-bold text-xl uppercase border-y-2 border-black border-dashed py-1 text-center my-2">
                PEDIDO #{imprimir.numero}
              </p>
              <p className="font-bold uppercase text-base text-center mb-2">
                * {imprimir.tipo_pedido === 'DELIVERY' ? 'ENTREGA' : 'RETIRADA NO BALCÃO'} *
              </p>
              <p>EMISSÃO: {new Date().toLocaleString('pt-BR')}</p>
              <p>PEDIDO : {new Date(imprimir.criado_em + (!imprimir.criado_em.includes('Z') && !imprimir.criado_em.includes('+') ? 'Z' : '')).toLocaleString('pt-BR')}</p>
            </div>

            <p className="font-bold text-base text-center mt-3 mb-1">--------------------------------</p>
            
            <div className="mb-2">
              <p className="font-bold uppercase">CLIENTE: {imprimir.identificador_cliente}</p>
              <p>TEL: {imprimir.telefone_contato}</p>
              {imprimir.tipo_pedido === 'DELIVERY' && (
                <div className="mt-1">
                  <p className="font-bold uppercase">ENDEREÇO DE ENTREGA:</p>
                  <p className="uppercase">{imprimir.endereco_entrega} {imprimir.bairro ? `- ${imprimir.bairro}` : ''}</p>
                </div>
              )}
            </div>

            <p className="font-bold text-base text-center mt-2 mb-1">--------------------------------</p>
            
            <div className="py-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dashed border-black">
                    <th className="text-left font-normal pb-1">QTD</th>
                    <th className="text-left font-normal pb-1">ITEM</th>
                    <th className="text-right font-normal pb-1">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {imprimir.itens_pedido?.map((i) => (
                    <tr key={i.id} className="align-top">
                      <td className="pt-2 font-bold">{i.quantidade}x</td>
                      <td className="pt-2">
                        <div className="font-bold uppercase leading-tight">{i.nome_produto}</div>
                        {i.itens_pedido_opcoes?.map((o, x) => (
                          <div key={x} className="text-xs uppercase">+ {o.nome_opcao}</div>
                        ))}
                      </td>
                      <td className="pt-2 text-right">{fmt(Number(i.preco_unitario) * i.quantidade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="font-bold text-base text-center mt-2 mb-1">--------------------------------</p>
            
            <div className="py-1 text-sm">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>{fmt(Number(imprimir.subtotal))}</span>
              </div>
              {Number(imprimir.taxa_entrega) > 0 && (
                <div className="flex justify-between">
                  <span>TAXA ENTREGA:</span>
                  <span>{fmt(Number(imprimir.taxa_entrega))}</span>
                </div>
              )}
              {Number(imprimir.desconto) > 0 && (
                <div className="flex justify-between font-bold">
                  <span>DESCONTO:</span>
                  <span>-{fmt(Number(imprimir.desconto))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t-2 border-black border-dashed">
                <span>TOTAL:</span>
                <span>{fmt(Number(imprimir.valor_total))}</span>
              </div>
            </div>

            <p className="font-bold text-base text-center mt-3 mb-1">================================</p>

            <div className="py-1">
              <p className="font-bold uppercase text-center">FORMA DE PAGAMENTO</p>
              <p className="uppercase text-center text-base font-bold mt-1">
                {imprimir.pagamentos?.[0]?.metodo}
              </p>
              {imprimir.troco_para && (
                <p className="text-center font-bold uppercase mt-1">
                  (LEVAR TROCO PARA {fmt(Number(imprimir.troco_para))})
                </p>
              )}
            </div>

            <p className="font-bold text-base text-center mt-2 mb-1">================================</p>

            <div className="text-center text-xs mt-4 mb-4">
              <p className="font-bold">OBRIGADO PELA PREFERÊNCIA!</p>
              <p className="mt-1">MiseOn - O Sabor da Tecnologia</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
