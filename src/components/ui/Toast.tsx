import { createContext, useContext } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';

type Tom = 'sucesso' | 'erro' | 'info' | 'alerta';

const Ctx = createContext<(msg: string, tom?: Tom) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const empurrar = (msg: string, tom: Tom = 'info') => {
    switch (tom) {
      case 'sucesso':
        sonnerToast.success(msg);
        break;
      case 'erro':
        sonnerToast.error(msg);
        break;
      case 'alerta':
        sonnerToast.warning(msg);
        break;
      case 'info':
      default:
        sonnerToast.info(msg);
        break;
    }
  };

  return (
    <Ctx.Provider value={empurrar}>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton 
        theme="system"
        toastOptions={{
          style: { fontFamily: 'inherit' },
        }}
      />
      {children}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
