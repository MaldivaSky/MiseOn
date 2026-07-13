import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, X, Save, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Cupom, Banner, TaxaEntrega, HorarioFuncionamento, MetodoPgto, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';

type Tab = 'cupons' | 'banners' | 'taxas' | 'horarios';
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Marketing() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [tab, setTab] = useState<Tab>('cupons');

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(['cupons', 'banners', 'taxas', 'horarios'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
            {{ cupons: 'Cupons', banners: 'Banners', taxas: 'Taxas de entrega', horarios: 'Horários' }[t]}
          </button>
        ))}
      </div>

      {tab === 'cupons' && <CuponsTab lojaId={lojaId} />}
      {tab === 'banners' && <BannersTab lojaId={lojaId} />}
      {tab === 'taxas' && <TaxasTab lojaId={lojaId} />}
      {tab === 'horarios' && <HorariosTab lojaId={lojaId} />}
    </div>
  );
}

// ── Cupons ────────────────────────────────────────────────────
function CuponsTab({ lojaId }: { lojaId: string }) {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [editando, setEditando] = useState<Cupom | 'novo' | null>(null);

  const carregar = async () => {
    const { data } = await supabase.from('cupons').select('*').eq('loja_id', lojaId).order('codigo');
    setCupons((data as Cupom[]) ?? []);
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const toggleAtivo = async (c: Cupom) => {
    await supabase.from('cupons').update({ ativo: !c.ativo }).eq('id', c.id);
    carregar();
  };
  const excluir = async (c: Cupom) => {
    if (!confirm(`Excluir cupom "${c.codigo}"?`)) return;
    await supabase.from('cupons').delete().eq('id', c.id);
    carregar();
  };

  return (
    <div className="space-y-2">
      <button onClick={() => setEditando('novo')}
        className="mb-1 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--cor-primaria)] py-2.5 text-sm font-semibold text-white">
        <Plus size={15} /> Novo cupom
      </button>
      {cupons.map((c) => (
        <div key={c.id} className={`rounded-xl bg-white p-3 shadow-sm ${c.ativo === false ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <p className="font-bold">{c.codigo}</p>
            <span className="text-sm font-semibold text-[var(--cor-primaria)]">
              {c.tipo === 'FIXO' ? fmt(Number(c.valor)) : `${c.valor}%`}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {c.descricao || (c.apenas_primeiro_pedido ? 'Só na 1ª compra' : 'Uso geral')}
            {c.pedido_minimo > 0 && ` · mín. ${fmt(Number(c.pedido_minimo))}`}
            {c.metodo_exigido && ` · só ${c.metodo_exigido}`}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setEditando(c)} className="flex-1 rounded-lg border py-1.5 text-xs font-medium">Editar</button>
            <button onClick={() => toggleAtivo(c)} className="flex-1 rounded-lg border py-1.5 text-xs font-medium">{c.ativo === false ? 'Ativar' : 'Inativar'}</button>
            <button onClick={() => excluir(c)} className="rounded-lg border border-red-200 px-3 text-red-500"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      {cupons.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum cupom cadastrado.</p>}

      {editando && (
        <CupomModal lojaId={lojaId} cupom={editando === 'novo' ? null : editando}
          onClose={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

function CupomModal({ lojaId, cupom, onClose, onSalvo }: { lojaId: string; cupom: Cupom | null; onClose: () => void; onSalvo: () => void }) {
  const [codigo, setCodigo] = useState(cupom?.codigo ?? '');
  const [descricao, setDescricao] = useState(cupom?.descricao ?? '');
  const [tipo, setTipo] = useState<'FIXO' | 'PERCENTUAL'>(cupom?.tipo ?? 'FIXO');
  const [valor, setValor] = useState(String(cupom?.valor ?? ''));
  const [pedidoMinimo, setPedidoMinimo] = useState(String(cupom?.pedido_minimo ?? '0'));
  const [primeiraCompra, setPrimeiraCompra] = useState(cupom?.apenas_primeiro_pedido ?? false);
  const [metodo, setMetodo] = useState<MetodoPgto | ''>(cupom?.metodo_exigido ?? '');
  const [validade, setValidade] = useState(cupom?.validade ?? '');
  const [limiteUsos, setLimiteUsos] = useState(cupom?.limite_usos != null ? String(cupom.limite_usos) : '');
  const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!codigo.trim() || !valor) return setErro('Preencha código e valor.');
    const payload = {
      loja_id: lojaId,
      codigo: codigo.trim().toUpperCase(),
      descricao: descricao || null,
      tipo, valor: Number(valor),
      pedido_minimo: Number(pedidoMinimo || 0),
      apenas_primeiro_pedido: primeiraCompra,
      metodo_exigido: metodo || null,
      validade: validade || null,
      limite_usos: limiteUsos ? Number(limiteUsos) : null,
    };
    const { error } = cupom
      ? await supabase.from('cupons').update(payload).eq('id', cupom.id)
      : await supabase.from('cupons').insert(payload);
    if (error) return setErro('Erro: ' + error.message);
    onSalvo();
  };

  return (
    <div className="fade fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="sheet w-full max-w-lg rounded-t-3xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{cupom ? 'Editar cupom' : 'Novo cupom'}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (ex: BEMVINDO10)" className="w-full rounded-xl border p-2.5 uppercase" />
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" className="w-full rounded-xl border p-2.5" />
          <div className="grid grid-cols-2 gap-2">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="rounded-xl border p-2.5">
              <option value="FIXO">Valor fixo (R$)</option>
              <option value="PERCENTUAL">Percentual (%)</option>
            </select>
            <input value={valor} onChange={(e) => setValor(e.target.value)} type="number" placeholder="Valor" className="rounded-xl border p-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={pedidoMinimo} onChange={(e) => setPedidoMinimo(e.target.value)} type="number" placeholder="Pedido mínimo R$" className="rounded-xl border p-2.5" />
            <input value={limiteUsos} onChange={(e) => setLimiteUsos(e.target.value)} type="number" placeholder="Limite de usos" className="rounded-xl border p-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as any)} className="rounded-xl border p-2.5">
              <option value="">Qualquer método</option>
              {(['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO'] as MetodoPgto[]).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={validade} onChange={(e) => setValidade(e.target.value)} type="date" className="rounded-xl border p-2.5" />
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={primeiraCompra} onChange={(e) => setPrimeiraCompra(e.target.checked)} /> Válido só na 1ª compra do cliente
          </label>
        </div>
        {erro && <p className="mt-2 text-sm font-medium text-red-500">{erro}</p>}
        <button onClick={salvar} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 font-semibold text-white">
          <Save size={16} /> Salvar
        </button>
      </div>
    </div>
  );
}

// ── Banners ───────────────────────────────────────────────────
function BannersTab({ lojaId }: { lojaId: string }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [novo, setNovo] = useState({ imagem_url: '', titulo: '', link_redirecionamento: '' });

  const carregar = async () => {
    const { data } = await supabase.from('banners_destaque').select('*').eq('loja_id', lojaId).order('ordem_exibicao');
    setBanners((data as Banner[]) ?? []);
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const criar = async () => {
    if (!novo.imagem_url) return;
    const ordem = banners.length ? Math.max(...banners.map((b) => b.ordem_exibicao)) + 1 : 0;
    await supabase.from('banners_destaque').insert({ loja_id: lojaId, ...novo, ordem_exibicao: ordem });
    setNovo({ imagem_url: '', titulo: '', link_redirecionamento: '' });
    carregar();
  };
  const mover = async (b: Banner, dir: -1 | 1) => {
    const idx = banners.findIndex((x) => x.id === b.id);
    const alvo = banners[idx + dir];
    if (!alvo) return;
    await Promise.all([
      supabase.from('banners_destaque').update({ ordem_exibicao: alvo.ordem_exibicao }).eq('id', b.id),
      supabase.from('banners_destaque').update({ ordem_exibicao: b.ordem_exibicao }).eq('id', alvo.id),
    ]);
    carregar();
  };
  const toggleAtivo = async (b: Banner) => {
    await supabase.from('banners_destaque').update({ is_ativo: !b.is_ativo }).eq('id', b.id);
    carregar();
  };
  const excluir = async (b: Banner) => {
    if (!confirm('Excluir este banner?')) return;
    await supabase.from('banners_destaque').delete().eq('id', b.id);
    carregar();
  };

  return (
    <div className="space-y-2">
      {banners.map((b, idx) => (
        <div key={b.id} className={`flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm ${b.is_ativo === false ? 'opacity-50' : ''}`}>
          <img src={b.imagem_url} className="h-12 w-20 shrink-0 rounded-lg object-cover" alt="" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{b.titulo || '(sem título)'}</p>
            <p className="truncate text-xs text-gray-400">{b.link_redirecionamento || '—'}</p>
          </div>
          <div className="flex flex-col">
            <button disabled={idx === 0} onClick={() => mover(b, -1)} className="text-gray-400 disabled:opacity-20"><ChevronUp size={14} /></button>
            <button disabled={idx === banners.length - 1} onClick={() => mover(b, 1)} className="text-gray-400 disabled:opacity-20"><ChevronDown size={14} /></button>
          </div>
          <button onClick={() => toggleAtivo(b)} className="text-xs font-medium text-gray-500">{b.is_ativo === false ? 'Inativo' : 'Ativo'}</button>
          <button onClick={() => excluir(b)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}

      <div className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold">Novo banner</p>
        <input value={novo.imagem_url} onChange={(e) => setNovo({ ...novo, imagem_url: e.target.value })} placeholder="URL da imagem" className="w-full rounded-lg border p-2 text-sm" />
        <input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} placeholder="Título (opcional)" className="w-full rounded-lg border p-2 text-sm" />
        <input value={novo.link_redirecionamento} onChange={(e) => setNovo({ ...novo, link_redirecionamento: e.target.value })} placeholder="Link ao clicar (opcional)" className="w-full rounded-lg border p-2 text-sm" />
        <button onClick={criar} className="w-full rounded-lg bg-[var(--cor-primaria)] py-2 text-sm font-semibold text-white">Adicionar</button>
      </div>
    </div>
  );
}

// ── Taxas de entrega ──────────────────────────────────────────
function TaxasTab({ lojaId }: { lojaId: string }) {
  const [taxas, setTaxas] = useState<TaxaEntrega[]>([]);
  const [novo, setNovo] = useState({ bairro: '', valor: '' });

  const carregar = async () => {
    const { data } = await supabase.from('taxas_entrega').select('*').eq('loja_id', lojaId).order('bairro');
    setTaxas((data as TaxaEntrega[]) ?? []);
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const criar = async () => {
    if (!novo.bairro || !novo.valor) return;
    await supabase.from('taxas_entrega').insert({ loja_id: lojaId, bairro: novo.bairro, valor: Number(novo.valor) });
    setNovo({ bairro: '', valor: '' });
    carregar();
  };
  const atualizarValor = async (t: TaxaEntrega, valor: string) => {
    if (!valor || Number(valor) === Number(t.valor)) return;
    await supabase.from('taxas_entrega').update({ valor: Number(valor) }).eq('id', t.id);
    carregar();
  };
  const toggleAtivo = async (t: TaxaEntrega) => {
    await supabase.from('taxas_entrega').update({ ativo: !t.ativo }).eq('id', t.id);
    carregar();
  };
  const excluir = async (t: TaxaEntrega) => {
    if (!confirm(`Excluir a taxa do bairro "${t.bairro}"?`)) return;
    await supabase.from('taxas_entrega').delete().eq('id', t.id);
    carregar();
  };

  return (
    <div className="space-y-2">
      {taxas.map((t) => (
        <div key={t.id} className={`flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm ${t.ativo === false ? 'opacity-50' : ''}`}>
          <p className="flex-1 text-sm font-medium">{t.bairro}</p>
          <div className="flex items-center gap-1 text-sm">
            R$ <input defaultValue={t.valor} onBlur={(e) => atualizarValor(t, e.target.value)} type="number"
              className="w-16 rounded-lg border p-1 text-sm" />
          </div>
          <button onClick={() => toggleAtivo(t)} className="text-xs font-medium text-gray-500">{t.ativo === false ? 'Inativa' : 'Ativa'}</button>
          <button onClick={() => excluir(t)} className="rounded-lg border border-red-200 p-1.5 text-red-500"><Trash2 size={14} /></button>
        </div>
      ))}

      <div className="flex gap-2 rounded-xl bg-white p-2.5 shadow-sm">
        <input value={novo.bairro} onChange={(e) => setNovo({ ...novo, bairro: e.target.value })} placeholder="Bairro" className="flex-1 rounded-lg border p-2 text-sm" />
        <input value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} type="number" placeholder="R$" className="w-20 rounded-lg border p-2 text-sm" />
        <button onClick={criar} className="rounded-lg bg-[var(--cor-primaria)] px-4 text-sm font-semibold text-white">Add</button>
      </div>
    </div>
  );
}

// ── Horários de funcionamento ─────────────────────────────────
function HorariosTab({ lojaId }: { lojaId: string }) {
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>([]);

  const carregar = async () => {
    const { data } = await supabase.from('horarios_funcionamento').select('*').eq('loja_id', lojaId).order('dia_semana');
    setHorarios((data as HorarioFuncionamento[]) ?? []);
  };
  useEffect(() => { carregar(); }, [lojaId]);

  const addIntervalo = async (dia: number) => {
    await supabase.from('horarios_funcionamento').insert({ loja_id: lojaId, dia_semana: dia, abre: '08:00', fecha: '18:00' });
    carregar();
  };
  const atualizar = async (h: HorarioFuncionamento, campo: 'abre' | 'fecha', valor: string) => {
    await supabase.from('horarios_funcionamento').update({ [campo]: valor }).eq('id', h.id);
    carregar();
  };
  const excluir = async (h: HorarioFuncionamento) => {
    await supabase.from('horarios_funcionamento').delete().eq('id', h.id);
    carregar();
  };

  return (
    <div className="space-y-3">
      {DIAS.map((nome, dia) => {
        const doDia = horarios.filter((h) => h.dia_semana === dia);
        return (
          <div key={dia} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{nome}</p>
              <button onClick={() => addIntervalo(dia)} className="flex items-center gap-1 text-xs font-medium text-[var(--cor-primaria)]">
                <Plus size={12} /> Intervalo
              </button>
            </div>
            {doDia.length === 0 && <p className="mt-1 text-xs text-gray-400">Fechado</p>}
            {doDia.map((h) => (
              <div key={h.id} className="mt-1.5 flex items-center gap-2">
                <input defaultValue={h.abre?.slice(0, 5)} onBlur={(e) => atualizar(h, 'abre', e.target.value)} type="time" className="rounded-lg border p-1.5 text-xs" />
                <span className="text-xs text-gray-400">até</span>
                <input defaultValue={h.fecha?.slice(0, 5)} onBlur={(e) => atualizar(h, 'fecha', e.target.value)} type="time" className="rounded-lg border p-1.5 text-xs" />
                <button onClick={() => excluir(h)} className="text-red-400"><X size={14} /></button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
