import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ChefHat, Flame, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, fmt } from '../../types';

export default function EstoquePreparos({ lojaId, insumosTotais, onUpdate }: { lojaId: string; insumosTotais: Insumo[]; onUpdate: () => void }) {
  const [editando, setEditando] = useState<Insumo | 'novo' | null>(null);
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [rendimentoPorcoes, setRendimentoPorcoes] = useState('');
  const [pessoasServidas, setPessoasServidas] = useState('');
  const [ficha, setFicha] = useState<{ insumo_id: string; quantidade: string }[]>([]);
  
  const [salvando, setSalvando] = useState(false);
  
  // Gamificação da Produção
  const [produzindo, setProduzindo] = useState<Insumo | null>(null);
  const [multProducao, setMultProducao] = useState(1);
  const [produzindoSucesso, setProduzindoSucesso] = useState(false);

  const preparos = insumosTotais.filter(i => i.is_preparo && i.ativo);
  const insumosBrutos = insumosTotais.filter(i => !i.is_preparo && i.ativo);

  const iniciarEdicao = (p?: Insumo) => {
    if (p) {
      setEditando(p);
      setNome(p.nome);
      setUnidade(p.unidade_medida);
      setRendimentoPorcoes(String(p.rendimento_porcoes || ''));
      setPessoasServidas(String(p.pessoas_servidas || ''));
      setFicha((p as any).fichas_preparos?.map((f: any) => ({
        insumo_id: f.insumo_id,
        quantidade: String(f.quantidade)
      })) || []);
    } else {
      setEditando('novo');
      setNome('');
      setUnidade('un');
      setRendimentoPorcoes('');
      setPessoasServidas('');
      setFicha([]);
    }
  };

  const salvar = async () => {
    if (!nome.trim() || ficha.length === 0) return alert('Preencha o nome e adicione ingredientes.');
    setSalvando(true);
    try {
      let preparoId = editando !== 'novo' ? editando?.id : null;
      
      const payload = {
        loja_id: lojaId,
        nome,
        is_preparo: true,
        unidade_medida: unidade,
        rendimento_porcoes: Number(rendimentoPorcoes || 1),
        pessoas_servidas: Number(pessoasServidas || 1),
        ativo: true
      };

      if (preparoId) {
        await supabase.from('insumos').update(payload).eq('id', preparoId);
        await supabase.from('fichas_preparos').delete().eq('preparo_id', preparoId);
      } else {
        const { data } = await supabase.from('insumos').insert({ ...payload, quantidade_atual: 0, estoque_minimo: 0, preco_embalagem: 0, qtd_embalagem: 1 }).select('id').single();
        preparoId = data?.id;
      }

      if (preparoId) {
        const fichaValida = ficha.filter(f => f.insumo_id && Number(f.quantidade) > 0).map(f => ({
          loja_id: lojaId,
          preparo_id: preparoId,
          insumo_id: f.insumo_id,
          quantidade: Number(f.quantidade)
        }));
        if (fichaValida.length > 0) {
          await supabase.from('fichas_preparos').insert(fichaValida);
        }
      }
      setEditando(null);
      onUpdate();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar preparo.');
    }
    setSalvando(false);
  };

  const excluir = async (p: Insumo) => {
    if (confirm(`Excluir preparo ${p.nome}?`)) {
      await supabase.from('insumos').update({ ativo: false }).eq('id', p.id);
      onUpdate();
    }
  };

  const produzir = async () => {
    if (!produzindo || multProducao < 1) return;
    setSalvando(true);
    try {
      const fichaOrig = (produzindo as any).fichas_preparos || [];
      
      // 1. Dar saída nos ingredientes proporcionais ao multProducao
      const movimentacoesSaida = fichaOrig.map((f: any) => ({
        loja_id: lojaId,
        insumo_id: f.insumo_id,
        tipo: 'SAIDA',
        quantidade: Number(f.quantidade) * multProducao,
        motivo: `Produção de ${produzindo.nome} (${multProducao} receitas)`
      }));
      if (movimentacoesSaida.length > 0) await supabase.from('movimentacoes_estoque').insert(movimentacoesSaida);
      
      for (const m of movimentacoesSaida) {
        const insumoAtual = insumosTotais.find(i => i.id === m.insumo_id);
        if (insumoAtual) {
          await supabase.from('insumos').update({ quantidade_atual: Number(insumoAtual.quantidade_atual) - m.quantidade }).eq('id', m.insumo_id);
        }
      }

      // 2. Dar entrada no preparo (O rendimento já é 1 Receita = 1 'un' (ou X Litros). 
      // Wait: the preparo is tracked in `unidade_medida`. 
      // If the chef produces 1 recipe, and the recipe yields 10 Litros, do we credit 10 Litros?
      // Yes! Because the `unidade_medida` of Molho is `L` (Litros), and the production is 10 L per recipe?
      // Wait, let's keep it simple: 1 Lote de Produção = X rendimento final (rendimento_porcoes).
      // So if rendimento_porcoes = 10, and multProducao = 2, we credit 20 into the stock of the preparo.
      const qtdEntrada = Number(produzindo.rendimento_porcoes || 1) * multProducao;
      
      await supabase.from('movimentacoes_estoque').insert({
        loja_id: lojaId,
        insumo_id: produzindo.id,
        tipo: 'ENTRADA',
        quantidade: qtdEntrada,
        motivo: `Produção Concluída (${multProducao} receitas)`
      });
      await supabase.from('insumos').update({ quantidade_atual: Number(produzindo.quantidade_atual) + qtdEntrada }).eq('id', produzindo.id);

      setProduzindoSucesso(true);
      setTimeout(() => {
        setProduzindoSucesso(false);
        setProduzindo(null);
        setMultProducao(1);
        onUpdate();
      }, 2000);
    } catch (e) {
      console.error(e);
      alert('Erro na produção.');
    }
    setSalvando(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* HEADER GAMIFICADO */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white mb-6 shadow-lg shadow-orange-500/20">
        <div className="flex items-center gap-4">
           <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
             <ChefHat size={32} />
           </div>
           <div>
             <h2 className="text-2xl font-black">Cozinha & Preparos</h2>
             <p className="text-orange-100 text-sm mt-1 font-medium">Transforme insumos brutos em receitas base, caldos, molhos e massas.</p>
           </div>
        </div>
      </div>

      {!editando && (
        <>
          <button onClick={() => iniciarEdicao()} className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 py-3 font-bold transition-colors">
            <Plus size={18} /> Criar Nova Receita Base
          </button>

          <div className="space-y-4">
            {preparos.length === 0 && <p className="text-center text-gray-400 py-10">Nenhum preparo cadastrado ainda.</p>}
            {preparos.map(p => {
               // Calculate custo da receita base
               const fichaP = (p as any).fichas_preparos || [];
               const custoReceita = fichaP.reduce((s: number, f: any) => {
                 const i = insumosTotais.find(x => x.id === f.insumo_id);
                 if (!i) return s;
                 const custoUnit = Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;
                 return s + (custoUnit * Number(f.quantidade));
               }, 0);
               const rendimento = Number(p.rendimento_porcoes || 1);
               const custoPorcao = custoReceita / rendimento;

               return (
                 <div key={p.id} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                   <div className="flex items-start justify-between">
                     <div>
                       <h3 className="text-lg font-black dark:text-gray-100 flex items-center gap-2">
                         {p.nome}
                       </h3>
                       <div className="flex gap-4 mt-2">
                         <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-100 dark:border-gray-700">
                           <p className="text-[10px] text-gray-500 uppercase font-bold">Estoque Atual</p>
                           <p className="font-black text-gray-900 dark:text-gray-100">{Number(p.quantidade_atual)} {p.unidade_medida}</p>
                         </div>
                         <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg px-3 py-1.5 border border-orange-100 dark:border-orange-900/30">
                           <p className="text-[10px] text-orange-600 dark:text-orange-500 uppercase font-bold">Custo P/ {p.unidade_medida}</p>
                           <p className="font-black text-orange-700 dark:text-orange-400">{fmt(custoPorcao)}</p>
                         </div>
                       </div>
                     </div>
                     <div className="flex items-center gap-2">
                       <button onClick={() => setProduzindo(p)} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md shadow-orange-500/20 transition-all hover:scale-105">
                         <Flame size={16} /> Produzir
                       </button>
                       <div className="flex flex-col gap-1 border-l pl-2 dark:border-gray-800">
                         <button onClick={() => iniciarEdicao(p)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"><Pencil size={15} /></button>
                         <button onClick={() => excluir(p)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={15} /></button>
                       </div>
                     </div>
                   </div>
                 </div>
               );
            })}
          </div>
        </>
      )}

      {/* MODAL DE EDIÇÃO DE PREPARO */}
      {editando && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-orange-200 dark:border-orange-900/30 relative">
          <button onClick={() => setEditando(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
          
          <h3 className="font-black text-xl mb-4 text-orange-600 dark:text-orange-500">{editando === 'novo' ? 'Nova Receita Base' : 'Editar Receita'}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Nome do Preparo</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="ex: Molho de Tomate" className="mt-1 w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent dark:text-gray-100 outline-none focus:border-orange-500" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">1 Lote Rende Qtos?</label>
                <input value={rendimentoPorcoes} onChange={e => setRendimentoPorcoes(e.target.value)} type="number" placeholder="ex: 10" className="mt-1 w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent dark:text-gray-100 outline-none focus:border-orange-500 text-center font-bold text-lg" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Unidade (ml, g, un)</label>
                <select value={unidade} onChange={e => setUnidade(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent dark:text-gray-100 outline-none focus:border-orange-500 text-center font-bold">
                  <option value="un">Un (Porção)</option>
                  <option value="L">Litros (L)</option>
                  <option value="ml">ml</option>
                  <option value="kg">Kg</option>
                  <option value="g">Gramas (g)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Pessoas Servidas</label>
                <input value={pessoasServidas} onChange={e => setPessoasServidas(e.target.value)} type="number" placeholder="ex: 30" className="mt-1 w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent dark:text-gray-100 outline-none focus:border-orange-500 text-center font-bold text-lg" />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm mb-3 dark:text-gray-200">Ficha Técnica (Ingredientes que compõem 1 Lote)</h4>
              
              <div className="space-y-2">
                {ficha.map((f, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={f.insumo_id} onChange={e => { const n = [...ficha]; n[i].insumo_id = e.target.value; setFicha(n); }} className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent dark:text-gray-100 text-sm">
                      <option value="">Selecione um Insumo Bruto...</option>
                      {insumosBrutos.map(ib => <option key={ib.id} value={ib.id}>{ib.nome} ({ib.unidade_medida})</option>)}
                    </select>
                    <input value={f.quantidade} onChange={e => { const n = [...ficha]; n[i].quantidade = e.target.value; setFicha(n); }} type="number" placeholder="Qtd" className="w-24 p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent dark:text-gray-100 text-sm text-center" />
                    <button onClick={() => { const n = [...ficha]; n.splice(i, 1); setFicha(n); }} className="p-2 text-red-400 hover:text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                  </div>
                ))}
                <button onClick={() => setFicha([...ficha, { insumo_id: '', quantidade: '' }])} className="text-orange-600 dark:text-orange-500 font-bold text-xs flex items-center gap-1 mt-2">
                  <Plus size={14}/> Adicionar Ingrediente
                </button>
              </div>
            </div>

            <button onClick={salvar} disabled={salvando} className="w-full mt-4 bg-orange-600 text-white font-bold rounded-xl py-3 shadow-md hover:bg-orange-700 disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar Receita'}
            </button>
          </div>
        </div>
      )}

      {/* GAMIFICADA: BORA COZINHAR */}
      {produzindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm" onClick={() => !salvando && setProduzindo(null)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl p-8 relative overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* Background blur color */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-orange-500/20 to-transparent pointer-events-none" />
            
            {produzindoSucesso ? (
               <div className="text-center py-10 animate-in zoom-in duration-300">
                  <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-500">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">Pronto!</h3>
                  <p className="text-gray-500 mt-2 font-medium">Os insumos foram debitados e o lote de {produzindo.nome} foi adicionado ao estoque.</p>
               </div>
            ) : (
               <>
                  <div className="flex justify-center mb-4 relative z-10">
                    <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 p-4 rounded-full shadow-inner">
                      <Flame size={32} />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-black text-center text-gray-900 dark:text-gray-100 mb-2">Bora Cozinhar!</h3>
                  <p className="text-center text-gray-500 text-sm font-medium mb-6">Quantas receitas de <b className="text-orange-600">{produzindo.nome}</b> você vai fazer agora?</p>

                  <div className="flex items-center justify-center gap-6 mb-8">
                     <button onClick={() => setMultProducao(m => Math.max(1, m - 1))} className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">-</button>
                     <div className="text-center w-24">
                       <span className="text-5xl font-black text-orange-600 dark:text-orange-500">{multProducao}x</span>
                       <span className="block text-[10px] uppercase font-bold text-gray-400 mt-1">Lotes</span>
                     </div>
                     <button onClick={() => setMultProducao(m => m + 1)} className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">+</button>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl p-4 border border-orange-100 dark:border-orange-900/30 mb-6 max-h-32 overflow-y-auto">
                    <p className="text-[10px] uppercase font-black text-orange-800 dark:text-orange-400 mb-2">Resumo da Produção:</p>
                    <ul className="space-y-1.5">
                       {((produzindo as any).fichas_preparos || []).map((f: any, idx: number) => {
                          const i = insumosTotais.find(x => x.id === f.insumo_id);
                          return (
                            <li key={idx} className="flex justify-between text-sm font-medium">
                              <span className="text-gray-600 dark:text-gray-400 line-through decoration-red-500/50 decoration-2">{i?.nome}</span>
                              <span className="text-red-500 font-bold">-{Number(f.quantidade) * multProducao} {i?.unidade_medida}</span>
                            </li>
                          );
                       })}
                    </ul>
                    <div className="mt-3 pt-3 border-t border-orange-200/50 flex justify-between text-sm font-black">
                       <span className="text-orange-800 dark:text-orange-400">Rendimento Final:</span>
                       <span className="text-green-600">+{Number(produzindo.rendimento_porcoes || 1) * multProducao} {produzindo.unidade_medida}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                     <button onClick={() => setProduzindo(null)} className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancelar</button>
                     <button onClick={produzir} disabled={salvando} className="flex-1 py-4 font-black text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/30 hover:scale-105 transition-all disabled:opacity-50">
                       {salvando ? 'Debitando...' : 'Panela no Fogo!'}
                     </button>
                  </div>
               </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
