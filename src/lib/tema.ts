// Tema claro/escuro escolhido pelo usuário — persiste em localStorage,
// com fallback para um tema padrão do contexto público ou para o SO.
const CHAVE = 'miseon_tema';
export type PreferenciaTema = 'claro' | 'escuro';

function despacharTema(tema: PreferenciaTema) {
  window.dispatchEvent(new CustomEvent('miseon:tema', { detail: { tema } }));
}

export function obterTemaPreferido(temaPadrao?: PreferenciaTema): PreferenciaTema {
  const salvo = localStorage.getItem(CHAVE);
  if (salvo === 'claro' || salvo === 'escuro') return salvo;
  if (temaPadrao) return temaPadrao;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

export function aplicarTema(tema: PreferenciaTema): boolean {
  const escuro = tema === 'escuro';
  document.documentElement.classList.toggle('dark', escuro);
  return escuro;
}

export function aplicarTemaSalvo(temaPadrao?: PreferenciaTema): boolean {
  return aplicarTema(obterTemaPreferido(temaPadrao));
}

export function definirTema(tema: PreferenciaTema): boolean {
  localStorage.setItem(CHAVE, tema);
  const escuro = aplicarTema(tema);
  despacharTema(tema);
  return escuro;
}

export function alternarTema(): boolean {
  const atual = obterTemaPreferido();
  return definirTema(atual === 'escuro' ? 'claro' : 'escuro');
}
