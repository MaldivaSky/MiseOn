import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Printer, Bike, Check, X as XIcon, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Pedido, StatusPedido, fmt } from '../../types';
import { tocarSom } from '../../lib/som';
import type { CtxLoja } from './AdminLayout';
import { MiseOnLoader } from '../../components/MiseOnLoader';

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
  onImprimir: () => void;
}) {
  const fluxo = FLUXO[p.status] ?? FLUXO.CANCELADO;
  const hora = new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        background: '#0B1120',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 20,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'mo-screen-in .45s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      {/* ── Header azul ── */}
      <div style={{ background: '#004198', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/brand/logo.png" alt="" style={{ height: 20, filter: 'brightness(0) invert(1)' }} />
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
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 14, color: '#EAF1FB', margin: 0 }}>
          {p.identificador_cliente}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6C7A96' }}>{p.telefone_contato}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6C7A96', background: 'rgba(255,255,255,.06)', padding: '1px 8px', borderRadius: 6 }}>{hora}</span>
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
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {p.itens_pedido?.map((i) => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#AEB9CE' }}>
              {i.quantidade}× {i.nome_produto}
              {i.itens_pedido_opcoes?.map((o, x) => (
                <span key={x} style={{ display: 'block', fontSize: 11, color: '#6C7A96', marginTop: 2 }}>+ {o.nome_opcao}</span>
              ))}
              {i.observacao && (
                <span style={{ display: 'block', fontSize: 11, color: '#F87171', marginTop: 2, fontWeight: 600 }}>⚠ {i.observacao}</span>
              )}
            </span>
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, color: '#EAF1FB', whiteSpace: 'nowrap', marginLeft: 8 }}>
              {fmt(Number(i.preco_unitario) * i.quantidade)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Entrega/Balcão ── */}
      <div style={{ margin: '0 16px', borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 10, paddingBottom: 10 }}>
        {p.tipo_pedido === 'DELIVERY' ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#AEB9CE' }}>
            <Bike size={14} style={{ marginTop: 2, flexShrink: 0, color: '#6B9EFF' }} />
            <span>{p.endereco_entrega}{p.bairro ? ` — ${p.bairro}` : ''}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#34D399', fontWeight: 600 }}>
            <Store size={14} /> Retirada no balcão
          </div>
        )}
      </div>

      {/* ── Total ── */}
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: '#EAF1FB' }}>Total</span>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: '#FC5B24' }}>{fmt(Number(p.valor_total))}</span>
      </div>

      {/* ── Botões ── */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        {fluxo.prox && (
          <button
            onClick={onAvancar}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: '#FC5B24',
              border: 'none',
              borderRadius: 12,
              padding: '11px 0',
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(252,91,36,.35)',
              transition: 'filter .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          >
            <Check size={16} /> {p.tipo_pedido === 'RETIRADA_BALCAO' && p.status === 'PRONTO' ? 'Finalizar Retirada' : fluxo.label}
          </button>
        )}
        <button
          onClick={onImprimir}
          style={{
            width: 44, height: 44, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 12,
            color: '#AEB9CE',
            cursor: 'pointer',
          }}
        >
          <Printer size={18} />
        </button>
        {['NOVO','ACEITO'].includes(p.status) && (
          <button
            onClick={onCancelar}
            style={{
              width: 44, height: 44, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(239,68,68,.1)',
              border: '1px solid rgba(239,68,68,.25)',
              borderRadius: 12,
              color: '#F87171',
              cursor: 'pointer',
            }}
          >
            <XIcon size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Painel principal ── */
export default function PainelPedidos() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [imprimir, setImprimir] = useState<Pedido | null>(null);

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
    <div style={{ minHeight: '100vh', background: '#070C18', padding: '20px 16px', fontFamily: "'Manrope', sans-serif" }}>

      {/* ── Cabeçalho ── */}
      <div className="print:hidden" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.28em', color: '#FC5B24', textTransform: 'uppercase' }}>
            PAINEL · AO VIVO
          </span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', display: 'inline-block' }} />
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 26, color: '#EAF1FB', margin: 0 }}>
          Cozinha &amp; Despacho
        </h2>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#6C7A96', margin: '4px 0 0' }}>
          {pedidos.length} pedidos hoje · {ativos.length} em andamento
        </p>
      </div>

      {/* ── Loading ── */}
      {carregando && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <MiseOnLoader status="Sincronizando pedidos" rows={3} />
        </div>
      )}

      {/* ── Grid de cards ── */}
      {!carregando && (
        <div className="print:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...ativos, ...encerrados].map((p) => (
            <CardPedido
              key={p.id}
              p={p}
              onAvancar={() => {
                let proxStatus = FLUXO[p.status]?.prox!;
                if (p.tipo_pedido === 'RETIRADA_BALCAO' && p.status === 'PRONTO') proxStatus = 'FINALIZADO';
                mudarStatus(p, proxStatus);
              }}
              onCancelar={() => { if (confirm('Cancelar pedido?')) mudarStatus(p, 'CANCELADO'); }}
              onImprimir={() => { setImprimir(p); setTimeout(() => window.print(), 100); }}
            />
          ))}
          {pedidos.length === 0 && (
            <div className="col-span-full" style={{ paddingTop: 60, textAlign: 'center' }}>
              <img src="/brand/icon.png" alt="" style={{ width: 56, opacity: .3, margin: '0 auto 16px' }} />
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#6C7A96', letterSpacing: '.08em' }}>
                NENHUM PEDIDO HOJE AINDA
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Comanda térmica 80mm ── */}
      {imprimir && (
        <div className="hidden print:block font-mono text-black leading-tight" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', fontSize: '12px' }}>
          {/* VIA COZINHA */}
          <div className="comanda-print">
            <div className="text-center mb-2">
              <p className="font-bold text-base">================================</p>
              <h1 className="font-bold text-2xl uppercase mt-1">MISE ON</h1>
              <p className="text-xs uppercase">Sistema Inteligente para sua Cozinha</p>
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
                    <p key={x} className="text-xs ml-6 uppercase">+ {o.nome_opcao}</p>
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
            <div className="text-center text-[10px] mb-8"><p>*** FIM DA VIA COZINHA ***</p></div>
          </div>

          <div className="break-after-page" />

          {/* VIA CLIENTE */}
          <div className="comanda-print">
            <div className="text-center mb-2">
              <p className="font-bold text-base">================================</p>
              <h1 className="font-bold text-2xl uppercase mt-1">MISE ON</h1>
              <p className="text-xs uppercase">Sistema Inteligente para sua Cozinha</p>
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
              <div className="flex justify-between"><span>SUBTOTAL:</span><span>{fmt(Number(imprimir.subtotal))}</span></div>
              {Number(imprimir.taxa_entrega) > 0 && (
                <div className="flex justify-between"><span>TAXA ENTREGA:</span><span>{fmt(Number(imprimir.taxa_entrega))}</span></div>
              )}
              {Number(imprimir.desconto) > 0 && (
                <div className="flex justify-between font-bold"><span>DESCONTO:</span><span>-{fmt(Number(imprimir.desconto))}</span></div>
              )}
              <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t-2 border-black border-dashed">
                <span>TOTAL:</span><span>{fmt(Number(imprimir.valor_total))}</span>
              </div>
            </div>
            <p className="font-bold text-base text-center mt-3 mb-1">================================</p>
            <div className="py-1">
              <p className="font-bold uppercase text-center">FORMA DE PAGAMENTO</p>
              <p className="uppercase text-center text-base font-bold mt-1">{imprimir.pagamentos?.[0]?.metodo}</p>
              {imprimir.troco_para && (
                <p className="text-center font-bold uppercase mt-1">(LEVAR TROCO PARA {fmt(Number(imprimir.troco_para))})</p>
              )}
            </div>
            <p className="font-bold text-base text-center mt-2 mb-1">================================</p>
            <div className="text-center text-xs mt-4 mb-4">
              <p className="font-bold">OBRIGADO PELA PREFERÊNCIA!</p>
              <p className="mt-1">MiseOn · Sistema Inteligente para sua Cozinha</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
