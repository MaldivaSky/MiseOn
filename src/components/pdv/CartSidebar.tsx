import { ShoppingCart, Trash2, Plus, Minus, Loader2 } from 'lucide-react';
import { fmt, precoItem } from '../../types';
import type { CartSidebarProps } from '../../types';

export function CartSidebar({
  carrinho, limparVenda, mudarQtd, removerItem,
  nomeCliente, setNomeCliente, desconto, setDesconto,
  subtotal, descontoNum, total, erro, modo, turno,
  mesaSelecionada, enviandoMesa, setEtapa, setMetodo, setErro, enviarParaMesa
}: CartSidebarProps) {
  return (
    <div className="flex w-[340px] shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <p className="flex items-center gap-2 text-sm font-black dark:text-gray-100"><ShoppingCart size={16} /> Venda atual</p>
        {carrinho.length > 0 && <button onClick={limparVenda} className="text-xs font-bold text-red-500">Limpar</button>}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {carrinho.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Toque nos produtos<br />para adicionar.</p>}
        <div className="space-y-2">
          {carrinho.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 p-2.5 dark:border-gray-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold leading-tight dark:text-gray-100">{item.produto.nome}</p>
                  {item.opcoesSelecionadas.map((o) => (
                    <p key={o.id} className="text-[11px] text-gray-400">+ {o.nome}</p>
                  ))}
                  {item.observacao && <p className="text-[11px] font-semibold text-red-500">⚠ {item.observacao}</p>}
                </div>
                <p className="shrink-0 text-[13px] font-black dark:text-gray-100">{fmt(precoItem(item))}</p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => mudarQtd(idx, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Minus size={13} /></button>
                <span className="w-6 text-center text-sm font-black dark:text-gray-100">{item.quantidade}</span>
                <button onClick={() => mudarQtd(idx, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Plus size={13} /></button>
                <button onClick={() => removerItem(idx)} className="ml-auto rounded-lg p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 p-3 dark:border-gray-800">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} placeholder="Cliente (opcional)"
            className="rounded-xl border border-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
          <input value={desconto} onChange={(e) => setDesconto(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="Desconto R$"
            className="rounded-xl border border-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
        </div>
        <div className="mb-1 flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
        {descontoNum > 0 && <div className="mb-1 flex justify-between text-xs text-green-600"><span>Desconto</span><span>-{fmt(descontoNum)}</span></div>}
        <div className="mb-3 flex justify-between text-lg font-black dark:text-gray-100"><span>Total</span><span className="text-[var(--cor-primaria)]">{fmt(total)}</span></div>
        {erro && modo === 'MESA' && <p className="mb-2 text-center text-xs font-semibold text-red-500">{erro}</p>}
        {modo === 'BALCAO' ? (
          <button disabled={carrinho.length === 0 || !turno} onClick={() => { setEtapa('PAGANDO'); setMetodo(null); setErro(''); }}
            className="w-full rounded-2xl bg-[var(--cor-primaria)] py-4 text-base font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40">
            {turno ? `Cobrar ${fmt(total)}` : 'Abra o caixa para vender'}
          </button>
        ) : (
          <button disabled={carrinho.length === 0 || !mesaSelecionada || enviandoMesa} onClick={enviarParaMesa}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] py-4 text-base font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40">
            {enviandoMesa && <Loader2 size={16} className="animate-spin" />}
            {!mesaSelecionada ? 'Selecione uma mesa' : enviandoMesa ? 'Enviando…' : `Enviar para a Mesa ${mesaSelecionada.numero}`}
          </button>
        )}
      </div>
    </div>
  );
}
