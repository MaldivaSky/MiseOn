import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';

interface CustoProduto {
  produto_id: string;
  nome: string;
  preco_venda: number;
  custo_insumos: number;
  lucro_bruto: number;
  margem_pct: number | null;
}

export default function Financeiro() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [produtos, setProdutos] = useState<CustoProduto[]>([]);
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);
  const [lucroHoje, setLucroHoje] = useState(0);
  const [pedidosHoje, setPedidosHoje] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);

      const [{ data: custos }, { data: pedidos }] = await Promise.all([
        supabase.from('vw_custo_produto').select('*').eq('loja_id', lojaId).order('margem_pct', { ascending: true }),
        supabase.from('pedidos')
          .select('valor_total, itens_pedido(quantidade, produto_id)')
          .eq('loja_id', lojaId)
          .neq('status', 'CANCELADO')
          .gte('criado_em', inicioHoje.toISOString()),
      ]);

      const listaCustos = (custos as CustoProduto[]) ?? [];
      setProdutos(listaCustos);
      const custoPorProduto = new Map(listaCustos.map((c) => [c.produto_id, Number(c.custo_insumos)]));

      const lista = pedidos ?? [];
      const faturamento = lista.reduce((s, p: any) => s + Number(p.valor_total), 0);
      const custoTotal = lista.reduce((s, p: any) =>
        s + (p.itens_pedido ?? []).reduce((si: number, it: any) =>
          si + (custoPorProduto.get(it.produto_id) ?? 0) * it.quantidade, 0), 0);

      setFaturamentoHoje(faturamento);
      setLucroHoje(faturamento - custoTotal);
      setPedidosHoje(lista.length);
      setCarregando(false);
    })();
  }, [lojaId]);

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  return (
    <div className="p-4">
      <h2 className="mb-3 font-bold">Financeiro</h2>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><DollarSign size={11} /> Faturamento hoje</p>
          <p className="mt-1 text-sm font-bold dark:text-gray-100">{fmt(faturamentoHoje)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><TrendingUp size={11} /> Lucro estimado</p>
          <p className={`mt-1 text-sm font-bold ${lucroHoje < 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(lucroHoje)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[10px] font-semibold text-gray-400">Pedidos hoje</p>
          <p className="mt-1 text-sm font-bold dark:text-gray-100">{pedidosHoje}</p>
        </div>
      </div>

      <p className="mb-2 text-sm font-semibold">Custo e margem por produto</p>
      <div className="space-y-2">
        {produtos.map((p) => {
          const margemBaixa = p.margem_pct !== null && p.margem_pct < 30;
          return (
            <div key={p.produto_id} className="rounded-xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium dark:text-gray-100">{p.nome}</p>
                <span className={`flex items-center gap-0.5 text-xs font-bold ${margemBaixa ? 'text-red-500' : 'text-green-600'}`}>
                  {margemBaixa ? <TrendingDown size={12} /> : <TrendingUp size={12} />} {p.margem_pct ?? '—'}%
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Venda: {fmt(Number(p.preco_venda))}</span>
                <span>Custo: {fmt(Number(p.custo_insumos))}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">Lucro: {fmt(Number(p.lucro_bruto))}</span>
              </div>
            </div>
          );
        })}
        {produtos.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">
            Nenhum produto com ficha técnica ainda — cadastre em Cardápio → editar produto.
          </p>
        )}
      </div>
    </div>
  );
}
