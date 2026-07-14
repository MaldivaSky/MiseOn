import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';

type FormInsumo = { nome: string; unidade_medida: string; quantidade: string; estoque_minimo: string; preco_embalagem: string; qtd_embalagem: string };
const vazio: FormInsumo = { nome: '', unidade_medida: 'un', quantidade: '', estoque_minimo: '', preco_embalagem: '', qtd_embalagem: '' };

export default function Estoque() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [inativos, setInativos] = useState<Insumo[]>([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [novo, setNovo] = useState<FormInsumo>(vazio);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [formEdicao, setFormEdicao] = useState<FormInsumo>(vazio);
  const [entrada, setEntrada] = useState<{ insumo: Insumo; qtd: string; custo: string } | null>(null);

  const carregar = async () => {
    const { data } = await supabase.from('insumos').select('*').eq('loja_id', lojaId).order('nome');
    const todos = (data as Insumo[]) ?? [];
    setInsumos(todos.filter((i) => i.ativo));
    setInativos(todos.filter((i) => !i.ativo));
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const criar = async () => {
    if (!novo.nome) return;
    const qtd = Number(novo.quantidade || 0);
    const { data } = await supabase.from('insumos').insert({
      loja_id: lojaId,
      nome: novo.nome,
      unidade_medida: novo.unidade_medida,
      quantidade_atual: qtd,
      estoque_minimo: Number(novo.estoque_minimo || 0),
      preco_embalagem: Number(novo.preco_embalagem || 0),
      qtd_embalagem: Number(novo.qtd_embalagem || 1),
    }).select('id').single();
    if (data && qtd > 0) {
      await supabase.from('movimentacoes_estoque').insert({
        loja_id: lojaId, insumo_id: data.id, tipo: 'ENTRADA', quantidade: qtd, motivo: 'Saldo inicial',
      });
    }
    setNovo({ nome: '', unidade_medida: 'un', quantidade: '', estoque_minimo: '', preco_embalagem: '', qtd_embalagem: '' });
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

  const abrirEdicao = (i: Insumo) => {
    setEditando(i);
    setFormEdicao({
      nome: i.nome, unidade_medida: i.unidade_medida,
      quantidade: String(i.quantidade_atual), estoque_minimo: String(i.estoque_minimo),
      preco_embalagem: String(i.preco_embalagem), qtd_embalagem: String(i.qtd_embalagem),
    });
  };

  const salvarEdicao = async () => {
    if (!editando || !formEdicao.nome) return;
    await supabase.from('insumos').update({
      nome: formEdicao.nome,
      unidade_medida: formEdicao.unidade_medida,
      estoque_minimo: Number(formEdicao.estoque_minimo || 0),
      preco_embalagem: Number(formEdicao.preco_embalagem || 0),
      qtd_embalagem: Number(formEdicao.qtd_embalagem || 1),
    }).eq('id', editando.id);
    setEditando(null);
    carregar();
  };

  const toggleAtivo = async (i: Insumo) => {
    await supabase.from('insumos').update({ ativo: !i.ativo }).eq('id', i.id);
    carregar();
  };

  const criticos = insumos.filter((i) => Number(i.quantidade_atual) <= Number(i.estoque_minimo));

  return (
    <div className="p-4">
      <h2 className="mb-3 font-bold">Estoque de insumos</h2>

      {criticos.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1 text-sm font-semibold text-amber-700">
            <AlertTriangle size={15} /> Lista de compras ({criticos.length})
          </p>
          <ul className="mt-1 text-xs text-amber-700">
            {criticos.map((i) => (
              <li key={i.id}>• {i.nome} — restam {Number(i.quantidade_atual)} {i.unidade_medida}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {insumos.map((i) => {
          const custoUnit = Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;
          const critico = Number(i.quantidade_atual) <= Number(i.estoque_minimo);
          return (
            <div key={i.id} className={`flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800 ${critico ? 'border-amber-300 dark:border-amber-500/50' : ''}`}>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{i.nome}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {Number(i.quantidade_atual)} {i.unidade_medida} em estoque
                  {custoUnit > 0 && <> · {fmt(custoUnit)}/{i.unidade_medida}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => setEntrada({ insumo: i, qtd: '', custo: '' })}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 dark:border-gray-700">+ Entrada</button>
                <button onClick={() => abrirEdicao(i)} className="rounded-lg border p-1.5 text-gray-500 dark:text-gray-400 dark:border-gray-700"><Pencil size={14} /></button>
                <button onClick={() => toggleAtivo(i)} className="rounded-lg border border-red-200 p-1.5 text-red-500 dark:border-red-900"><Archive size={14} /></button>
              </div>
            </div>
          );
        })}
        {insumos.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Nenhum insumo cadastrado ainda.</p>}
      </div>

      {inativos.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setMostrarInativos((v) => !v)} className="text-xs font-medium text-gray-400 underline">
            {mostrarInativos ? 'Ocultar' : 'Mostrar'} inativos ({inativos.length})
          </button>
          {mostrarInativos && (
            <div className="mt-2 space-y-2">
              {inativos.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-xl bg-white p-3 opacity-60 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{i.nome}</p>
                  <button onClick={() => toggleAtivo(i)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 dark:border-gray-700">
                    <ArchiveRestore size={13} /> Reativar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Novo insumo */}
      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900 dark:border dark:border-gray-800">
        <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Novo insumo</p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:bg-gray-800/50 dark:border-gray-700">
            <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Dados Básicos</p>
            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Nome do Insumo</span>
                <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" placeholder="ex: Queijo Prato, Baguete"
                  value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Unidade (Medida)</span>
                <select className="w-full rounded-xl border border-gray-300 p-2 focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" value={novo.unidade_medida}
                  onChange={(e) => setNovo({ ...novo, unidade_medida: e.target.value })}>
                  {['un', 'g', 'kg', 'ml', 'l'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="col-span-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:bg-gray-800/50 dark:border-gray-700">
            <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Gestão e Custos</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Estoque Atual ({novo.unidade_medida})</span>
                <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" type="number"
                  value={novo.quantidade} onChange={(e) => setNovo({ ...novo, quantidade: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Estoque Mínimo de Alerta</span>
                <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" type="number"
                  value={novo.estoque_minimo} onChange={(e) => setNovo({ ...novo, estoque_minimo: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Preço da Embalagem Fechada (R$)</span>
                <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" type="number"
                  value={novo.preco_embalagem} onChange={(e) => setNovo({ ...novo, preco_embalagem: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Qtd. na Embalagem (em {novo.unidade_medida})</span>
                <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-[var(--cor-primaria)] focus:outline-none dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100" type="number" placeholder="ex: pacote 500g → 500"
                  value={novo.qtd_embalagem} onChange={(e) => setNovo({ ...novo, qtd_embalagem: e.target.value })} />
              </label>
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              * O preço e quantidade da embalagem servem para o sistema calcular o custo de cada {novo.unidade_medida} do insumo.
            </p>
          </div>
        </div>
        <button onClick={criar} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white">
          <Plus size={15} /> Cadastrar
        </button>
      </div>

      {/* Modal entrada */}
      {entrada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setEntrada(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 dark:bg-gray-900 dark:border dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-gray-900 dark:text-gray-100">Entrada — {entrada.insumo.nome}</p>
            <label className="mt-2 block">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Quantidade ({entrada.insumo.unidade_medida})</span>
              <input className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:border-green-600 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number" autoFocus
                value={entrada.qtd} onChange={(e) => setEntrada({ ...entrada, qtd: e.target.value })} />
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Custo da compra R$ (opcional)</span>
              <input className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:border-green-600 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number"
                value={entrada.custo} onChange={(e) => setEntrada({ ...entrada, custo: e.target.value })} />
            </label>
            <button onClick={registrarEntrada} className="mt-3 w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white">
              Registrar
            </button>
          </div>
        </div>
      )}

      {/* Modal edição */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setEditando(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 dark:bg-gray-900 dark:border dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Editar insumo</p>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Nome do Insumo</span>
                <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-blue-500 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" 
                  value={formEdicao.nome} onChange={(e) => setFormEdicao({ ...formEdicao, nome: e.target.value })} />
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Unidade</span>
                  <select className="w-full rounded-xl border border-gray-300 p-2 focus:border-blue-500 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" value={formEdicao.unidade_medida}
                    onChange={(e) => setFormEdicao({ ...formEdicao, unidade_medida: e.target.value })}>
                    {['un', 'g', 'kg', 'ml', 'l'].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Estoque Mínimo</span>
                  <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-blue-500 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number"
                    value={formEdicao.estoque_minimo} onChange={(e) => setFormEdicao({ ...formEdicao, estoque_minimo: e.target.value })} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Preço Embalagem (R$)</span>
                  <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-blue-500 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number"
                    value={formEdicao.preco_embalagem} onChange={(e) => setFormEdicao({ ...formEdicao, preco_embalagem: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Qtd. na Embalagem</span>
                  <input className="w-full rounded-xl border border-gray-300 p-2 focus:border-blue-500 focus:outline-none dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100" type="number"
                    value={formEdicao.qtd_embalagem} onChange={(e) => setFormEdicao({ ...formEdicao, qtd_embalagem: e.target.value })} />
                </label>
              </div>
            </div>
            <button onClick={salvarEdicao} className="mt-3 w-full rounded-xl bg-blue-800 py-2.5 text-sm font-semibold text-white">
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
