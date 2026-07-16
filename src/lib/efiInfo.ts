// ── Efí Bank: taxas e referências usadas nas telas ─────────────────────────
// Fonte única de verdade: usada na aba Pagamentos (admin/Loja), na Central de
// Ajuda (admin/Ajuda) e na landing page (Home). Valores da tabela PÚBLICA da
// Efí — negociáveis por volume e sujeitos a alteração pelo banco.
// Ao atualizar, mude aqui e todas as telas acompanham.

export const EFI_TARIFAS = {
  pix: '1,19%',
  boleto: 'R$ 3,45',
  creditoAVista: '3,49%',
  creditoParcelado2a6: '3,99%',
  creditoParcelado7a12: '4,39%',
  antecipacaoPorParcela: '1,29%',
  referencia: 'julho/2026',
} as const;

export const EFI_LINKS = {
  site: 'https://sejaefi.com.br',
  tarifas: 'https://sejaefi.com.br/tarifas',
  abrirConta: 'https://sejaefi.com.br/efi-bank/efi-empresas',
} as const;
