import { describe, it, expect } from 'vitest';
import {
  custoDeUso, custoUnitarioBase, custoBOM, baixarPEPS, resolverFator,
  declararFator, ErroCusteio, type ItemEstoque,
} from './custeio';

// ─── Exemplo 1: Detergente (volume, fator universal) ────────────────────────
// Compra 5 L por R$ 30 → base ml → 5000 ml → R$ 0,006/ml.
const detergente = (): ItemEstoque => ({
  id: 'det', nome: 'Detergente', unidadeBase: 'ml', fatores: [],
  lotes: [{ id: 'L1', data: '2026-07-01', quantidade: 5000, custoTotal: 30 }],
});

// ─── Exemplo 2: Tomate (massa → unidade → fração, fatores dinâmicos) ───────
// 10 kg por R$ 60 renderam 50 un ⇒ base 'un', 50 un por R$ 60 = R$ 1,20/un.
// 2 un renderam 7 fatias ⇒ 1 un = 3,5 fatias.
const tomate = (): ItemEstoque => ({
  id: 'tom', nome: 'Tomate', unidadeBase: 'un',
  fatores: [
    { de: 'kg', para: 'un', multiplicador: 5 },     // 10 kg → 50 un
    { de: 'un', para: 'fatias', multiplicador: 3.5 }, // 2 un → 7 fatias
  ],
  lotes: [{ id: 'L1', data: '2026-07-02', quantidade: 50, custoTotal: 60 }],
});

// ─── Exemplo 3: Alface (pé rende porções) ──────────────────────────────────
const alface = (): ItemEstoque => ({
  id: 'alf', nome: 'Alface', unidadeBase: 'un',
  fatores: [{ de: 'un', para: 'porção', multiplicador: 7 }],
  lotes: [{ id: 'L1', data: '2026-07-03', quantidade: 1, custoTotal: 5 }],
});

describe('Exemplo 1 — Detergente (normalização por fator universal)', () => {
  it('custo atômico = R$ 0,006 por ml', () => {
    expect(custoUnitarioBase(detergente())).toBeCloseTo(0.006, 10);
  });

  it('frasco de 200 ml custa R$ 1,20', () => {
    expect(custoDeUso(detergente(), 200, 'ml')).toBeCloseTo(1.2, 10);
  });

  it('cobra 1 L usando o fator universal, sem declaração humana', () => {
    expect(custoDeUso(detergente(), 1, 'L')).toBeCloseTo(6, 10);
  });
});

describe('Exemplo 2 — Tomate (cadeia dinâmica kg → un → fatias)', () => {
  it('custo por unidade = R$ 1,20', () => {
    expect(custoUnitarioBase(tomate())).toBeCloseTo(1.2, 10);
  });

  it('2 unidades custam R$ 2,40', () => {
    expect(custoDeUso(tomate(), 2, 'un')).toBeCloseTo(2.4, 10);
  });

  it('a fatia custa R$ 0,342857 (2,40 / 7)', () => {
    expect(custoDeUso(tomate(), 1, 'fatias')).toBeCloseTo(2.4 / 7, 10);
  });

  it('resolve kg → fatias encadeando duas arestas (5 × 3,5 = 17,5)', () => {
    expect(resolverFator(tomate(), 'kg', 'fatias')).toBeCloseTo(17.5, 10);
  });

  it('1 kg custa R$ 6,00 mesmo com o estoque controlado em unidades', () => {
    expect(custoDeUso(tomate(), 1, 'kg')).toBeCloseTo(6, 10);
  });
});

