// Paleta curada e fontes disponíveis pra personalização da loja (Minha Loja / Aparência).
// Curadas de propósito (em vez de um color-picker livre) pra manter o resultado sempre bonito.

export const PALETA_CORES = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
] as const;

export const PALETA_TEXTO = [
  '#111827', '#1e293b', '#3f2d1c', '#052e16', '#1e1b4b', '#000000',
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
