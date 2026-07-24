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

export const SAAS_PRICING = {
  mensal: {
    bruto: 169.90,
    descontoPixPct: 0.05,
    pix: 161.40, // 169.90 com 5% de desconto à vista
  },
  anual: {
    mensalEquivalente: 149.90,
    totalBruto: 1798.80, // 12 x 149.90
    descontoPixPct: 0.05,
    pix: 1708.86, // 1798.80 com 5% de desconto à vista (Economia de R$ 329.94/ano)
    parcelas: [
      { qtd: 3, valorParcela: 599.60, total: 1798.80 },
      { qtd: 6, valorParcela: 299.80, total: 1798.80 },
      { qtd: 8, valorParcela: 224.85, total: 1798.80 },
      { qtd: 12, valorParcela: 149.90, total: 1798.80 },
    ],
  },
  trialDias: 30,
  toleranciaDias: 7,
} as const;

export const EFI_LINKS = {
  site: 'https://sejaefi.com.br',
  tarifas: 'https://sejaefi.com.br/tarifas',
  abrirConta: 'https://sejaefi.com.br/efi-bank/efi-empresas',
} as const;
