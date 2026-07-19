import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Confirmação celebratória: check com mola + explosão de confetes em CSS puro.
 * Usar em telas de pagamento confirmado, assinatura ativada, pedido criado.
 */
export function SuccessCelebration({
  titulo,
  subtitulo,
  tom = '#10b981',
  children,
}: {
  titulo: string;
  subtitulo?: string;
  tom?: string;
  children?: React.ReactNode;
}) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="relative flex flex-col items-center gap-4 py-6 text-center overflow-hidden">
      {/* confetes */}
      {pronto && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="mo-confete"
              style={
                {
                  left: '50%',
                  top: '38%',
                  '--cx': `${(Math.random() - 0.5) * 320}px`,
                  '--cy': `${-40 - Math.random() * 220}px`,
                  '--cr': `${(Math.random() - 0.5) * 720}deg`,
                  '--cd': `${0.9 + Math.random() * 0.7}s`,
                  background: ['#FC5B24', '#0A5CC4', '#10b981', '#f59e0b', '#ec4899'][i % 5],
                  animationDelay: `${Math.random() * 0.15}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* anel + check */}
      <div
        className="relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-500"
        style={{
          background: `color-mix(in srgb, ${tom} 14%, transparent)`,
          transform: pronto ? 'scale(1)' : 'scale(0.4)',
          opacity: pronto ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: `color-mix(in srgb, ${tom} 22%, transparent)`, animationIterationCount: 2 }}
        />
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-all delay-150 duration-500"
          style={{
            background: `linear-gradient(135deg, ${tom}, color-mix(in srgb, ${tom} 75%, black))`,
            boxShadow: `0 12px 30px color-mix(in srgb, ${tom} 45%, transparent)`,
            transform: pronto ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-45deg)',
            transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)',
          }}
        >
          <Check size={34} strokeWidth={3.5} />
        </div>
      </div>

      <div
        className="transition-all delay-300 duration-500"
        style={{ opacity: pronto ? 1 : 0, transform: pronto ? 'none' : 'translateY(12px)' }}
      >
        <h3 className="text-xl font-extrabold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">{titulo}</h3>
        {subtitulo && <p className="mt-1 text-sm text-[var(--cor-texto-suave)]">{subtitulo}</p>}
      </div>

      {children && (
        <div
          className="w-full transition-all delay-500 duration-500"
          style={{ opacity: pronto ? 1 : 0, transform: pronto ? 'none' : 'translateY(12px)' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
