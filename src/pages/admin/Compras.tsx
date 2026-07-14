import { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShoppingCart, CheckCircle2, Circle, HelpCircle, PackageCheck, AlertTriangle, ArrowRight, Loader2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';

interface ItemCompra {
  insumo: Insumo;
  falta_qtd: number;
  unidade_compra: string;
  sugestao_embalagens: number;
  qtd_comprar: number;
  selecionado: boolean;
}

export default function Compras() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [itens, setItens] = useState<ItemCompra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const { data } = await supabase
      .from('insumos')
      .select('*')
      .eq('loja_id', lojaId)
      .eq('ativo', true)
      .order('nome');
      
    const insumos = (data as Insumo[]) ?? [];
    const criticos = insumos.filter(i => Number(i.quantidade_atual) <= Number(i.estoque_minimo));

    const lista: ItemCompra[] = criticos.map(i => {
      const falta = Number(i.estoque_minimo) - Number(i.quantidade_atual);
      const rendimentoPorEmbalagem = Number(i.qtd_embalagem) || 1;
      const sugestao = Math.max(1, Math.ceil(falta / rendimentoPorEmbalagem));
      
      const unidadeCompra = i.detalhes_rendimento?.regras && i.detalhes_rendimento.regras.length > 0
        ? i.detalhes_rendimento.regras[0].de_unidade
        : i.unidade_medida;

      return {
        insumo: i,
        falta_qtd: falta,
        unidade_compra: unidadeCompra,
        sugestao_embalagens: sugestao,
        qtd_comprar: sugestao, // Padrão é a sugestão
        selecionado: true, // Já vem selecionado pro carrinho
      };
    });

    setItens(lista);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [lojaId]);

  const toggleItem = (id: string) => {
    setItens(arr => arr.map(it => it.insumo.id === id ? { ...it, selecionado: !it.selecionado } : it));
  };

  const updateQtd = (id: string, qtd: number) => {
    if (qtd < 1) qtd = 1;
    setItens(arr => arr.map(it => it.insumo.id === id ? { ...it, qtd_comprar: qtd } : it));
  };

  const totalSelecionado = useMemo(() => {
    return itens
      .filter(i => i.selecionado)
      .reduce((acc, curr) => acc + (curr.qtd_comprar * Number(curr.insumo.preco_embalagem)), 0);
  }, [itens]);

  const qtdSelecionada = itens.filter(i => i.selecionado).length;

  const registrarAbastecimento = async () => {
    if (qtdSelecionada === 0) return;
    setSalvando(true);

    const aAbastecer = itens.filter(i => i.selecionado);

    try {
      const movimentacoes = aAbastecer.map(it => {
         const rendimentoBase = Number(it.insumo.qtd_embalagem) || 1;
         const qtdEmUnidadeUso = it.qtd_comprar * rendimentoBase;
         return {
           loja_id: lojaId,
           insumo_id: it.insumo.id,
           tipo: 'ENTRADA',
           quantidade: qtdEmUnidadeUso,
           custo_total: it.qtd_comprar * Number(it.insumo.preco_embalagem),
           motivo: 'Abastecimento em Lote (Central de Compras)',
         };
      });

      // Insert lot of movimentações
      const { error: errMov } = await supabase.from('movimentacoes_estoque').insert(movimentacoes);
      if (errMov) throw errMov;

      // Update insumos table (infelizmente o supabase rpc em massa seria melhor, mas podemos fazer loop ou update individual)
      // Como o volume de abastecimento por vez não costuma passar de 30 itens, Promise.all é seguro
      await Promise.all(aAbastecer.map(async (it) => {
         const rendimentoBase = Number(it.insumo.qtd_embalagem) || 1;
         const qtdEntrada = it.qtd_comprar * rendimentoBase;
         await supabase.from('insumos')
           .update({ quantidade_atual: Number(it.insumo.quantidade_atual) + qtdEntrada })
           .eq('id', it.insumo.id);
      }));

      setSucesso(true);
      setTimeout(() => {
        setSucesso(false);
        carregar();
      }, 3000);
    } catch (e) {
      console.error(e);
      alert('Erro ao registrar abastecimento.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <div className="p-8 text-center text-gray-400">Verificando despensa...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[var(--cor-primaria)]/10 p-3 rounded-2xl text-[var(--cor-primaria)]">
           <ShoppingCart size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black dark:text-gray-100">Central de Compras</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Planeje seu abastecimento com inteligência.</p>
        </div>
      </div>

      {itens.length === 0 && !sucesso ? (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-3xl p-8 text-center">
          <PackageCheck size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-green-800 dark:text-green-500 mb-1">Estoque Controlado!</h3>
          <p className="text-green-700 dark:text-green-600/80 text-sm">Não há nenhum insumo abaixo da margem de segurança. Você está pronto para vender.</p>
        </div>
      ) : sucesso ? (
        <div className="bg-[var(--cor-primaria)]/10 border border-[var(--cor-primaria)]/20 rounded-3xl p-8 text-center animate-in zoom-in duration-300">
          <CheckCircle2 size={48} className="mx-auto text-[var(--cor-primaria)] mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Abastecimento Registrado!</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">O seu estoque foi atualizado automaticamente com as conversões corretas.</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-gray-100 dark:border-gray-800 flex items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
                <p>O sistema leu a sua <strong>Calculadora de Rendimento</strong> e converteu o que falta no estoque (ex: Gramas) de volta para a forma original de como você compra (ex: Fardo).</p>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {itens.map((it) => (
                <div key={it.insumo.id} className={`p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center transition-colors ${it.selecionado ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-950/50 opacity-60'}`}>
                  
                  {/* Célula 1: Check & Nome */}
                  <div className="flex items-center gap-4 flex-1">
                    <button onClick={() => toggleItem(it.insumo.id)} className={`shrink-0 transition-colors ${it.selecionado ? 'text-[var(--cor-primaria)]' : 'text-gray-300 dark:text-gray-600'}`}>
                      {it.selecionado ? <CheckCircle2 size={28} /> : <Circle size={28} strokeWidth={1.5} />}
                    </button>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">{it.insumo.nome}</p>
                      <p className="text-xs text-red-500 dark:text-red-400 font-semibold flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={12} /> Estoque crítico: restam {Number(it.insumo.quantidade_atual)} (Mín. {Number(it.insumo.estoque_minimo)})
                      </p>
                    </div>
                  </div>

                  {/* Célula 2: Controles de Qtd */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                    <div className="flex flex-col items-center">
                       <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                         <button onClick={() => updateQtd(it.insumo.id, it.qtd_comprar - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-gray-700 font-black text-gray-500 transition-colors">-</button>
                         <input type="number" value={it.qtd_comprar} onChange={e => updateQtd(it.insumo.id, e.target.valueAsNumber || 1)} className="w-12 text-center bg-transparent font-bold text-lg focus:outline-none dark:text-gray-100" />
                         <button onClick={() => updateQtd(it.insumo.id, it.qtd_comprar + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-gray-700 font-black text-gray-500 transition-colors">+</button>
                       </div>
                       <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mt-1.5">{it.unidade_compra}s</p>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <p className="text-sm font-black text-gray-900 dark:text-gray-100">
                        {fmt(it.qtd_comprar * Number(it.insumo.preco_embalagem))}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1" title="Preço unitário cadastrado no estoque">
                        ({fmt(Number(it.insumo.preco_embalagem))} un)
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Painel Flutuante (Bottom Bar) de Ação Massiva */}
          <div className="fixed bottom-[60px] sm:bottom-0 left-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-40">
             <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                
                <div className="flex items-center gap-4 w-full sm:w-auto">
                   <div className="bg-gray-100 dark:bg-gray-800 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl text-gray-700 dark:text-gray-300">
                     {qtdSelecionada}
                   </div>
                   <div>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Itens no Carrinho</p>
                     <p className="text-sm text-gray-400">Total estimado:</p>
                   </div>
                   <div className="ml-auto sm:ml-4">
                     <p className="text-3xl font-black text-gray-900 dark:text-gray-100">{fmt(totalSelecionado)}</p>
                   </div>
                </div>

                <button 
                  onClick={registrarAbastecimento}
                  disabled={qtdSelecionada === 0 || salvando}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--cor-primaria)] text-white font-bold text-sm px-8 py-4 rounded-2xl shadow-xl shadow-[var(--cor-primaria)]/20 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  {salvando ? <><Loader2 size={18} className="animate-spin" /> Registrando...</> : <><PackageCheck size={18} /> Registrar Abastecimento <ArrowRight size={16} className="ml-2 opacity-50" /></>}
                </button>
             </div>
          </div>
        </>
      )}
    </div>
  );
}
