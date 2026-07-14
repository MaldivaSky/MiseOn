import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, Calculator, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt, ProdutoCusto, ConfiguracoesCusto } from '../../types';
import type { CtxLoja } from './AdminLayout';

const defaultCustos: ConfiguracoesCusto = {
  loja_id: '',
  custo_aluguel: 0,
  custo_energia: 0,
  custo_agua: 0,
  custo_internet: 0,
  custo_gas: 0,
  outros_custos_fixos: 0,
  expectativa_vendas_mes: 1000
};

export default function Financeiro() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [aba, setAba] = useState<'RESULTADOS' | 'CUSTOS_FIXOS'>('RESULTADOS');
  
  // Resultados State
  const [produtos, setProdutos] = useState<ProdutoCusto[]>([]);
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);
  const [lucroHoje, setLucroHoje] = useState(0);
  const [pedidosHoje, setPedidosHoje] = useState(0);
  const [carregando, setCarregando] = useState(true);

  // Custos Fixos State
  const [configCusto, setConfigCusto] = useState<ConfiguracoesCusto>({ ...defaultCustos, loja_id: lojaId });
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const carregarDados = async () => {
    setCarregando(true);
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);

    const [{ data: custos }, { data: pedidos }, { data: config }] = await Promise.all([
      supabase.from('vw_custo_produto').select('*').eq('loja_id', lojaId).order('margem_pct', { ascending: true }),
      supabase.from('pedidos')
        .select('valor_total, itens_pedido(quantidade, produto_id)')
        .eq('loja_id', lojaId)
        .neq('status', 'CANCELADO')
        .gte('criado_em', inicioHoje.toISOString()),
      supabase.from('configuracoes_custo').select('*').eq('loja_id', lojaId).maybeSingle()
    ]);

    if (config) setConfigCusto(config as ConfiguracoesCusto);

    const listaCustos = (custos as ProdutoCusto[]) ?? [];
    setProdutos(listaCustos);
    
    // Calcula lucro real de hoje abatendo insumo e rateio por item vendido
    const custoInsumoPorProduto = new Map(listaCustos.map((c) => [c.produto_id, Number(c.custo_insumos)]));
    const rateioPorProduto = new Map(listaCustos.map((c) => [c.produto_id, Number(c.taxa_rateio)]));

    const lista = pedidos ?? [];
    const faturamento = lista.reduce((s, p: any) => s + Number(p.valor_total), 0);
    const custoTotalReal = lista.reduce((s, p: any) =>
      s + (p.itens_pedido ?? []).reduce((si: number, it: any) => {
         const custoIns = custoInsumoPorProduto.get(it.produto_id) ?? 0;
         const custoOp = rateioPorProduto.get(it.produto_id) ?? 0;
         return si + ((custoIns + custoOp) * it.quantidade);
      }, 0), 0);

    setFaturamentoHoje(faturamento);
    setLucroHoje(faturamento - custoTotalReal);
    setPedidosHoje(lista.length);
    setCarregando(false);
  };

  useEffect(() => { carregarDados(); }, [lojaId]);

  const salvarCustos = async () => {
    setSalvando(true);
    setMensagem('');
    const { error } = await supabase.from('configuracoes_custo').upsert({
      ...configCusto,
      loja_id: lojaId,
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'loja_id' });
    
    if (error) setMensagem('Erro ao salvar custos.');
    else {
      setMensagem('Custos atualizados com sucesso!');
      await carregarDados(); // Recarrega a view de produtos com o novo rateio
    }
    setSalvando(false);
    setTimeout(() => setMensagem(''), 3000);
  };

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando inteligência financeira…</div>;

  const totalFixoMensal = Number(configCusto.custo_aluguel) + Number(configCusto.custo_energia) + Number(configCusto.custo_agua) + Number(configCusto.custo_internet) + Number(configCusto.custo_gas) + Number(configCusto.outros_custos_fixos);
  const rateioSimulado = Number(configCusto.expectativa_vendas_mes) > 0 ? totalFixoMensal / Number(configCusto.expectativa_vendas_mes) : 0;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="mb-3 font-bold text-xl dark:text-gray-100">Inteligência Financeira</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
        <button onClick={() => setAba('RESULTADOS')} className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${aba === 'RESULTADOS' ? 'bg-white dark:bg-gray-900 border-t border-x border-gray-100 dark:border-gray-800 text-[var(--cor-primaria)] -mb-[9px] shadow-[0_-2px_4px_rgba(0,0,0,0.02)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          📈 Resultados Reais
        </button>
        <button onClick={() => setAba('CUSTOS_FIXOS')} className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${aba === 'CUSTOS_FIXOS' ? 'bg-white dark:bg-gray-900 border-t border-x border-gray-100 dark:border-gray-800 text-[var(--cor-primaria)] -mb-[9px] shadow-[0_-2px_4px_rgba(0,0,0,0.02)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          🏢 Custos Operacionais
        </button>
      </div>

      {aba === 'RESULTADOS' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm dark:border dark:bg-gray-900">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><DollarSign size={11} /> Faturamento hoje</p>
              <p className="mt-1 text-lg font-bold dark:text-gray-100">{fmt(faturamentoHoje)}</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm dark:border dark:bg-gray-900 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-bl-lg text-[8px] font-bold text-red-600 dark:text-red-400">REAL</div>
              <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><TrendingUp size={11} /> Lucro Líquido</p>
              <p className={`mt-1 text-lg font-bold ${lucroHoje < 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(lucroHoje)}</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm dark:border dark:bg-gray-900">
              <p className="text-[10px] font-semibold text-gray-400">Pedidos hoje</p>
              <p className="mt-1 text-lg font-bold dark:text-gray-100">{pedidosHoje}</p>
            </div>
          </div>

          <p className="mb-2 text-sm font-semibold dark:text-gray-200">Lucro Líquido por Produto (Após rateio)</p>
          <div className="space-y-3">
            {produtos.map((p) => {
              const margemBaixa = p.margem_pct !== null && p.margem_pct < 30;
              const prejuizo = Number(p.lucro_liquido) < 0;
              return (
                <div key={p.produto_id} className={`rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm border ${prejuizo ? 'border-red-300 dark:border-red-900' : 'border-gray-100 dark:border-gray-800'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-base font-bold dark:text-gray-100">{p.nome}</p>
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${prejuizo ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : (margemBaixa ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')}`}>
                      {prejuizo || margemBaixa ? <TrendingDown size={12} /> : <TrendingUp size={12} />} {p.margem_pct ?? '0'}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Venda</p>
                      <p className="font-semibold dark:text-gray-200">{fmt(Number(p.preco_venda))}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Insumos (CMV)</p>
                      <p className="font-semibold text-orange-600 dark:text-orange-400">-{fmt(Number(p.custo_insumos))}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Custos Fixos</p>
                      <p className="font-semibold text-orange-600 dark:text-orange-400">-{fmt(Number(p.taxa_rateio))}</p>
                    </div>
                    <div className={`${prejuizo ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10'} rounded-lg p-2`}>
                      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Líq. Real</p>
                      <p className={`font-bold ${prejuizo ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{fmt(Number(p.lucro_liquido))}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {produtos.length === 0 && (
              <p className="py-10 text-center text-sm text-gray-400">
                Nenhum produto com ficha técnica ainda.
              </p>
            )}
          </div>
        </div>
      )}

      {aba === 'CUSTOS_FIXOS' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1 flex items-center gap-2"><Calculator size={16} /> Rateio de Custos</p>
            <p>O sistema pega o total dos seus gastos mensais e divide pela expectativa de vendas. Esse valor é cobrado no custo de cada lanche para garantir que a sua operação se pague.</p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
             <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Despesas Mensais (R$)</h3>
             
             <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Aluguel</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" 
                    value={configCusto.custo_aluguel} onChange={e => setConfigCusto({...configCusto, custo_aluguel: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Energia Elétrica</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" 
                    value={configCusto.custo_energia} onChange={e => setConfigCusto({...configCusto, custo_energia: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Água</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" 
                    value={configCusto.custo_agua} onChange={e => setConfigCusto({...configCusto, custo_agua: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Gás</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" 
                    value={configCusto.custo_gas} onChange={e => setConfigCusto({...configCusto, custo_gas: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Internet / Fone</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" 
                    value={configCusto.custo_internet} onChange={e => setConfigCusto({...configCusto, custo_internet: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Outros Gastos Fixos</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" 
                    value={configCusto.outros_custos_fixos} onChange={e => setConfigCusto({...configCusto, outros_custos_fixos: e.target.valueAsNumber || 0})} />
                </label>
             </div>

             <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
               <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                 <div className="w-full sm:w-1/2">
                   <label className="block">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1 block">Expectativa de Vendas / Mês (Qtd)</span>
                    <input type="number" className="w-full rounded-xl border-2 border-[var(--cor-primaria)] bg-green-50 dark:bg-green-900/10 p-3 text-lg font-bold text-[var(--cor-primaria)] focus:outline-none" 
                      value={configCusto.expectativa_vendas_mes} onChange={e => setConfigCusto({...configCusto, expectativa_vendas_mes: e.target.valueAsNumber || 0})} />
                    <p className="text-[10px] text-gray-500 mt-1">Quantos itens principais você estima vender por mês?</p>
                   </label>
                 </div>
                 
                 <div className="w-full sm:w-1/2 rounded-xl bg-gray-900 text-white p-4 text-center">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Despesas</p>
                   <p className="text-lg font-bold mb-2">{fmt(totalFixoMensal)}</p>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--cor-primaria)]">Rateio por Produto</p>
                   <p className="text-2xl font-black">{fmt(rateioSimulado)}</p>
                 </div>
               </div>
             </div>
             
             {mensagem && <p className={`mt-4 text-center text-sm font-semibold ${mensagem.includes('Erro') ? 'text-red-500' : 'text-green-600'}`}>{mensagem}</p>}
             
             <button onClick={salvarCustos} disabled={salvando} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50">
               <Save size={18} /> {salvando ? 'Salvando...' : 'Salvar Motor de Custos'}
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
