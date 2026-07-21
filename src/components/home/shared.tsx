/**
 * Constantes e utilitários compartilhados entre os módulos da Home.
 */
export const WHATSAPP_VENDAS = '5511919889233';
export const zap = (msg: string) => `https://wa.me/${WHATSAPP_VENDAS}?text=${encodeURIComponent(msg)}`;

/** Rótulo numerado estilo editorial que dá o tom "terno profissional" das seções. */
export function RotuloSecao({ numero, texto }: { numero: string; texto: string }) {
  return (
    <div
      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 18 }}
    >
      {numero} — {texto}
    </div>
  );
}
