import { Search } from 'lucide-react';
import { fmt } from '../../types';
import type { ProductGridProps } from '../../types';

export function ProductGrid({ busca, setBusca, categorias, catAtiva, setCatAtiva, produtosVisiveis, tocarProduto }: ProductGridProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-[#0B1120]">
      <div className="flex items-center gap-2 p-3 pb-0">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100" />
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto p-3 pb-2">
        <button onClick={() => setCatAtiva('TODAS')} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${catAtiva === 'TODAS' ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300'}`}>Todas</button>
        {categorias.map((c) => (
          <button key={c.id} onClick={() => setCatAtiva(c.id)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${catAtiva === c.id ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300'}`}>{c.nome}</button>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3 pt-1 sm:grid-cols-3 xl:grid-cols-4">
        {produtosVisiveis.map((p) => (
          <button key={p.id} onClick={() => tocarProduto(p)}
            className="flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition active:scale-[0.97] dark:border-gray-800 dark:bg-gray-900">
            <span className="text-sm font-bold leading-tight dark:text-gray-100">{p.nome}</span>
            <span className="mt-2 text-sm font-black text-[var(--cor-primaria)]">{fmt(Number(p.preco))}</span>
          </button>
        ))}
        {produtosVisiveis.length === 0 && <p className="col-span-full py-10 text-center text-sm text-gray-400">Nenhum produto encontrado.</p>}
      </div>
    </div>
  );
}
