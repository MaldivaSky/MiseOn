export function ProgressBar({
  valor,
  max = 100,
  tom = 'var(--cor-primaria)',
  altura = 'h-2',
  className = '',
  animado = true,
}: {
  valor: number;
  max?: number;
  tom?: string;
  altura?: string;
  className?: string;
  animado?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (valor / max) * 100));
  return (
    <div className={`w-full ${altura} rounded-full bg-[var(--cor-destaque)] overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${animado ? 'transition-all duration-700 ease-out' : ''}`}
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tom}, color-mix(in srgb, ${tom} 70%, white))` }}
      />
    </div>
  );
}
