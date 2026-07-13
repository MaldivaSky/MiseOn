import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Clock, ChefHat, Package, Bike, PartyPopper, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Pedido, StatusPedido, fmt } from '../types';
import { tocarSom } from '../lib/som';

const ETAPAS: { status: StatusPedido; label: string; icon: ReactNode }[] = [
  { status: 'NOVO', label: 'Recebido', icon: <Clock size={16} /> },
  { status: 'ACEITO', label: 'Aceito', icon: <Check size={16} /> },
  { status: 'PREPARANDO', label: 'Preparando', icon: <ChefHat size={16} /> },
  { status: 'PRONTO', label: 'Pronto', icon: <Package size={16} /> },
  { status: 'EM_ROTA', label: 'Em rota', icon: <Bike size={16} /> },
  { status: 'FINALIZADO', label: 'Entregue', icon: <PartyPopper size={16} /> },
];

const iconeMoto = L.divIcon({
  html: '<div style="font-size:26px;line-height:1">🛵</div>',
  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
});
const iconeCasa = L.divIcon({
  html: '<div style="font-size:24px;line-height:1">📍</div>',
  className: '', iconSize: [24, 24], iconAnchor: [12, 24],
});

export default function AcompanharPedido() {
  const { id } = useParams();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [posicao, setPosicao] = useState<{ lat: number; lng: number } | null>(null);
  const statusAnterior = useRef<StatusPedido | null>(null);

  const carregar = async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, itens_pedido(*, itens_pedido_opcoes(*)), pagamentos(metodo, status, valor_pago)')
      .eq('id', id)
      .single();
    setPedido((data as Pedido) ?? null);
  };

  useEffect(() => {
    if (!id) return;
    carregar();
    const canal = supabase
      .channel(`pedido-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` },
        (payload) => {
          const novo = payload.new as Pedido;
          if (statusAnterior.current && statusAnterior.current !== 'EM_ROTA' && novo.status === 'EM_ROTA') {
            tocarSom();
            if (Notification?.permission === 'granted') new Notification('🛵 Seu pedido saiu para entrega!');
          }
          statusAnterior.current = novo.status;
          carregar();
        })
      .subscribe();
    Notification?.requestPermission?.();
    return () => { supabase.removeChannel(canal); };
  }, [id]);

  useEffect(() => {
    if (!id || pedido?.status !== 'EM_ROTA') return;
    const buscarPosicao = async () => {
      const { data } = await supabase.from('entregas').select('lat, lng').eq('pedido_id', id).maybeSingle();
      if (data?.lat && data?.lng) setPosicao({ lat: Number(data.lat), lng: Number(data.lng) });
    };
    buscarPosicao();
    const canal = supabase
      .channel(`entrega-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'entregas', filter: `pedido_id=eq.${id}` },
        (payload) => {
          const e = payload.new as { lat?: number; lng?: number };
          if (e.lat && e.lng) setPosicao({ lat: Number(e.lat), lng: Number(e.lng) });
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [id, pedido?.status]);

  if (!pedido) return <div className="flex h-screen items-center justify-center text-gray-400">Carregando pedido…</div>;

  const idxAtual = ETAPAS.findIndex((e) => e.status === pedido.status);
  const cancelado = pedido.status === 'CANCELADO';

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-gray-50 pb-10">
      <header className="bg-[var(--cor-primaria)] p-5 text-white">
        <p className="text-sm opacity-80">Pedido</p>
        <h1 className="text-2xl font-bold">#{pedido.numero}</h1>
        <p className="text-sm opacity-90">{pedido.identificador_cliente}</p>
      </header>

      <div className="p-4">
        {cancelado ? (
          <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-red-600">
            <XCircle size={20} /> <p className="text-sm font-semibold">Pedido cancelado.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            {ETAPAS.map((e, i) => (
              <div key={e.status} className="flex items-start gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= idxAtual ? 'bg-[var(--cor-primaria)] text-white' : 'bg-gray-100 text-gray-300'}`}>
                    {e.icon}
                  </div>
                  {i < ETAPAS.length - 1 && <div className={`mt-1 h-6 w-0.5 ${i < idxAtual ? 'bg-[var(--cor-primaria)]' : 'bg-gray-100'}`} />}
                </div>
                <p className={`pt-1.5 text-sm font-medium ${i <= idxAtual ? 'text-gray-800' : 'text-gray-300'}`}>{e.label}</p>
              </div>
            ))}
          </div>
        )}

        {pedido.status === 'EM_ROTA' && posicao && (
          <div className="mt-4 overflow-hidden rounded-2xl border shadow-sm">
            <MapContainer center={[posicao.lat, posicao.lng]} zoom={15} style={{ height: 260, width: '100%' }}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[posicao.lat, posicao.lng]} icon={iconeMoto}>
                <Popup>Seu entregador está aqui 🛵</Popup>
              </Marker>
              {pedido.endereco_entrega && <Marker position={[posicao.lat, posicao.lng]} icon={iconeCasa} />}
            </MapContainer>
          </div>
        )}
        {pedido.status === 'EM_ROTA' && !posicao && (
          <p className="mt-3 text-center text-xs text-gray-400">Aguardando o entregador iniciar o compartilhamento de localização…</p>
        )}

        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold">Itens</p>
          <ul className="space-y-1 text-sm">
            {pedido.itens_pedido?.map((i) => (
              <li key={i.id}>
                <span className="font-medium">{i.quantidade}x {i.nome_produto}</span>
                {i.itens_pedido_opcoes?.map((o, x) => <span key={x} className="block pl-4 text-xs text-gray-500">+ {o.nome_opcao}</span>)}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t pt-2 text-sm font-bold">
            <span>Total</span><span>{fmt(Number(pedido.valor_total))}</span>
          </div>
        </div>

        {pedido.tipo_pedido === 'DELIVERY' && (
          <p className="mt-3 text-center text-xs text-gray-400">Entrega em {pedido.endereco_entrega}{pedido.bairro ? ` — ${pedido.bairro}` : ''}</p>
        )}
        <p className="mt-4 text-center text-[11px] text-gray-300">Mantenha esta página aberta ou salve o link para acompanhar as atualizações.</p>
      </div>
    </div>
  );
}
