import { useRef, useState } from 'react';
import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';

/**
 * ImageUpload Profissional (Filerobot)
 * Traz filtros, ajustes avançados de cor, crop livre, anotações e rotação.
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
  
  // Estado do Filerobot
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setErro('');
    if (!file.type.startsWith('image/')) return setErro('Escolha um arquivo de imagem válido.');
    if (file.size > 5 * 1024 * 1024) return setErro('A imagem é muito grande (máx. 5MB).');

    // Carregar como Data URL para passar ao editor
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setImgSrc(ev.target.result.toString());
        setIsEditorOpen(true);
      }
    };
    reader.readAsDataURL(file);
    
    // Resetar input
    if (inputRef.current) inputRef.current.value = '';
  };

  const salvarImagemEditada = async (editedImageObject: any) => {
    setIsEditorOpen(false); // Fecha o modal
    setEnviando(true);
    setErro('');
    
    try {
      // O editor retorna um base64. Vamos convertê-lo para Blob/File para upar no Supabase.
      const res = await fetch(editedImageObject.imageBase64);
      const blob = await res.blob();
      
      const fileExt = editedImageObject.extension || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const caminho = `${lojaId}/${pasta}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('loja-assets')
        .upload(caminho, blob, { 
          cacheControl: '3600', 
          upsert: true,
          contentType: editedImageObject.mimeType || 'image/jpeg' 
        });
        
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('loja-assets').getPublicUrl(caminho);
      onChange(data.publicUrl);
    } catch (err: any) {
      setErro('Erro ao salvar imagem editada: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      {label && <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>}
      
      <div className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-gray-50 dark:bg-gray-800 ${value ? 'border-transparent' : 'border-gray-300 dark:border-gray-700'} ${aspecto}`}>
        {value ? (
          <img src={value} className="h-full w-full object-cover" alt="Upload preview" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
            <ImageIcon size={24} className="opacity-50" />
            <span className="text-xs font-medium">Toque para enviar foto</span>
          </div>
        )}
        
        {enviando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-sm">
            <Loader2 size={24} className="animate-spin text-white" />
            <span className="text-xs font-bold text-white">Salvando Nuvem...</span>
          </div>
        )}
        
        {value && !enviando && (
          <button type="button" onClick={() => onChange('')} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-red-500 hover:scale-110 shadow-sm">
            <X size={16} />
          </button>
        )}

        {/* Aciona o upload clicando na área */}
        {!value && !enviando && (
          <button type="button" className="absolute inset-0 w-full h-full cursor-pointer" onClick={() => inputRef.current?.click()} />
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        
      <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 shadow-sm">
        <Upload size={16} />
        {enviando ? 'Enviando...' : value ? 'Trocar e Editar Imagem' : 'Fazer Upload e Editar'}
      </button>
      
      {erro && <p className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-2 text-xs font-semibold text-red-600 dark:text-red-400">{erro}</p>}

      {/* MODAL FILEROBOT (FULLSCREEN) */}
      {isEditorOpen && imgSrc && (
        <div className="fixed inset-0 z-[9999] bg-black">
           <FilerobotImageEditor
            source={imgSrc}
            onSave={(editedImageObject) => salvarImagemEditada(editedImageObject)}
            onClose={() => setIsEditorOpen(false)}
            annotationsCommon={{
              fill: '#FC5B24',
            }}
            Text={{ text: 'MiseOn...' }}
            Rotate={{ angle: 90, componentType: 'slider' }}
            Crop={{
              ratio: aspecto === 'aspect-square' ? 1 : aspecto === 'aspect-video' ? 16/9 : 3,
              autoResize: true,
            }}
            savingPixelRatio={4}
            previewPixelRatio={4}
            tabsIds={[TABS.ADJUST, TABS.ANNOTATE, TABS.WATERMARK]}
            defaultTabId={TABS.ADJUST}
            defaultToolId={TOOLS.CROP}
          />
        </div>
      )}
    </div>
  );
}
