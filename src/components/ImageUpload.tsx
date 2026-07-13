import { useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Upload real de imagem pro Supabase Storage (bucket "loja-assets", público,
 * gravável só pelo admin da própria loja — ver supabase/schema_v3.sql).
 * Substitui os antigos campos de "URL da imagem" por um envio de arquivo de verdade.
 */
export default function ImageUpload({ lojaId, pasta, value, onChange, aspecto = 'aspect-video', label }: {
  lojaId: string;
  pasta: string;
  value?: string | null;
  onChange: (url: string) => void;
  aspecto?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async (file: File) => {
    setErro('');
    if (!file.type.startsWith('image/')) return setErro('Escolha um arquivo de imagem.');
    if (file.size > 5 * 1024 * 1024) return setErro('Imagem muito grande (máx. 5MB).');
    setEnviando(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const caminho = `${lojaId}/${pasta}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('loja-assets').upload(caminho, file, { upsert: true, cacheControl: '3600' });
    setEnviando(false);
    if (error) return setErro('Falha no upload: ' + error.message);
    const { data } = supabase.storage.from('loja-assets').getPublicUrl(caminho);
    onChange(data.publicUrl);
  };

  return (
    <div>
      {label && <p className="mb-1 text-xs font-semibold text-gray-500">{label}</p>}
      <div className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-gray-50 ${value ? 'border-transparent' : 'border-gray-300'} ${aspecto}`}>
        {value ? (
          <img src={value} className="h-full w-full object-cover" alt="" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
            <Upload size={20} />
            <span className="text-xs">Nenhuma imagem</span>
          </div>
        )}
        {enviando && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 size={22} className="animate-spin text-white" />
          </div>
        )}
        {value && !enviando && (
          <button type="button" onClick={() => onChange('')} className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white">
            <X size={14} />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); e.target.value = ''; }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
        className="mt-2 w-full rounded-lg border py-2 text-xs font-medium text-gray-600 disabled:opacity-40">
        {enviando ? 'Enviando…' : value ? 'Trocar imagem' : 'Enviar imagem'}
      </button>
      {erro && <p className="mt-1 text-xs font-medium text-red-500">{erro}</p>}
    </div>
  );
}
