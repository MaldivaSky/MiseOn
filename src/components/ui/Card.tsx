export function Card({
  children,
  className = '',
  hover = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-[var(--cor-borda)] bg-[var(--cor-card)] p-5 shadow-[0_10px_30px_rgba(15,23,42,.06)] ${
        hover
          ? 'transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,.12)] hover:border-[color-mix(in_srgb,var(--cor-primaria)_30%,var(--cor-borda))]'
          : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
