// Paleta curada e fontes disponíveis pra personalização da loja (Minha Loja / Aparência).
// Curadas de propósito (em vez de um color-picker livre) pra manter o resultado sempre bonito.

export const PALETA_CORES = [
  '#000000', '#4b5563', '#d1d5db', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
] as const;

export const PALETA_FUNDO = [
  '#ffffff', '#f8fafc', '#fdf6e3', '#f3f4f6', // Claros / Off-white / Bege
  '#fff1f2', '#f0fdf4', '#f0f9ff', '#fefce8', // Pastéis Suaves (Rosa, Menta, Azul, Amarelo)
  '#111827', '#0f172a', '#171717', '#000000', // Escuros / Black
  '#334155', '#450a0a', '#064e3b', '#2e1065', // Tons escuros profundos (Ardósia, Vinho, Floresta, Roxo)
] as const;

export interface FonteOpcao { nome: string; familia: string; estilo: string }

export const FONTES: FonteOpcao[] = [
  { nome: 'Inter', familia: "'Inter', sans-serif", estilo: 'Padrão — limpa e neutra' },
  { nome: 'Poppins', familia: "'Poppins', sans-serif", estilo: 'Geométrica arredondada' },
  { nome: 'Montserrat', familia: "'Montserrat', sans-serif", estilo: 'Moderna e forte' },
  { nome: 'Nunito', familia: "'Nunito', sans-serif", estilo: 'Suave e amigável' },
  { nome: 'Quicksand', familia: "'Quicksand', sans-serif", estilo: 'Descontraída' },
  { nome: 'Playfair Display', familia: "'Playfair Display', serif", estilo: 'Elegante, editorial' },
  { nome: 'Roboto Slab', familia: "'Roboto Slab', serif", estilo: 'Robusta, artesanal' },
  { nome: 'Bebas Neue', familia: "'Bebas Neue', sans-serif", estilo: 'Impacto, letreiro' },
];

export const fonteFamilia = (nome?: string) => FONTES.find((f) => f.nome === nome)?.familia ?? FONTES[0].familia;

// Calcula a luminância da cor e retorna true se for uma cor clara (ex: branco, amarelo claro)
export function isLightColor(hex?: string) {
  if (!hex) return false;
  const c = hex.replace('#', '');
  const rgb = parseInt(c, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >>  8) & 0xff;
  const b = (rgb >>  0) & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 140; // Limiar de claridade
}
