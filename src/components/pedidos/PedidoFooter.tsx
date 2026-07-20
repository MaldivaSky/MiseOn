import { Bike, Store, UtensilsCrossed } from 'lucide-react';
import { fmt } from '../../types';
import type { PedidoFooterProps } from '../../types';

export function PedidoFooter({ pedido: p }: PedidoFooterProps) {
  return (
    <>
      {/* ── Entrega/Balcão/Mesa ── */}
      <div className="mx-4 border-t border-gray-100 py-2.5 dark:border-white/5">
        {p.tipo_pedido === 'DELIVERY' ? (
          <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#AEB9CE]">
            <Bike size={14} className="mt-0.5 shrink-0 text-blue-500 dark:text-[#6B9EFF]" />
            <span>{p.endereco_entrega}{p.bairro ? ` — ${p.bairro}` : ''}</span>
          </div>
        ) : p.tipo_pedido === 'SALAO' ? (
          <div className="flex items-center gap-1.5 font-semibold text-purple-500">
            <UtensilsCrossed size={14} /> Mesa {p.mesa_numero ?? '—'}
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
    </>
  );
}
