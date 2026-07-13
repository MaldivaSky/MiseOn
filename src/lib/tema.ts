// Tema claro/escuro escolhido pelo usuário — persiste em localStorage,
// cai no prefers-color-scheme do SO na primeira visita.
const CHAVE = 'miseon_tema';

export function aplicarTemaSalvo(): boolean {
  const salvo = localStorage.getItem(CHAVE);
  const escuro = salvo ? salvo === 'escuro' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', escuro);
  return escuro;
}

export function alternarTema(): boolean {
  const escuro = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', escuro);
  localStorage.setItem(CHAVE, escuro ? 'escuro' : 'claro');
  return escuro;
}
