import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertTriangle, Plus, Pencil, Archive, ArchiveRestore, Calculator, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, fmt, InsumoRendimentoJSON } from '../../types';
import type { CtxLoja } from './AdminLayout';

export default function Estoque() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [inativos, setInativos] = useState<Insumo[]>([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  
  // States para Novo Insumo Dinâmico
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');
  const [precoEmbalagem, setPrecoEmbalagem] = useState('');
  
  type Regra = { id: string; de_qtd: string; de_unidade: string; para_qtd: string; para_unidade: string };
  const [regras, setRegras] = useState<Regra[]>([]);
  
  // Unidade final e qtd final calculadas
  const unidadeFinal = regras.length > 0 ? regras[regras.length - 1].para_unidade : 'un';
  const qtdEmbalagemFinal = regras.reduce((acc, r) => acc * (Number(r.para_qtd) / (Number(r.de_qtd) || 1)), 1);

  const [editando, setEditando] = useState<Insumo | null>(null);
  const [entrada, setEntrada] = useState<{ insumo: Insumo; qtd: string; custo: string } | null>(null);

  const carregar = async () => {
    const { data } = await supabase.from('insumos').select('*').eq('loja_id', lojaId).order('nome');
    const todos = (data as Insumo[]) ?? [];
    setInsumos(todos.filter((i) => i.ativo));
    setInativos(todos.filter((i) => !i.ativo));
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const addRegra = () => {
    setRegras([...regras, { id: Math.random().toString(), de_qtd: '1', de_unidade: regras.length > 0 ? regras[regras.length-1].para_unidade : 'embalagem', para_qtd: '1', para_unidade: '' }]);
  };

  const criar = async () => {
    if (!nome) return;
    const qtd = Number(quantidade || 0);
    const jsonRegras: InsumoRendimentoJSON = {
      regras: regras.map(r => ({ de_qtd: Number(r.de_qtd), de_unidade: r.de_unidade, para_qtd: Number(r.para_qtd), para_unidade: r.para_unidade }))
    };
    
    const { data } = await supabase.from('insumos').insert({
      loja_id: lojaId,
      nome,
      unidade_medida: unidadeFinal || 'un',
      quantidade_atual: qtd,
      estoque_minimo: Number(estoqueMinimo || 0),
      preco_embalagem: Number(precoEmbalagem || 0),
      qtd_embalagem: qtdEmbalagemFinal || 1,
      detalhes_rendimento: regras.length > 0 ? jsonRegras : null
    }).select('id').single();

    if (data && qtd > 0) {
      await supabase.from('movimentacoes_estoque').insert({
        loja_id: lojaId, insumo_id: data.id, tipo: 'ENTRADA', quantidade: qtd, motivo: 'Saldo inicial',
      });
    }
    
    setNome(''); setQuantidade(''); setEstoqueMinimo(''); setPrecoEmbalagem(''); setRegras([]);
    carregar();
  };

  const registrarEntrada = async () => {
    if (!entrada || !entrada.qtd) return;
    const qtd = Number(entrada.qtd);
    await supabase.from('insumos')
      .update({ quantidade_atual: Number(entrada.insumo.quantidade_atual) + qtd })
      .eq('id', entrada.insumo.id);
    await supabase.from('movimentacoes_estoque').insert({
      loja_id: lojaId, insumo_id: entrada.insumo.id, tipo: 'ENTRADA',
      quantidade: qtd, custo_total: Number(entrada.custo || 0), motivo: 'Compra',
    });
    setEntrada(null);
    carregar();
  };

  const toggleAtivo = async (i: Insumo) => {
    await supabase.from('insumos').update({ ativo: !i.ativo }).eq('id', i.id);
    carregar();
  };

  const criticos = insumos.filter((i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo));

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="mb-3 font-bold dark:text-gray-100">Estoque de Insumos</h2>

      {criticos.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:bg-amber-900/20 dark:border-amber-900/50 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
             <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800 dark:text-amber-500 mb-1">
               <AlertTriangle size={16} /> Estoque Crítico Detetado
             </p>
             <p className="text-xs text-amber-700 dark:text-amber-400">Você tem {criticos.length} insumos que chegaram na margem de risco.</p>
          </div>
          <Link to="/admin/compras" className="shrink-0 flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-800 dark:hover:bg-amber-700 dark:text-amber-100 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
            Ir para Central de Compras <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* NOVO INSUMO COM MOTOR DINÂMICO */}
      <div className="mb-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <p className="mb-4 text-sm font-bold flex items-center gap-2 dark:text-gray-100"><Calculator size={18} className="text-[var(--cor-primaria)]" /> Cadastrar Novo Insumo</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-3">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Nome do Insumo</span>
              <input className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100 focus:border-[var(--cor-primaria)] focus:outline-none" placeholder="ex: Tomate, Queijo Mussarela"
                value={nome} onChange={e => setNome(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
               <label className="block">
                 <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Preço da Compra (R$)</span>
                 <input className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number" placeholder="ex: 9.99"
                   value={precoEmbalagem} onChange={e => setPrecoEmbalagem(e.target.value)} />
               </label>
               <label className="block">
                 <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Qtd Atual em Estoque</span>
                 <input className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number"
                   value={quantidade} onChange={e => setQuantidade(e.target.value)} />
               </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Estoque Mínimo de Alerta</span>
              <input className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number"
                value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} />
            </label>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 relative">
             <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Calculadora de Rendimento</p>
             <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-4">Adicione regras se você compra de um jeito e usa de outro (ex: compra Peça, usa Fatias). Se você usa do mesmo jeito que compra, deixe vazio.</p>
             
             {regras.map((r, index) => (
                <div key={r.id} className="flex items-center gap-2 mb-2 bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
                  <input type="number" className="w-12 p-1 text-center text-xs border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-white" value={r.de_qtd} onChange={e => { const nr = [...regras]; nr[index].de_qtd = e.target.value; setRegras(nr); }} />
                  <input className="w-20 p-1 text-xs border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-white" placeholder="Peça" value={r.de_unidade} onChange={e => { const nr = [...regras]; nr[index].de_unidade = e.target.value; setRegras(nr); }} />
                  <span className="text-xs text-gray-400 font-bold">=</span>
                  <input type="number" className="w-16 p-1 text-center text-xs border rounded bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400" placeholder="Rende" value={r.para_qtd} onChange={e => { const nr = [...regras]; nr[index].para_qtd = e.target.value; setRegras(nr); }} />
                  <input className="w-20 p-1 text-xs border rounded bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400" placeholder="Fatias" value={r.para_unidade} onChange={e => { const nr = [...regras]; nr[index].para_unidade = e.target.value; setRegras(nr); }} />
                  <button onClick={() => setRegras(regras.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>
                </div>
             ))}

             <button onClick={addRegra} className="mt-2 text-xs font-semibold text-[var(--cor-primaria)] hover:underline flex items-center gap-1">
               <Plus size={12}/> Adicionar passo de rendimento
             </button>

             <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Resumo Matemático:</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  A compra (R$ {precoEmbalagem || '0,00'}) equivale a <span className="text-[var(--cor-primaria)] bg-[var(--cor-primaria)]/10 px-1 rounded">{qtdEmbalagemFinal} {unidadeFinal}</span>
                </p>
                {qtdEmbalagemFinal > 0 && Number(precoEmbalagem) > 0 && (
                   <p className="text-xs font-semibold text-green-600 dark:text-green-500 mt-1">Custo: {fmt(Number(precoEmbalagem)/qtdEmbalagemFinal)} por {unidadeFinal}</p>
                )}
             </div>
          </div>
        </div>
        <button onClick={criar} className="mt-4 w-full flex items-center justify-center gap-1 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-md hover:scale-[1.01] transition-transform">
          <Plus size={16} /> Salvar Insumo no Banco
        </button>
      </div>

      <div className="space-y-3">
        {insumos.map((i) => {
          const custoUnit = Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;
          const critico = Number(i.quantidade_atual) <= Number(i.estoque_minimo);
          return (
            <div key={i.id} className={`flex items-center justify-between rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm border ${critico ? 'border-amber-300 dark:border-amber-500/50' : 'border-gray-100 dark:border-gray-800'}`}>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{i.nome}</p>
                <div className="flex gap-4 mt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Estoque: <span className="font-semibold text-gray-700 dark:text-gray-300">{Number(i.quantidade_atual)} {i.unidade_medida}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Custo Unitário: <span className="font-semibold text-[var(--cor-primaria)]">{fmt(custoUnit)}</span>
                  </p>
                </div>
                {i.detalhes_rendimento?.regras && i.detalhes_rendimento.regras.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {i.detalhes_rendimento.regras.map((r: any, idx: number) => (
                      <span key={idx} className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                        {r.de_qtd} {r.de_unidade} ➔ {r.para_qtd} {r.para_unidade}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => setEntrada({ insumo: i, qtd: '', custo: '' })}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 dark:border-gray-700">+ Entrada</button>
                <button onClick={() => toggleAtivo(i)} className="rounded-lg border border-red-200 p-1.5 text-red-500 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Archive size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {inativos.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setMostrarInativos((v) => !v)} className="text-xs font-medium text-gray-400 underline">
            {mostrarInativos ? 'Ocultar' : 'Mostrar'} inativos ({inativos.length})
          </button>
          {mostrarInativos && (
            <div className="mt-2 space-y-2">
              {inativos.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-900 p-3 opacity-60 shadow-sm border border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-medium dark:text-gray-100">{i.nome}</p>
                  <button onClick={() => toggleAtivo(i)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 dark:border-gray-700">
                    <ArchiveRestore size={13} /> Reativar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal entrada */}
      {entrada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setEntrada(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-gray-900 p-5 dark:border dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-gray-900 dark:text-gray-100 mb-4">Nova Entrada — {entrada.insumo.nome}</p>
            <label className="block mb-3">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Qtd em {entrada.insumo.unidade_medida}</span>
              <input className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number" autoFocus
                value={entrada.qtd} onChange={(e) => setEntrada({ ...entrada, qtd: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Custo da compra R$ (opcional)</span>
              <input className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number"
                value={entrada.custo} onChange={(e) => setEntrada({ ...entrada, custo: e.target.value })} />
            </label>
            <button onClick={registrarEntrada} className="mt-5 w-full rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-lg">
              Registrar Estoque
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
