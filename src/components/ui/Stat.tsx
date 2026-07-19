import { TrendingDown, TrendingUp } from 'lucide-react';

export function Stat({
  rotulo,
  valor,
  icone,
  variacao,
  className = '',
}: {
  rotulo: string;
  valor: string | number;
  icone?: React.ReactNode;
  /** variação percentual; positivo = verde com seta pra cima */
  variacao?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[var(--cor-borda)] bg-[var(--cor-card)] p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--cor-texto-fraco)]">{rotulo}</span>
        {icone && <span className="text-[var(--cor-primaria)]">{icone}</span>}
      </div>
      <div className="mt-1.5 flex items-end gap-2">
        <span className="text-2xl font-extrabold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">{valor}</span>
        {variacao !== undefined && (
          <span
            className={`mb-0.5 inline-flex items-center gap-0.5 text-xs font-bold ${
              variacao >= 0 ? 'text-emerald-500' : 'text-red-500'
            }`}
          >
            {variacao >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(variacao).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}
