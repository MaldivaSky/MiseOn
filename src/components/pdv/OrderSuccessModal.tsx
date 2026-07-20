import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { PartyPopper, ChefHat, Receipt } from 'lucide-react';
import { fmt } from '../../types';
import type { OrderSuccessModalProps } from '../../types';

export function OrderSuccessModal({ venda, imprimirVenda, limparVenda }: OrderSuccessModalProps) {
  useEffect(() => {
    if (venda) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'],
        disableForReducedMotion: true
      });
    }
  }, [venda]);

  if (!venda) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
          <PartyPopper size={28} />
        </div>
        <h3 className="mt-3 text-xl font-black dark:text-gray-100">Venda #{venda.numero} registrada!</h3>
        <p className="mt-1 text-sm text-gray-500">
          {fmt(venda.total)} · {venda.metodo === 'DINHEIRO' ? 'Dinheiro' : venda.metodo === 'PIX' ? 'Pix' : venda.metodo === 'CREDITO' ? 'Crédito' : 'Débito'}
          {venda.temCozinha ? ' · já está na cozinha 🔥' : ' · Pronto! Entregue ao cliente ✅'}
        </p>
        {venda.troco > 0 && (
          <p className="mt-3 rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            Devolver troco: <span className="text-2xl font-black">{fmt(venda.troco)}</span>
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {venda.temCozinha && (
            <button onClick={() => imprimirVenda('COMANDA_COZINHA')} className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 py-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">
              <ChefHat size={14} /> Comanda cozinha
            </button>
          )}
          <button onClick={() => imprimirVenda('RECIBO_CLIENTE')} className={`flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 py-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300 ${!venda.temCozinha ? 'col-span-2' : ''}`}>
            <Receipt size={14} /> Nota cliente
          </button>
        </div>
        <button onClick={limparVenda} className="mt-3 w-full rounded-2xl bg-[var(--cor-primaria)] py-4 text-base font-black text-white shadow-lg">
          Nova venda
        </button>
      </div>
    </div>
  );
}
