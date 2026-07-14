import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LojaResumo {
  slug: string;
  nome: string;
  descricao?: string;
  logo_url?: string;
  banner_url?: string;
  endereco?: string;
  cor_primaria: string;
}

export default function Lojas() {
  const [lojas, setLojas] = useState<LojaResumo[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lojas')
        .select('slug, nome, descricao, logo_url, banner_url, endereco, cor_primaria')
        .eq('ativo', true)
        .order('nome');
      setLojas((data as LojaResumo[]) ?? []);
      setCarregando(false);
    })();
  }, []);

  const visiveis = lojas.filter((l) => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-gray-50 p-4 pb-10">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/" className="text-sm text-gray-400">← Início</Link>
      </div>
      <h1 className="text-xl font-bold">Lojas na MiseOn</h1>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Escolha uma loja e peça direto, sem app.</p>

      <div className="mb-4 flex items-center gap-2 rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 px-3 py-2 shadow-sm">
        <Search size={16} className="text-gray-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar loja…"
          className="w-full bg-transparent text-sm outline-none" />
      </div>

      {carregando ? (
        <p className="py-10 text-center text-sm text-gray-400">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {visiveis.map((l) => (
            <Link key={l.slug} to={`/${l.slug}`}
              className="card-hover flex items-center gap-3 overflow-hidden rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 shadow-sm">
              {l.logo_url
                ? <img src={l.logo_url} className="h-16 w-16 shrink-0 rounded-xl object-cover" alt="" />
                : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white" style={{ background: l.cor_primaria }}>
                    {l.nome.trim()[0]?.toUpperCase()}
                  </div>}
              <div className="min-w-0">
                <p className="truncate font-bold">{l.nome}</p>
                {l.descricao && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{l.descricao}</p>}
                {l.endereco && <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400"><MapPin size={11} /> {l.endereco}</p>}
              </div>
            </Link>
          ))}
          {visiveis.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhuma loja encontrada.</p>}
        </div>
      )}

      <Link to="/cadastre-se" className="mt-8 flex items-center justify-center rounded-xl border py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">
        Tem uma loja? Cadastre aqui →
      </Link>
    </div>
  );
}
