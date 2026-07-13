import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Store, Save, Check, Palette, Type as TypeIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PALETA_CORES, PALETA_TEXTO, fonteFamilia } from '../../lib/personalizacao';
import ColorSwatchPicker from '../../components/ColorSwatchPicker';
import FontPicker from '../../components/FontPicker';
import ImageUpload from '../../components/ImageUpload';
import type { CtxLoja } from './AdminLayout';

/**
 * Minha Loja — identidade white-label editável pelo lojista.
 * Preview ao vivo do cabeçalho da vitrine + paleta de cores/fontes curadas
 * (em vez de campos soltos) e upload real de imagem pro Supabase Storage.
 */
interface FormLoja {
  nome: string;
  descricao: string;
  logo_url: string;
  banner_url: string;
  cor_primaria: string;
  cor_secundaria: string;
  fonte: string;
  cor_texto: string;
  whatsapp: string;
  telefone: string;
  endereco: string;
  pedido_minimo: string;
  pix_chave: string;
}

const vazio: FormLoja = {
  nome: '', descricao: '', logo_url: '', banner_url: '',
  cor_primaria: PALETA_CORES[5], cor_secundaria: PALETA_CORES[1],
  fonte: 'Inter', cor_texto: PALETA_TEXTO[0],
  whatsapp: '', telefone: '', endereco: '', pedido_minimo: '0', pix_chave: '',
};

type Aba = 'aparencia' | 'identidade';

