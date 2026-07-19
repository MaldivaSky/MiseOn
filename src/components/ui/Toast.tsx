import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type Tom = 'sucesso' | 'erro' | 'info' | 'alerta';
type ToastItem = { id: number; msg: string; tom: Tom };

const Ctx = createContext<(msg: string, tom?: Tom) => void>(() => {});

const icones: Record<Tom, React.ReactNode> = {
  sucesso: <CheckCircle2 size={18} className="text-emerald-400" />,
  erro: <XCircle size={18} className="text-red-400" />,
  info: <Info size={18} className="text-sky-400" />,
  alerta: <TriangleAlert size={18} className="text-amber-400" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const empurrar = useCallback((msg: string, tom: Tom = 'info') => {
    const id = ++seq.current;
    setItens((l) => [...l, { id, msg, tom }]);
    setTimeout(() => setItens((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);

  const valor = useMemo(() => empurrar, [empurrar]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {itens.map((t) => (
          <div
            key={t.id}
            className="sheet pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-[#0B1120]/95 px-4 py-3 text-sm font-medium text-[#EAF1FB] shadow-2xl backdrop-blur"
          >
            {icones[t.tom]}
            <span className="flex-1">{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
