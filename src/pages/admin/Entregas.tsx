import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MapPin, Navigation, CheckCircle2, Phone, Bike, MessageCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Pedido, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';

/**
 * Tela do ENTREGADOR — versão enxuta do módulo de logística do mercadinhosys.
 * Fila de entregas em tempo real: PRONTO (aguardando) → EM_ROTA → FINALIZADO.
 * "Abrir rota" abre o Google Maps já com a navegação para o endereço do pedido.
 * Em EM_ROTA, a localização é transmitida via geolocalização do navegador para
 * `entregas.lat/lng`, que alimenta o mapa de rastreio público em /pedido/:id.
 */
const MENSAGENS = [
  'Estou a caminho! 🛵',
  'Cheguei, pode descer? 📍',
  'Só um instante, pequeno atraso no trânsito 🙏',
  'Não consegui te encontrar, pode me ligar?',
];

export default function Entregas() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mensagemPara, setMensagemPara] = useState<Pedido | null>(null);
  const watchIds = useRef<Record<string, number>>({});

  const carregar = async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, itens_pedido(*), pagamentos(metodo, status, valor_pago)')
      .eq('loja_id', lojaId)
      .eq('tipo_pedido', 'DELIVERY')
      .in('status', ['PRONTO', 'EM_ROTA'])
      .order('criado_em');
    setPedidos((data as Pedido[]) ?? []);
  };

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel('entregas-loja')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
      Object.values(watchIds.current).forEach((id) => navigator.geolocation?.clearWatch(id));
    };
  }, [lojaId]);

  const abrirMaps = (p: Pedido) => {
    const destino = encodeURIComponent(`${p.endereco_entrega ?? ''} ${p.bairro ?? ''}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`, '_blank');
  };

  const abrirWaze = (p: Pedido) => {
    const destino = encodeURIComponent(`${p.endereco_entrega ?? ''} ${p.bairro ?? ''}`);
    window.open(`https://waze.com/ul?q=${destino}&navigate=yes`, '_blank');
  };

  const enviarMensagem = (p: Pedido, texto: string) => {
    if (!p.telefone_contato) return;
    window.open(`https://wa.me/${p.telefone_contato.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
    setMensagemPara(null);
  };

  const transmitirLocalizacao = (pedidoId: string) => {
    if (!navigator.geolocation || watchIds.current[pedidoId]) return;
    let ultimoEnvio = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const agora = Date.now();
        if (agora - ultimoEnvio < 8000) return; // throttle ~8s
        ultimoEnvio = agora;
        supabase.from('localizacao_entregador')
          .upsert({ 
            pedido_id: pedidoId, 
            lat: pos.coords.latitude, 
            lng: pos.coords.longitude, 
            atualizado_em: new Date().toISOString() 
          })
          .then(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    watchIds.current[pedidoId] = id;
  };

  const pararLocalizacao = (pedidoId: string) => {
    const id = watchIds.current[pedidoId];
    if (id) { navigator.geolocation.clearWatch(id); delete watchIds.current[pedidoId]; }
  };

  const iniciarRota = async (p: Pedido) => {
    await supabase.from('pedidos').update({ status: 'EM_ROTA' }).eq('id', p.id);
    transmitirLocalizacao(p.id);
    abrirMaps(p);
  };

  const concluir = async (p: Pedido) => {
    pararLocalizacao(p.id);
    await supabase.from('pedidos').update({ status: 'FINALIZADO' }).eq('id', p.id);
    await supabase.from('localizacao_entregador').delete().eq('pedido_id', p.id);
  };

  const aguardando = pedidos.filter((p) => p.status === 'PRONTO');
  const emRota = pedidos.filter((p) => p.status === 'EM_ROTA');

  // já em rota ao carregar a tela (ex: recarregou a página) — retoma a transmissão
  useEffect(() => { emRota.forEach((p) => transmitirLocalizacao(p.id)); }, [emRota.map((p) => p.id).join(',')]);

  const Card = ({ p }: { p: Pedido }) => {
    const pgto = p.pagamentos?.[0];
    const cobrarNaEntrega = pgto && pgto.status !== 'PAGO';
    return (
      <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">#{p.numero}</span>
          <span className="text-sm font-semibold">{fmt(Number(p.valor_total))}</span>
        </div>
        <p className="mt-1 text-sm font-medium">{p.identificador_cliente}</p>
        <p className="flex items-start gap-1 text-sm text-gray-600 dark:text-gray-300">
          <MapPin size={14} className="mt-0.5 shrink-0" /> {p.endereco_entrega}{p.bairro ? ` — ${p.bairro}` : ''}
        </p>

        <ul className="mt-2 space-y-0.5 border-t pt-2 text-xs text-gray-600 dark:text-gray-300">
          {p.itens_pedido?.map((i) => <li key={i.id}>{i.quantidade}x {i.nome_produto}</li>)}
        </ul>

        {cobrarNaEntrega ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
            COBRAR NA ENTREGA: {pgto.metodo}
            {p.troco_para ? ` · troco p/ ${fmt(Number(p.troco_para))}` : ''}
          </p>
        ) : (
          <p className="mt-2 text-xs font-semibold text-green-600">✓ Já pago ({pgto?.metodo})</p>
        )}
        <div className="mt-3 flex gap-2">
          {p.telefone_contato && (
            <a href={`tel:${p.telefone_contato}`} className="rounded-xl border px-3 py-2.5 text-gray-500 dark:text-gray-400">
              <Phone size={16} />
            </a>
          )}
          {p.telefone_contato && (
            <button onClick={() => setMensagemPara(p)} className="rounded-xl border px-3 py-2.5 text-green-600">
              <MessageCircle size={16} />
            </button>
          )}
          <button onClick={() => abrirMaps(p)} className="rounded-xl border px-3 py-2.5 text-blue-700" title="Google Maps">
            <MapPin size={16} />
          </button>
          <button onClick={() => abrirWaze(p)} className="rounded-xl border px-3 py-2.5 text-blue-500" title="Waze">
            <Navigation size={16} />
          </button>
          {p.status === 'PRONTO' ? (
            <button onClick={() => iniciarRota(p)}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-800 py-2.5 text-sm font-semibold text-white">
              <Bike size={15} /> Iniciar rota
            </button>
          ) : (
            <button onClick={() => concluir(p)}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white">
              <CheckCircle2 size={15} /> Entregue
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <h2 className="mb-3 font-bold flex items-center gap-2"><Bike size={20} className="text-[var(--cor-primaria)]" /> Em rota ({emRota.length})</h2>
      <div className="space-y-3">{emRota.map((p) => <Card key={p.id} p={p} />)}</div>

      <h2 className="mb-3 mt-6 font-bold flex items-center gap-2"><CheckCircle2 size={20} className="text-gray-500" /> Prontos para sair ({aguardando.length})</h2>
      <div className="space-y-3">{aguardando.map((p) => <Card key={p.id} p={p} />)}</div>

      {pedidos.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">Nenhuma entrega pendente. 🎉</p>
      )}

      {mensagemPara && (
        <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setMensagemPara(null)}>
          <div className="sheet w-full max-w-lg rounded-t-3xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Mensagem para {mensagemPara.identificador_cliente}</h3>
              <button onClick={() => setMensagemPara(null)}><X size={20} /></button>
            </div>
            <div className="mt-3 space-y-2">
              {MENSAGENS.map((m) => (
                <button key={m} onClick={() => enviarMensagem(mensagemPara, m)}
                  className="w-full rounded-xl border p-3 text-left text-sm hover:bg-gray-50">{m}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
