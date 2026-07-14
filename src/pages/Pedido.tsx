import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Clock, ChefHat, Package, Bike, PartyPopper, XCircle, Download, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Pedido, StatusPedido, fmt } from '../types';
import { tocarSom } from '../lib/som';
import ThemeToggle from '../components/ThemeToggle';

const ETAPAS: { status: StatusPedido; label: string; icon: ReactNode }[] = [
  { status: 'NOVO', label: 'Recebido', icon: <Clock size={16} /> },
  { status: 'ACEITO', label: 'Aceito', icon: <Check size={16} /> },
  { status: 'PREPARANDO', label: 'Preparando', icon: <ChefHat size={16} /> },
  { status: 'PRONTO', label: 'Pronto', icon: <Package size={16} /> },
  { status: 'EM_ROTA', label: 'Em rota', icon: <Bike size={16} /> },
  { status: 'FINALIZADO', label: 'Entregue', icon: <PartyPopper size={16} /> },
];

const MENSAGEM_STATUS: Partial<Record<StatusPedido, string>> = {
  ACEITO: '✅ Seu pedido foi aceito pela loja!',
  PREPARANDO: '👨‍🍳 Seu pedido está sendo preparado!',
  PRONTO: '📦 Seu pedido está pronto!',
  EM_ROTA: '🛵 Seu pedido saiu para entrega!',
  FINALIZADO: '🎉 Pedido entregue — bom apetite!',
  CANCELADO: '❌ Seu pedido foi cancelado.',
};

const iconeMoto = L.divIcon({
  html: '<div style="font-size:26px;line-height:1">🛵</div>',
  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
});
const iconeCasa = L.divIcon({
  html: '<div style="font-size:24px;line-height:1">📍</div>',
  className: '', iconSize: [24, 24], iconAnchor: [12, 24],
});

function MapUpdater({ posicao }: { posicao: {lat: number, lng: number} }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([posicao.lat, posicao.lng], map.getZoom(), { animate: true, duration: 1.5 });
  }, [posicao.lat, posicao.lng, map]);
  return null;
}

