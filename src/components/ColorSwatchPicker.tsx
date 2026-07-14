import { Check } from 'lucide-react';
import { PALETA_CORES } from '../lib/personalizacao';

export default function ColorSwatchPicker({ value, onChange, paleta = PALETA_CORES, label }: {
  value: string;
  onChange: (cor: string) => void;
  paleta?: readonly string[];
  label?: string;
}) {
  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {paleta.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-transform ${value === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-900' : 'hover:scale-105'}`}
            style={{ background: c }}
          >
            {value === c && <Check size={14} className="text-white drop-shadow" />}
          </button>
        ))}
      </div>
    </div>
  );
}