export default function Loja() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [aba, setAba] = useState<Aba>('aparencia');
  const [form, setForm] = useState<FormLoja>(vazio);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('lojas').select('*').eq('id', lojaId).single();
      if (data) {
        setForm({
          nome: data.nome ?? '', descricao: data.descricao ?? '',
          logo_url: data.logo_url ?? '', banner_url: data.banner_url ?? '',
          cor_primaria: data.cor_primaria ?? vazio.cor_primaria,
          cor_secundaria: data.cor_secundaria ?? vazio.cor_secundaria,
          fonte: data.fonte ?? 'Inter',
          cor_texto: data.cor_texto ?? vazio.cor_texto,
          whatsapp: data.whatsapp ?? '', telefone: data.telefone ?? '', endereco: data.endereco ?? '',
          pedido_minimo: String(data.pedido_minimo ?? 0), pix_chave: data.pix_chave ?? '',
        });
      }
      setCarregando(false);
    })();
  }, [lojaId]);

  const set = (k: keyof FormLoja) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setValor = (k: keyof FormLoja, valor: string) => setForm((f) => ({ ...f, [k]: valor }));

  const salvar = async () => {
    setErro(''); setOk(false); setSalvando(true);
    const { error } = await supabase.from('lojas').update({
      nome: form.nome,
      descricao: form.descricao || null,
      logo_url: form.logo_url || null,
      banner_url: form.banner_url || null,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      fonte: form.fonte,
      cor_texto: form.cor_texto,
      whatsapp: form.whatsapp,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      pedido_minimo: Number(form.pedido_minimo || 0),
      pix_chave: form.pix_chave || null,
    }).eq('id', lojaId);
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    document.documentElement.style.setProperty('--cor-primaria', form.cor_primaria);
    document.documentElement.style.setProperty('--cor-secundaria', form.cor_secundaria);
    setOk(true); setTimeout(() => setOk(false), 2500);
  };

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  const Campo = ({ label, k, placeholder, textarea }: { label: string; k: keyof FormLoja; placeholder?: string; textarea?: boolean }) => (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      {textarea ? (
        <textarea value={form[k]} onChange={set(k)} placeholder={placeholder} rows={2}
          className="mt-1 w-full rounded-xl border p-2.5 text-sm" />
      ) : (
        <input value={form[k]} onChange={set(k)} placeholder={placeholder}
          className="mt-1 w-full rounded-xl border p-2.5 text-sm" />
      )}
    </label>
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Store size={20} className="text-[var(--cor-primaria)]" />
        <h2 className="text-lg font-bold">Minha Loja</h2>
      </div>

      {/* Preview ao vivo da identidade — reflete cada escolha na hora */}
      <div className="mb-5 overflow-hidden rounded-2xl border shadow-sm" style={{ fontFamily: fonteFamilia(form.fonte) }}>
        <div className="h-28 w-full bg-gray-100" style={{
          backgroundImage: form.banner_url ? `url(${form.banner_url})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div className="flex items-center gap-3 bg-white p-3">
          {form.logo_url
            ? <img src={form.logo_url} alt="" className="h-14 w-14 rounded-full border object-cover" />
            : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: form.cor_primaria }}>
                {form.nome.trim() ? form.nome.trim()[0].toUpperCase() : '?'}
              </div>
            )}
          <div className="min-w-0">
            <p className="truncate font-bold" style={{ color: form.cor_texto }}>{form.nome || 'Nome da loja'}</p>
            <p className="truncate text-xs" style={{ color: form.cor_texto, opacity: 0.65 }}>{form.descricao || 'Descrição da loja'}</p>
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: form.cor_primaria }}>
              Aberto agora
            </span>
          </div>
        </div>
        <div className="flex gap-2 bg-white px-3 pb-3">
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: form.cor_primaria }}>Categoria</span>
          <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: form.cor_secundaria, color: '#fff' }}>Destaque</span>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(['aparencia', 'identidade'] as Aba[]).map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${aba === a ? 'bg-[var(--cor-primaria)] text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
            {a === 'aparencia' ? 'Aparência' : 'Identidade'}
          </button>
        ))}
      </div>

      {aba === 'aparencia' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <ImageUpload lojaId={lojaId} pasta="logo" value={form.logo_url} onChange={(u) => setValor('logo_url', u)} aspecto="aspect-square" label="Logo" />
            <ImageUpload lojaId={lojaId} pasta="banner" value={form.banner_url} onChange={(u) => setValor('banner_url', u)} aspecto="aspect-video" label="Banner" />
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Palette size={15} /> Cores</p>
            <ColorSwatchPicker label="Cor primária (botões e destaques)" value={form.cor_primaria} onChange={(c) => setValor('cor_primaria', c)} />
            <div className="mt-3">
              <ColorSwatchPicker label="Cor secundária" value={form.cor_secundaria} onChange={(c) => setValor('cor_secundaria', c)} />
            </div>
            <div className="mt-3">
              <ColorSwatchPicker label="Cor do texto" value={form.cor_texto} onChange={(c) => setValor('cor_texto', c)} paleta={PALETA_TEXTO} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><TypeIcon size={15} /> Fonte</p>
            <FontPicker value={form.fonte} onChange={(f) => setValor('fonte', f)} />
          </div>
        </div>
      )}

      {aba === 'identidade' && (
        <div className="space-y-3">
          <Campo label="Nome da loja" k="nome" placeholder='"N" de Natureba' />
          <Campo label="Descrição" k="descricao" placeholder="Baguetes artesanais, saladas e doces." textarea />
          <Campo label="WhatsApp (destino dos pedidos)" k="whatsapp" placeholder="5511999999999" />
          <Campo label="Telefone" k="telefone" placeholder="(11) 3333-3333" />
          <Campo label="Endereço" k="endereco" placeholder="Av. Sapopemba, 7750 - Box 2" />
          <Campo label="Pedido mínimo (R$)" k="pedido_minimo" placeholder="15" />
          <Campo label="Chave Pix (estático)" k="pix_chave" placeholder="chave-pix@email.com" />
        </div>
      )}

      {erro && <p className="mt-3 text-sm font-medium text-red-500">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 font-semibold text-white disabled:opacity-40">
        {ok ? <><Check size={18} /> Salvo!</> : <><Save size={18} /> {salvando ? 'Salvando…' : 'Salvar alterações'}</>}
      </button>
    </div>
  );
}