export default function AcompanharPedido() {
  const { id } = useParams();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [posicao, setPosicao] = useState<{ lat: number; lng: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const statusAnterior = useRef<StatusPedido | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const carregar = async () => {
    const { data } = await supabase
      .from('pedidos')
      .select('*, itens_pedido(*, itens_pedido_opcoes(*)), pagamentos(metodo, status, valor_pago)')
      .eq('id', id)
      .single();
    const p = (data as Pedido) ?? null;
    setPedido(p);
    if (p && statusAnterior.current === null) statusAnterior.current = p.status;
  };

  useEffect(() => {
    if (!id) return;
    carregar();
    const canal = supabase
      .channel(`pedido-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` },
        (payload) => {
          const novo = payload.new as Pedido;
          const msg = MENSAGEM_STATUS[novo.status];
          if (statusAnterior.current && statusAnterior.current !== novo.status && msg) {
            tocarSom();
            if ('Notification' in window && Notification.permission === 'granted') new Notification(msg, { body: `Pedido #${novo.numero}` });
            setAviso(msg);
            setTimeout(() => setAviso(null), 6000);
          }
          statusAnterior.current = novo.status;
          carregar();
        })
      .subscribe();
    if ('Notification' in window) Notification.requestPermission?.();
    return () => { supabase.removeChannel(canal); };
  }, [id]);

  useEffect(() => {
    if (!id || pedido?.status !== 'EM_ROTA') return;
    const buscarPosicao = async () => {
      const { data } = await supabase.from('localizacao_entregador').select('lat, lng').eq('pedido_id', id).maybeSingle();
      if (data?.lat && data?.lng) setPosicao({ lat: Number(data.lat), lng: Number(data.lng) });
    };
    buscarPosicao();
    const canal = supabase
      .channel(`entrega-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'localizacao_entregador', filter: `pedido_id=eq.${id}` },
        (payload) => {
          const e = payload.new as { lat?: number; lng?: number };
          if (e.lat && e.lng) setPosicao({ lat: Number(e.lat), lng: Number(e.lng) });
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [id, pedido?.status]);

  if (!pedido) return <div className="flex h-screen items-center justify-center text-gray-400 dark:bg-gray-950">Carregando pedido…</div>;

  const idxAtual = ETAPAS.findIndex((e) => e.status === pedido.status);
  const cancelado = pedido.status === 'CANCELADO';

  return (
    <div className="min-h-screen bg-gray-50 pb-10 dark:bg-gray-950">
      {aviso && (
        <div className="fade fixed left-1/2 top-3 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
          {aviso}
        </div>
      )}
      <header className="relative bg-[var(--cor-primaria)] p-5 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="absolute right-4 top-4"><ThemeToggle className="rounded-full border border-white/30 bg-black/10 p-2 text-white" /></div>
          <p className="text-sm opacity-80">Pedido</p>
          <h1 className="text-2xl font-bold">#{pedido.numero}</h1>
          <p className="text-sm opacity-90">{pedido.identificador_cliente}</p>
        </div>
      </header>

      {/* Alerta de Retenção */}
      <div className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 p-3 flex flex-col items-center justify-center text-center">
        <p className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-amber-800 dark:text-amber-400">
          <AlertTriangle size={16} /> Não feche esta página!
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">Seu pedido será atualizado aqui em tempo real.</p>
        
        {deferredPrompt && (
          <button onClick={handleInstallClick} className="mt-3 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
            <Download size={16} /> Instalar o App do Restaurante (Grátis)
          </button>
        )}
      </div>

      <div className="mx-auto max-w-2xl p-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:p-6">
        {cancelado ? (
          <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <XCircle size={20} /> <p className="text-sm font-semibold">Pedido cancelado.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm dark:bg-gray-900">
            {ETAPAS.map((e, i) => (
              <div key={e.status} className="flex items-start gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${i <= idxAtual ? 'bg-[var(--cor-primaria)] text-white' : 'bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600 dark:text-gray-300'}`}>
                    {e.icon}
                  </div>
                  {i < ETAPAS.length - 1 && <div className={`mt-1 h-6 w-0.5 ${i < idxAtual ? 'bg-[var(--cor-primaria)]' : 'bg-gray-100 dark:bg-gray-800'}`} />}
                </div>
                <p className={`pt-1.5 text-sm font-medium ${i <= idxAtual ? 'text-gray-800 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600 dark:text-gray-300'}`}>{e.label}</p>
              </div>
            ))}
          </div>
        )}

        <div>
          {pedido.status === 'EM_ROTA' && posicao && (
            <div className="mt-4 overflow-hidden rounded-2xl border shadow-sm dark:border-gray-800 lg:mt-0">
              <MapContainer center={[posicao.lat, posicao.lng]} zoom={15} style={{ height: 260, width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapUpdater posicao={posicao} />
                <Marker position={[posicao.lat, posicao.lng]} icon={iconeMoto}>
                  <Popup>Seu entregador está aqui 🛵</Popup>
                </Marker>
              </MapContainer>
            </div>
          )}
          {pedido.status === 'EM_ROTA' && !posicao && (
            <p className="mt-3 text-center text-xs text-gray-400">Aguardando o entregador iniciar o compartilhamento de localização…</p>
          )}

          <div className="mt-4 rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-4 shadow-sm dark:bg-gray-900 lg:mt-4">
            <p className="mb-2 text-sm font-semibold dark:text-gray-100">Itens</p>
            <ul className="space-y-1 text-sm">
              {pedido.itens_pedido?.map((i) => (
                <li key={i.id}>
                  <span className="font-medium dark:text-gray-200">{i.quantidade}x {i.nome_produto}</span>
                  {i.itens_pedido_opcoes?.map((o, x) => <span key={x} className="block pl-4 text-xs text-gray-500 dark:text-gray-400">+ {o.nome_opcao}</span>)}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t pt-2 text-sm font-bold dark:border-gray-800 dark:text-gray-100">
              <span>Total</span><span>{fmt(Number(pedido.valor_total))}</span>
            </div>
          </div>

          {pedido.tipo_pedido === 'DELIVERY' && (
            <p className="mt-3 text-center text-xs text-gray-400">Entrega em {pedido.endereco_entrega}{pedido.bairro ? ` — ${pedido.bairro}` : ''}</p>
          )}
        </div>
      </div>
    </div>
  );
}
