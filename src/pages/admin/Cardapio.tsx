import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, X, Star, EyeOff, Eye, Search, ChevronUp, ChevronDown, Save,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Categoria, Produto, GrupoOpcoes, Opcao, Insumo, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';

type Tab = 'produtos' | 'categorias';

export default function CardapioAdmin() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [tab, setTab] = useState<Tab>('produtos');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [busca, setBusca] = useState('');
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null);

  const carregar = async () => {
    const [{ data: c }, { data: p }, { data: i }] = await Promise.all([
      supabase.from('categorias').select('*').eq('loja_id', lojaId).order('ordem'),
      supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*)), fichas_tecnicas(*)').eq('loja_id', lojaId).order('ordem'),
      supabase.from('insumos').select('*').eq('loja_id', lojaId).eq('ativo', true).order('nome'),
    ]);
    setCategorias((c as Categoria[]) ?? []);
    setProdutos((p as Produto[]) ?? []);
    setInsumos((i as Insumo[]) ?? []);
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const visiveis = useMemo(
    () => produtos.filter((p) =>
      (!catAtiva || p.categoria_id === catAtiva) &&
      (!busca || p.nome.toLowerCase().includes(busca.toLowerCase()))),
    [produtos, catAtiva, busca],
  );

  const nomeCategoria = (id?: string) => categorias.find((c) => c.id === id)?.nome ?? 'Sem categoria';

  const toggleDisponivel = async (p: Produto) => {
    await supabase.from('produtos').update({ disponivel: !p.disponivel }).eq('id', p.id);
    carregar();
  };
  const toggleDestaque = async (p: Produto) => {
    await supabase.from('produtos').update({ destaque: !p.destaque }).eq('id', p.id);
    carregar();
  };
  const excluirProduto = async (p: Produto) => {
    if (!confirm(`Excluir "${p.nome}"? Essa ação não pode ser desfeita.`)) return;
    await supabase.from('produtos').delete().eq('id', p.id);
    carregar();
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex gap-2">
        {(['produtos', 'categorias'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
            {t === 'produtos' ? 'Produtos' : 'Categorias'}
          </button>
        ))}
      </div>

      {tab === 'categorias' && (
        <CategoriasTab lojaId={lojaId} categorias={categorias} onChange={carregar} />
      )}

      {tab === 'produtos' && (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
            <Search size={16} className="text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…"
              className="w-full bg-transparent text-sm outline-none" />
          </div>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setCatAtiva(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${!catAtiva ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
              Tudo
            </button>
            {categorias.map((c) => (
              <button key={c.id} onClick={() => setCatAtiva(c.id === catAtiva ? null : c.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${catAtiva === c.id ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
                {c.nome}
              </button>
            ))}
          </div>

          <button onClick={() => setEditando('novo')}
            className="mb-3 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--cor-primaria)] py-2.5 text-sm font-semibold text-white">
            <Plus size={15} /> Novo produto
          </button>

          <div className="space-y-2">
            {visiveis.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ${!p.disponivel ? 'opacity-50' : ''}`}>
                {p.imagem_url
                  ? <img src={p.imagem_url} className="h-14 w-14 shrink-0 rounded-lg object-cover" alt="" />
                  : <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  <p className="text-xs text-gray-400">{nomeCategoria(p.categoria_id)}</p>
                  <p className="text-sm font-bold text-[var(--cor-primaria)]">{fmt(Number(p.preco))}</p>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <button onClick={() => toggleDestaque(p)} title="Destaque">
                    <Star size={16} className={p.destaque ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                  </button>
                  <button onClick={() => toggleDisponivel(p)} title="Disponibilidade">
                    {p.disponivel ? <Eye size={16} className="text-green-600" /> : <EyeOff size={16} className="text-gray-400" />}
                  </button>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button onClick={() => setEditando(p)} className="rounded-lg border p-1.5 text-gray-500"><Pencil size={14} /></button>
                  <button onClick={() => excluirProduto(p)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {visiveis.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum produto encontrado.</p>}
          </div>
        </>
      )}

      {editando && (
        <ProdutoModal
          lojaId={lojaId}
          produto={editando === 'novo' ? null : editando}
          categorias={categorias}
          insumos={insumos}
          onClose={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar(); }}
        />
      )}
    </div>
  );
}

// ── Categorias ────────────────────────────────────────────────
function CategoriasTab({ lojaId, categorias, onChange }: { lojaId: string; categorias: Categoria[]; onChange: () => void }) {
  const [nova, setNova] = useState('');

  const criar = async () => {
    if (!nova.trim()) return;
    const ordem = categorias.length ? Math.max(...categorias.map((c) => c.ordem)) + 1 : 0;
    await supabase.from('categorias').insert({ loja_id: lojaId, nome: nova.trim(), ordem });
    setNova('');
    onChange();
  };
  const renomear = async (c: Categoria, nome: string) => {
    if (!nome.trim() || nome === c.nome) return;
    await supabase.from('categorias').update({ nome: nome.trim() }).eq('id', c.id);
    onChange();
  };
  const mover = async (c: Categoria, dir: -1 | 1) => {
    const idx = categorias.findIndex((x) => x.id === c.id);
    const alvo = categorias[idx + dir];
    if (!alvo) return;
    await Promise.all([
      supabase.from('categorias').update({ ordem: alvo.ordem }).eq('id', c.id),
      supabase.from('categorias').update({ ordem: c.ordem }).eq('id', alvo.id),
    ]);
    onChange();
  };
  const toggleAtiva = async (c: Categoria) => {
    await supabase.from('categorias').update({ ativo: !c.ativo }).eq('id', c.id);
    onChange();
  };
  const excluir = async (c: Categoria) => {
    if (!confirm(`Excluir a categoria "${c.nome}"? Produtos ficam sem categoria.`)) return;
    await supabase.from('categorias').delete().eq('id', c.id);
    onChange();
  };

  return (
    <div className="space-y-2">
      {categorias.map((c, idx) => (
        <div key={c.id} className={`flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm ${c.ativo === false ? 'opacity-50' : ''}`}>
          <div className="flex flex-col">
            <button disabled={idx === 0} onClick={() => mover(c, -1)} className="text-gray-400 disabled:opacity-20"><ChevronUp size={14} /></button>
            <button disabled={idx === categorias.length - 1} onClick={() => mover(c, 1)} className="text-gray-400 disabled:opacity-20"><ChevronDown size={14} /></button>
          </div>
          <input defaultValue={c.nome} onBlur={(e) => renomear(c, e.target.value)}
            className="flex-1 rounded-lg border-none bg-transparent p-1 text-sm font-medium outline-none focus:bg-gray-50" />
          <button onClick={() => toggleAtiva(c)} className="text-xs font-medium text-gray-500">
            {c.ativo === false ? 'Inativa' : 'Ativa'}
          </button>
          <button onClick={() => excluir(c)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}

      <div className="flex gap-2 rounded-xl bg-white p-2.5 shadow-sm">
        <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova categoria (ex: Bebidas)"
          className="flex-1 rounded-lg border p-2 text-sm" onKeyDown={(e) => e.key === 'Enter' && criar()} />
        <button onClick={criar} className="rounded-lg bg-[var(--cor-primaria)] px-4 text-sm font-semibold text-white">Add</button>
      </div>
    </div>
  );
}

// ── Modal de produto (dados + adicionais + ficha técnica) ──────
interface OpcaoForm { _key: string; nome: string; preco_adicional: number; disponivel: boolean; insumo_id?: string | null; quantidade_insumo?: number | null; }
interface GrupoForm { _key: string; nome: string; min_escolhas: number; max_escolhas: number; opcoes: OpcaoForm[]; }
interface FichaForm { insumo_id: string; quantidade_consumida: string; }

function ProdutoModal({ lojaId, produto, categorias, insumos, onClose, onSalvo }: {
  lojaId: string;
  produto: Produto | null;
  categorias: Categoria[];
  insumos: Insumo[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [preco, setPreco] = useState(String(produto?.preco ?? ''));
  const [imagemUrl, setImagemUrl] = useState(produto?.imagem_url ?? '');
  const [categoriaId, setCategoriaId] = useState(produto?.categoria_id ?? categorias[0]?.id ?? '');
  const [isCombo, setIsCombo] = useState(produto?.is_combo ?? false);
  const [destaque, setDestaque] = useState(produto?.destaque ?? false);
  const [controlaEstoque, setControlaEstoque] = useState(produto?.controla_estoque ?? true);
  const [grupos, setGrupos] = useState<GrupoForm[]>(
    (produto?.grupos_opcoes ?? []).map((g) => ({
      ...g, _key: g.id,
      opcoes: g.opcoes.map((o) => ({ ...o, _key: o.id })),
    })),
  );
  const [ficha, setFicha] = useState<FichaForm[]>(
    (produto?.fichas_tecnicas ?? []).map((f) => ({ insumo_id: f.insumo_id, quantidade_consumida: String(f.quantidade_consumida) })),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const custoInsumos = ficha.reduce((s, f) => {
    const i = insumos.find((x) => x.id === f.insumo_id);
    if (!i || !f.quantidade_consumida) return s;
    const custoUnit = Number(i.qtd_embalagem) > 0 ? Number(i.preco_embalagem) / Number(i.qtd_embalagem) : 0;
    return s + custoUnit * Number(f.quantidade_consumida);
  }, 0);
  const precoNum = Number(preco || 0);
  const margem = precoNum > 0 ? ((precoNum - custoInsumos) / precoNum) * 100 : 0;

  const addGrupo = () => setGrupos((g) => [...g, { _key: crypto.randomUUID(), nome: '', min_escolhas: 0, max_escolhas: 1, opcoes: [] }]);
  const addOpcao = (gKey: string) => setGrupos((g) => g.map((x) => x._key === gKey
    ? { ...x, opcoes: [...x.opcoes, { _key: crypto.randomUUID(), nome: '', preco_adicional: 0, disponivel: true }] }
    : x));
  const addInsumoFicha = () => insumos[0] && setFicha((f) => [...f, { insumo_id: insumos[0].id, quantidade_consumida: '' }]);

  const salvar = async () => {
    setErro('');
    if (!nome.trim() || !preco) return setErro('Preencha nome e preço.');
    setSalvando(true);
    try {
      const payload = {
        loja_id: lojaId,
        nome: nome.trim(),
        descricao: descricao || null,
        preco: precoNum,
        imagem_url: imagemUrl || null,
        categoria_id: categoriaId || null,
        is_combo: isCombo,
        destaque,
        controla_estoque: controlaEstoque,
      };

      let produtoId = produto?.id;
      if (produtoId) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', produtoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('produtos').insert(payload).select('id').single();
        if (error) throw error;
        produtoId = data.id;
      }

      // adicionais: substitui tudo (delete cascade em opcoes) — simples e seguro pro volume desse CRUD
      await supabase.from('grupos_opcoes').delete().eq('produto_id', produtoId);
      for (const g of grupos) {
        if (!g.nome.trim()) continue;
        const { data: novoGrupo, error: eg } = await supabase.from('grupos_opcoes')
          .insert({ produto_id: produtoId, nome: g.nome.trim(), min_escolhas: g.min_escolhas, max_escolhas: g.max_escolhas })
          .select('id').single();
        if (eg) throw eg;
        const opcoesValidas = g.opcoes.filter((o) => o.nome.trim());
        if (opcoesValidas.length) {
          const { error: eo } = await supabase.from('opcoes').insert(opcoesValidas.map((o) => ({
            grupo_id: novoGrupo.id,
            nome: o.nome.trim(),
            preco_adicional: Number(o.preco_adicional || 0),
            disponivel: o.disponivel,
            insumo_id: o.insumo_id || null,
            quantidade_insumo: o.insumo_id ? Number(o.quantidade_insumo || 1) : null,
          })));
          if (eo) throw eo;
        }
      }

      // ficha técnica: substitui tudo
      await supabase.from('fichas_tecnicas').delete().eq('produto_id', produtoId);
      const fichaValida = ficha.filter((f) => f.insumo_id && Number(f.quantidade_consumida) > 0);
      if (fichaValida.length) {
        const { error: ef } = await supabase.from('fichas_tecnicas').insert(fichaValida.map((f) => ({
          produto_id: produtoId, insumo_id: f.insumo_id, quantidade_consumida: Number(f.quantidade_consumida),
        })));
        if (ef) throw ef;
      }

      onSalvo();
    } catch (e: any) {
      setErro('Erro ao salvar: ' + (e?.message ?? String(e)));
    }
    setSalvando(false);
  };

  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="sheet max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{produto ? 'Editar produto' : 'Novo produto'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="mt-3 space-y-2">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto" className="w-full rounded-xl border p-2.5 text-sm" />
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição" rows={2} className="w-full rounded-xl border p-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={preco} onChange={(e) => setPreco(e.target.value)} type="number" placeholder="Preço R$" className="rounded-xl border p-2.5 text-sm" />
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="rounded-xl border p-2.5 text-sm">
              <option value="">Sem categoria</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <input value={imagemUrl} onChange={(e) => setImagemUrl(e.target.value)} placeholder="URL da imagem" className="w-full rounded-xl border p-2.5 text-sm" />

          <div className="flex flex-wrap gap-3 pt-1 text-xs">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={isCombo} onChange={(e) => setIsCombo(e.target.checked)} /> Combo</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} /> Destaque</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={controlaEstoque} onChange={(e) => setControlaEstoque(e.target.checked)} /> Controla estoque</label>
          </div>
        </div>

        {/* Ficha técnica */}
        {controlaEstoque && (
          <div className="mt-4 rounded-2xl border p-3">
            <p className="mb-2 text-sm font-semibold">Ficha técnica (consumo de insumos)</p>
            {ficha.map((f, idx) => (
              <div key={idx} className="mb-1.5 flex items-center gap-1.5">
                <select value={f.insumo_id} onChange={(e) => setFicha((arr) => arr.map((x, i) => i === idx ? { ...x, insumo_id: e.target.value } : x))}
                  className="flex-1 rounded-lg border p-1.5 text-xs">
                  {insumos.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>)}
                </select>
                <input value={f.quantidade_consumida} onChange={(e) => setFicha((arr) => arr.map((x, i) => i === idx ? { ...x, quantidade_consumida: e.target.value } : x))}
                  type="number" placeholder="Qtd" className="w-20 rounded-lg border p-1.5 text-xs" />
                <button onClick={() => setFicha((arr) => arr.filter((_, i) => i !== idx))} className="text-red-400"><X size={14} /></button>
              </div>
            ))}
            <button onClick={addInsumoFicha} disabled={!insumos.length} className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--cor-primaria)] disabled:opacity-40">
              <Plus size={12} /> Adicionar insumo
            </button>
            {!insumos.length && <p className="mt-1 text-xs text-gray-400">Cadastre insumos em Estoque primeiro.</p>}
            {ficha.length > 0 && (
              <div className="mt-2 flex justify-between border-t pt-2 text-xs">
                <span className="text-gray-500">Custo: {fmt(custoInsumos)}</span>
                <span className={`font-semibold ${margem < 30 ? 'text-red-500' : 'text-green-600'}`}>Margem: {margem.toFixed(0)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Adicionais */}
        <div className="mt-4 rounded-2xl border p-3">
          <p className="mb-2 text-sm font-semibold">Adicionais / extras</p>
          {grupos.map((g) => (
            <div key={g._key} className="mb-2 rounded-xl bg-gray-50 p-2">
              <div className="flex items-center gap-1.5">
                <input value={g.nome} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key ? { ...x, nome: e.target.value } : x))}
                  placeholder="Nome do grupo (ex: Extras)" className="flex-1 rounded-lg border p-1.5 text-xs" />
                <input value={g.min_escolhas} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key ? { ...x, min_escolhas: Number(e.target.value) } : x))}
                  type="number" placeholder="Mín" className="w-14 rounded-lg border p-1.5 text-xs" />
                <input value={g.max_escolhas} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key ? { ...x, max_escolhas: Number(e.target.value) } : x))}
                  type="number" placeholder="Máx" className="w-14 rounded-lg border p-1.5 text-xs" />
                <button onClick={() => setGrupos((arr) => arr.filter((x) => x._key !== g._key))} className="text-red-400"><Trash2 size={14} /></button>
              </div>
              <div className="mt-1.5 space-y-1 pl-2">
                {g.opcoes.map((o) => (
                  <div key={o._key} className="flex items-center gap-1.5">
                    <input value={o.nome} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key
                      ? { ...x, opcoes: x.opcoes.map((y) => y._key === o._key ? { ...y, nome: e.target.value } : y) } : x))}
                      placeholder="Opção (ex: Cebola roxa)" className="flex-1 rounded-lg border p-1.5 text-xs" />
                    <input value={o.preco_adicional} onChange={(e) => setGrupos((arr) => arr.map((x) => x._key === g._key
                      ? { ...x, opcoes: x.opcoes.map((y) => y._key === o._key ? { ...y, preco_adicional: Number(e.target.value) } : y) } : x))}
                      type="number" placeholder="+R$" className="w-16 rounded-lg border p-1.5 text-xs" />
                    <button onClick={() => setGrupos((arr) => arr.map((x) => x._key === g._key
                      ? { ...x, opcoes: x.opcoes.filter((y) => y._key !== o._key) } : x))} className="text-red-400"><X size={13} /></button>
                  </div>
                ))}
                <button onClick={() => addOpcao(g._key)} className="flex items-center gap-1 text-xs font-medium text-[var(--cor-primaria)]">
                  <Plus size={12} /> Opção
                </button>
              </div>
            </div>
          ))}
          <button onClick={addGrupo} className="flex items-center gap-1 text-xs font-medium text-[var(--cor-primaria)]">
            <Plus size={12} /> Novo grupo de adicionais
          </button>
        </div>

        {erro && <p className="mt-2 text-sm font-medium text-red-500">{erro}</p>}

        <button onClick={salvar} disabled={salvando}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white disabled:opacity-40">
          <Save size={16} /> {salvando ? 'Salvando…' : 'Salvar produto'}
        </button>
      </div>
    </div>
  );
}
