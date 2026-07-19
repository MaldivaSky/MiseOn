export function EmptyState({
  icone,
  titulo,
  descricao,
  acao,
  className = '',
}: {
  icone?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 text-center ${className}`}>
      {icone && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--cor-destaque)] text-[var(--cor-texto-fraco)]">
          {icone}
        </div>
      )}
      <p className="font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">{titulo}</p>
      {descricao && <p className="max-w-xs text-sm text-[var(--cor-texto-suave)]">{descricao}</p>}
      {acao}
    </div>
  );
}
