import { useRef, useState, useCallback } from 'react';
import { Upload, Loader2, X, Crop as CropIcon, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../lib/cropImage';

/**
 * ImageUpload com Studio de Corte (Crop) Embutido
 * Evita banners tortos e fotos desalinhadas.
 */
export default function ImageUpload({ lojaId, pasta, value, onChange, aspecto = 'aspect-video', label }: {
  lojaId: string;
  pasta: string;
  value?: string | null;
  onChange: (url: string) => void;
  aspecto?: string; // classname tailwind para aspect-ratio do card (visual)
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Estados do arquivo e upload
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  
  // Estados do Cropper Studio
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Calcula o aspecto ratio matemático baseado na classe tailwind (para o Cropper)
  const aspectRatioMath = aspecto.includes('video') ? 16 / 9 : (aspecto.includes('square') ? 1 : 4 / 3);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setErro('');
      if (!file.type.startsWith('image/')) return setErro('Escolha um arquivo de imagem.');
      if (file.size > 5 * 1024 * 1024) return setErro('Imagem muito grande (máx. 5MB).');
      
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result?.toString() || null));
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleUploadCropped = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    
    try {
      setEnviando(true);
      setErro('');
      
      // Gera o arquivo cortado
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      
      const caminho = `${lojaId}/${pasta}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('loja-assets').upload(caminho, croppedImage, { upsert: true, cacheControl: '3600' });
      
      if (error) throw error;
      
      const { data } = supabase.storage.from('loja-assets').getPublicUrl(caminho);
      onChange(data.publicUrl);
      
      // Fecha o studio
      setImageSrc(null);
    } catch (e: any) {
      setErro('Falha no upload: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      {label && <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>}
      
      <div className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-gray-50 dark:bg-gray-800 ${value ? 'border-transparent' : 'border-gray-300 dark:border-gray-700'} ${aspecto}`}>
        {value ? (
          <img src={value} className="h-full w-full object-cover" alt="" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-gray-400">
            <Upload size={20} />
            <span className="text-xs">Nenhuma imagem</span>
          </div>
        )}
        
        {enviando && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Loader2 size={22} className="animate-spin text-white" />
          </div>
        )}
        
        {value && !enviando && (
          <button type="button" onClick={() => onChange('')} className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-red-500">
            <X size={14} />
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={onFileChange} />
        
      <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
        className="mt-2 w-full rounded-lg border py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-40">
        {enviando ? 'Processando…' : value ? 'Trocar Imagem' : 'Fazer Upload Profissional'}
      </button>
      
      {erro && <p className="mt-1 text-xs font-medium text-red-500">{erro}</p>}

      {/* MODAL STUDIO DE CORTE */}
      {imageSrc && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white"><CropIcon size={20}/> Studio de Enquadramento</h3>
            <button onClick={() => setImageSrc(null)} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
              <X size={20} />
            </button>
          </div>
          
          <div className="relative flex-1">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatioMath}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          
          <div className="border-t border-white/10 bg-gray-900 p-6">
            <div className="mx-auto flex max-w-md flex-col gap-4">
              <div>
                <label className="mb-2 text-xs font-bold uppercase text-gray-400">Zoom</label>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <button 
                onClick={handleUploadCropped}
                disabled={enviando}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 font-bold text-white shadow-lg hover:bg-indigo-600 disabled:opacity-50"
              >
                {enviando ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                {enviando ? 'Enviando p/ Nuvem...' : 'Aplicar Corte e Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
