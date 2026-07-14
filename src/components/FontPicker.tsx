import { FONTES } from '../lib/personalizacao';

export default function FontPicker({ value, onChange }: { value: string; onChange: (nome: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {FONTES.map((f) => (
        <button
          key={f.nome}
          type="button"
          onClick={() => onChange(f.nome)}
          className={`rounded-xl border-2 p-3 text-left shadow-sm transition ${value === f.nome ? 'border-gray-900 bg-gray-50' : 'border-transparent bg-white dark:bg-gray-900 dark:border-gray-800 hover:border-gray-200 dark:border-gray-800'}`}
        >
          <p style={{ fontFamily: f.familia }} className="text-xl font-bold leading-none">Aa</p>
          <p className="mt-1.5 text-xs font-semibold">{f.nome}</p>
          <p className="text-[10px] text-gray-400">{f.estilo}</p>
        </button>
      ))}
    </div>
  );
}
