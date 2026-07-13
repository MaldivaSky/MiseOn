import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Store, Save, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CtxLoja } from './AdminLayout';

/**
 * Minha Loja — identidade white-label editável pelo lojista.
 * Nome, descrição, logo, banner, cores, contato, Pix e pedido mínimo.
 */
interface FormLoja {
  nome: string;
  descricao: string;
  logo_url: string;
  banner_url: string;
  cor_primaria: string;
  cor_secundaria: string;
  whatsapp: string;
  telefone: string;
  endereco: string;
  pedido_minimo: string;
  pix_chave: string;
}

const vazio: FormLoja = {
  nome: '', descricao: '', logo_url: '', banner_url: '',
  cor_primaria: '#16a34a', cor_secundaria: '#f97316',
  whatsapp: '', telefone: '', endereco: '', pedido_minimo: '0', pix_chave: '',
};

export default function Loja() {
  const { lojaId } = useOutletContext<CtxLoja>();
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
          cor_primaria: data.cor_primaria ?? '#16a34a', cor_secundaria: data.cor_secundaria ?? '#f97316',
          whatsapp: data.whatsapp ?? '', telefone: data.telefone ?? '', endereco: data.endereco ?? '',
          pedido_minimo: String(data.pedido_minimo ?? 0), pix_chave: data.pix_chave ?? '',
        });
      }
      setCarregando(false);
    })();
  }, [lojaId]);

  const set = (k: keyof FormLoja) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const salvar = async () => {
    setErro(''); setOk(false); setSalvando(true);
    const { error } = await supabase.from('lojas').update({
      nome: form.nome,
      descricao: form.descricao || null,
      logo_url: form.logo_url || null,
      banner_url: form.banner_url || null,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      whatsapp: form.whatsapp,
      telefone: form.telefone || null,
      endereco: form.endereco || null,
      pedido_minimo: Number(form.pedido_minimo || 0),
      pix_chave: form.pix_chave || null,
    }).eq('id', lojaId);
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
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
        <Store size={20} className="text-blue-800" />
        <h2 className="text-lg font-bold">Minha Loja</h2>
      </div>

      {/* Preview ao vivo da identidade */}
      <div className="mb-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="h-24 w-full bg-gray-100" style={{
          backgroundImage: form.banner_url ? `url(${form.banner_url})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div className="flex items-center gap-3 p-3">
          {form.logo_url
            ? <img src={form.logo_url} alt="" className="h-14 w-14 rounded-full border object-cover" />
            : <div className="h-14 w-14 rounded-full border" style={{ background: form.cor_primaria }} />}
          <div>
            <p className="font-bold">{form.nome || 'Nome da loja'}</p>
            <p className="text-xs text-gray-500">{form.descricao || 'Descrição da loja'}</p>
          </div>
        </div>
        <div className="flex gap-2 px-3 pb-3">
          <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: form.cor_primaria }}>Cor primária</span>
          <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: form.cor_secundaria }}>Secundária</span>
        </div>
      </div>

      <div className="space-y-3">
        <Campo label="Nome da loja" k="nome" placeholder='"N" de Natureba' />
        <Campo label="Descrição" k="descricao" placeholder="Baguetes artesanais, saladas e doces." textarea />
        <Campo label="URL do logo" k="logo_url" placeholder="https://…/logo.png" />
        <Campo label="URL do banner" k="banner_url" placeholder="https://…/banner.jpg" />

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Cor primária</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border p-1.5">
              <input type="color" value={form.cor_primaria} onChange={set('cor_primaria')} className="h-8 w-10 cursor-pointer" />
              <input value={form.cor_primaria} onChange={set('cor_primaria')} className="w-full bg-transparent text-sm outline-none" />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Cor secundária</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border p-1.5">
              <input type="color" value={form.cor_secundaria} onChange={set('cor_secundaria')} className="h-8 w-10 cursor-pointer" />
              <input value={form.cor_secundaria} onChange={set('cor_secundaria')} className="w-full bg-transparent text-sm outline-none" />
            </div>
          </label>
        </div>

        <Campo label="WhatsApp (destino dos pedidos)" k="whatsapp" placeholder="5511999999999" />
        <Campo label="Telefone" k="telefone" placeholder="(11) 3333-3333" />
        <Campo label="Endereço" k="endereco" placeholder="Av. Sapopemba, 7750 - Box 2" />
        <Campo label="Pedido mínimo (R$)" k="pedido_minimo" placeholder="15" />
        <Campo label="Chave Pix (estático)" k="pix_chave" placeholder="chave-pix@email.com" />
      </div>

      {erro && <p className="mt-3 text-sm font-medium text-red-500">{erro}</p>}

      <button onClick={salvar} disabled={salvando}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 py-3.5 font-semibold text-white disabled:opacity-40">
        {ok ? <><Check size={18} /> Salvo!</> : <><Save size={18} /> {salvando ? 'Salvando…' : 'Salvar alterações'}</>}
      </button>
    </div>
  );
}
