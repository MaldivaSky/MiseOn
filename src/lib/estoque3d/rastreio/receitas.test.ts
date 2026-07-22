/**
 * Testes da checagem de receitas — núcleo puro, sem banco.
 *
 * Semântica conferida no schema: fichas_tecnicas.quantidade_consumida é POR
 * UNIDADE VENDIDA (na base do insumo); fichas_preparos.quantidade é POR LOTE
 * de produção (o lote rende insumos.rendimento_porcoes porções). Preparos na
 * ficha de um produto expandem 1 nível ("via Molho") — o que falta é sempre
 * o insumo atômico.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../supabase', () => ({ supabase: {} }));

const { verificarReceita } = await import('./receitas');

import type {
  InsumoMinimo,
  LinhaFichaPreparo,
  LinhaFichaTecnica,
  ReceitaResumo,
} from './receitas';

// ---------------------------------------------------------------------------
// Despensa fictícia
// ---------------------------------------------------------------------------

const INSUMOS: InsumoMinimo[] = [
  { id: 'i-pao', nome: 'Pão Brioche', unidade_medida: 'un', quantidade_atual: 10, is_preparo: false, rendimento_porcoes: null },
  { id: 'i-queijo', nome: 'Queijo Mussarela', unidade_medida: 'fatias', quantidade_atual: 7, is_preparo: false, rendimento_porcoes: null },
  { id: 'i-tomate', nome: 'Tomate', unidade_medida: 'kg', quantidade_atual: 0.005, is_preparo: false, rendimento_porcoes: null },
  { id: 'i-cebola', nome: 'Cebola', unidade_medida: 'kg', quantidade_atual: 2, is_preparo: false, rendimento_porcoes: null },
  { id: 'i-molho', nome: 'Molho da Casa', unidade_medida: 'kg', quantidade_atual: 1, is_preparo: true, rendimento_porcoes: 10 },
];

const FICHAS_TECNICAS: LinhaFichaTecnica[] = [
  // X-Burger: 1 pão + 2 fatias de queijo por unidade vendida.
  { produto_id: 'p-xburger', insumo_id: 'i-pao', quantidade_consumida: 1 },
  { produto_id: 'p-xburger', insumo_id: 'i-queijo', quantidade_consumida: 2 },
  // X-Especial: pão + 50 g de molho por unidade vendida.
  { produto_id: 'p-xesp', insumo_id: 'i-pao', quantidade_consumida: 1 },
  { produto_id: 'p-xesp', insumo_id: 'i-molho', quantidade_consumida: 0.05 },
];

const FICHAS_PREPAROS: LinhaFichaPreparo[] = [
  // Lote do Molho da Casa: 2 kg de tomate + 0,5 kg de cebola (rende 10 porções).
  { preparo_id: 'i-molho', insumo_id: 'i-tomate', quantidade: 2 },
  { preparo_id: 'i-molho', insumo_id: 'i-cebola', quantidade: 0.5 },
];

describe('produto com insumos diretos', () => {
  const receita: ReceitaResumo = { id: 'p-xburger', nome: 'X-Burger', tipo: 'produto' };
  const check = verificarReceita(receita, FICHAS_TECNICAS, FICHAS_PREPAROS, INSUMOS);

  it('calcula porções por ingrediente e o gargalo real', () => {
    const pao = check.ingredientes.find((i) => i.insumoId === 'i-pao')!;
    const queijo = check.ingredientes.find((i) => i.insumoId === 'i-queijo')!;
    expect(pao.maxPorcoes).toBe(10); // 10 un / 1
    expect(queijo.maxPorcoes).toBe(3); // floor(7 / 2)
    expect(check.maxPorcoes).toBe(3);
    expect(check.gargalo).toBe('Queijo Mussarela');
  });

  it('ordena ingredientes do mais limitante ao mais folgado', () => {
    expect(check.ingredientes.map((i) => i.insumoId)).toEqual(['i-queijo', 'i-pao']);
  });

  it('completa = todos cobrem ao menos 1 porção', () => {
    expect(check.completa).toBe(true);
    expect(check.ingredientes.every((i) => i.cobre)).toBe(true);
    expect(check.ingredientes.every((i) => i.viaPreparo === null)).toBe(true);
  });
});

describe('produto com preparo na ficha (expansão "via Molho")', () => {
  const receita: ReceitaResumo = { id: 'p-xesp', nome: 'X-Especial', tipo: 'produto' };
  const check = verificarReceita(receita, FICHAS_TECNICAS, FICHAS_PREPAROS, INSUMOS);

  it('expande o preparo nos insumos atômicos, com a origem visível', () => {
    const tomate = check.ingredientes.find((i) => i.insumoId === 'i-tomate')!;
    const cebola = check.ingredientes.find((i) => i.insumoId === 'i-cebola')!;
    // 0,05 kg de molho/unidade × (2 kg tomate / 10 porções) = 0,01 kg tomate/un.
    expect(tomate.necessario).toBeCloseTo(0.01, 9);
    expect(cebola.necessario).toBeCloseTo(0.0025, 9);
    expect(tomate.viaPreparo).toBe('Molho da Casa');
    expect(cebola.viaPreparo).toBe('Molho da Casa');
    // O preparo em si NÃO aparece como ingrediente — o que falta é o insumo real.
    expect(check.ingredientes.some((i) => i.insumoId === 'i-molho')).toBe(false);
  });

  it('o ingrediente que falta vira o gargalo e incompleta a receita', () => {
    // 0,005 kg de tomate ÷ 0,01 kg/un = 0 porções.
    expect(check.completa).toBe(false);
    expect(check.maxPorcoes).toBe(0);
    expect(check.gargalo).toBe('Tomate');
    const tomate = check.ingredientes.find((i) => i.insumoId === 'i-tomate')!;
    expect(tomate.cobre).toBe(false);
    expect(tomate.maxPorcoes).toBe(0);
  });
});

describe('receita do tipo preparo (fazer o lote)', () => {
  const receita: ReceitaResumo = { id: 'i-molho', nome: 'Molho da Casa', tipo: 'preparo' };
  const check = verificarReceita(receita, FICHAS_TECNICAS, FICHAS_PREPAROS, INSUMOS);

  it('necessário por PORÇÃO = quantidade do lote ÷ rendimento', () => {
    const tomate = check.ingredientes.find((i) => i.insumoId === 'i-tomate')!;
    const cebola = check.ingredientes.find((i) => i.insumoId === 'i-cebola')!;
    expect(tomate.necessario).toBeCloseTo(0.2, 9); // 2 kg / 10 porções
    expect(cebola.necessario).toBeCloseTo(0.05, 9); // 0,5 kg / 10
    expect(check.tipo).toBe('preparo');
  });

  it('cebola sobra: 2 kg ÷ 0,05 = 40 porções possíveis', () => {
    const cebola = check.ingredientes.find((i) => i.insumoId === 'i-cebola')!;
    expect(cebola.maxPorcoes).toBe(40);
    expect(check.gargalo).toBe('Tomate');
  });
});

describe('casos de borda', () => {
  it('receita sem ficha: incompleta, 0 porções, sem gargalo', () => {
    const receita: ReceitaResumo = { id: 'p-vazio', nome: 'Fantasma', tipo: 'produto' };
    const check = verificarReceita(receita, FICHAS_TECNICAS, FICHAS_PREPAROS, INSUMOS);
    expect(check.ingredientes).toHaveLength(0);
    expect(check.completa).toBe(false);
    expect(check.maxPorcoes).toBe(0);
    expect(check.gargalo).toBeNull();
  });

  it('insumo removido do cadastro aparece nomeado e sem estoque', () => {
    const fts: LinhaFichaTecnica[] = [{ produto_id: 'p-x', insumo_id: 'i-sumiu', quantidade_consumida: 1 }];
    const check = verificarReceita({ id: 'p-x', nome: 'X', tipo: 'produto' }, fts, [], INSUMOS);
    expect(check.ingredientes[0].nome).toBe('Insumo removido');
    expect(check.ingredientes[0].disponivel).toBe(0);
    expect(check.ingredientes[0].cobre).toBe(false);
    expect(check.completa).toBe(false);
  });

  it('insumo direto somado com ele mesmo via preparo acumula a necessidade', () => {
    // Produto usa tomate direto E via molho: as duas necessidades somam.
    const fts: LinhaFichaTecnica[] = [
      { produto_id: 'p-mix', insumo_id: 'i-tomate', quantidade_consumida: 0.01 },
      { produto_id: 'p-mix', insumo_id: 'i-molho', quantidade_consumida: 0.05 },
    ];
    const check = verificarReceita({ id: 'p-mix', nome: 'Mix', tipo: 'produto' }, fts, FICHAS_PREPAROS, INSUMOS);
    const tomate = check.ingredientes.find((i) => i.insumoId === 'i-tomate')!;
    expect(tomate.necessario).toBeCloseTo(0.01 + 0.01, 9); // direto + via molho
  });
});