describe('Exemplo 3 — Alface e a composição final (BOM)', () => {
  it('a porção de alface custa R$ 0,714', () => {
    expect(custoDeUso(alface(), 1, 'porção')).toBeCloseTo(5 / 7, 4);
  });

  // ATENÇÃO — o custo exato é R$ 1,40, não R$ 1,3996.
  //   5/7 + 2×(2,40/7) = (5 + 4,8)/7 = 9,8/7 = 1,4  (exato)
  // O valor 1,3996 aparece quando se arredonda os custos unitários ANTES de
  // multiplicar (0,714 + 2×0,3428). São 0,4 centavo perdido por salada — em
  // 1.000 saladas/mês, R$ 4,00 de CMV que somem da contabilidade.
  // Por isso o motor só arredonda na apresentação, nunca no cálculo.
  it('a salada (1 porção alface + 2 fatias tomate) custa exatamente R$ 1,40', () => {
    const itens = new Map([['alf', alface()], ['tom', tomate()]]);
    const r = custoBOM(
      [
        { itemId: 'alf', quantidade: 1, unidade: 'porção' },
        { itemId: 'tom', quantidade: 2, unidade: 'fatias' },
      ],
      itens,
    );
    expect(r.total).toBeCloseTo(1.4, 10);
    expect(r.linhas.map((l) => l.nome)).toEqual(['Alface', 'Tomate']);
  });

  it('demonstra o vazamento: arredondar antes de somar desvia o CMV', () => {
    // Exatamente os valores como aparecem no spec: 0,714 e 0,3428.
    const comoNoSpec = 0.714 + 2 * 0.3428;
    expect(comoNoSpec).toBeCloseTo(1.3996, 10);
    expect(Math.abs(1.4 - comoNoSpec)).toBeGreaterThan(0.0003); // 0,04 centavo/salada

    // O desvio muda de sinal conforme as casas — ou seja, não é um "erro
    // conservador": às vezes subfatura o CMV, às vezes superfatura.
    const a4casas = Number((5 / 7).toFixed(4)) + 2 * Number((2.4 / 7).toFixed(4));
    expect(a4casas).toBeGreaterThan(1.4);
    expect(comoNoSpec).toBeLessThan(1.4);
  });
});

describe('PEPS vs Custo Médio', () => {
  // Dois lotes do mesmo insumo a preços diferentes.
  const doisLotes = (): ItemEstoque => ({
    id: 'x', nome: 'Café', unidadeBase: 'g', fatores: [],
    lotes: [
      { id: 'antigo', data: '2026-01-01', quantidade: 1000, custoTotal: 20 }, // R$0,020/g
      { id: 'novo', data: '2026-06-01', quantidade: 1000, custoTotal: 40 },   // R$0,040/g
    ],
  });

  it('PEPS usa o lote mais antigo (R$ 0,020/g)', () => {
    expect(custoUnitarioBase(doisLotes(), 'PEPS')).toBeCloseTo(0.02, 10);
  });

  it('MEDIO pondera os dois lotes (R$ 0,030/g)', () => {
    expect(custoUnitarioBase(doisLotes(), 'MEDIO')).toBeCloseTo(0.03, 10);
  });

  it('baixa que cruza lotes soma os custos reais de cada um', () => {
    const item = doisLotes();
    // 1500 g = 1000 g a R$0,020 (R$20) + 500 g a R$0,040 (R$20) = R$40
    const { custo, consumido } = baixarPEPS(item, 1500, 'g');
    expect(custo).toBeCloseTo(40, 10);
    expect(consumido).toHaveLength(2);
    expect(item.lotes.find((l) => l.id === 'antigo')!.quantidade).toBe(0);
    expect(item.lotes.find((l) => l.id === 'novo')!.quantidade).toBe(500);
  });

  it('recusa baixa maior que o saldo', () => {
    expect(() => baixarPEPS(doisLotes(), 3000, 'g')).toThrow(ErroCusteio);
  });
});

describe('blindagens do grafo de conversão', () => {
  it('recusa fator que multiplica massa (1 kg → 10 kg)', () => {
    const item = detergente();
    expect(() => declararFator(item, { de: 'kg', para: 'kg', multiplicador: 10 }))
      .toThrow(ErroCusteio);
  });

  it('aceita fator dinâmico legítimo (1 kg de tomate → 5 un)', () => {
    const item: ItemEstoque = { ...tomate(), fatores: [] };
    expect(() => declararFator(item, { de: 'kg', para: 'un', multiplicador: 5 })).not.toThrow();
  });

  it('falha com mensagem acionável quando não há caminho', () => {
    expect(() => custoDeUso(detergente(), 1, 'fatias')).toThrow(/não há caminho/);
  });

  it('recusa custo sem lote em estoque', () => {
    const vazio: ItemEstoque = { ...detergente(), lotes: [] };
    expect(() => custoUnitarioBase(vazio)).toThrow(ErroCusteio);
  });
});
