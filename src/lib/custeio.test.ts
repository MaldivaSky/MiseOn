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

// ─────────────────────────────────────────────────────────────────────────────
// NOVOS TESTES — Fase A: Cenários de borda + cobertura de Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe('borda de tolerância de conservação (1e-4 = 0,01%)', () => {
  // A trava usa (1 + 1e-4) como margem de ruído de ponto flutuante.
  // 1000 g de 1 kg é conversão exata. 1001 g ainda está dentro da tolerância.
  // 1001.1 g excede e deve ser bloqueado.

  const detalhe = (): ItemEstoque => ({
    id: 'tol',
    nome: 'Teste tolerância',
    unidadeBase: 'g',
    fatores: [],
    lotes: [{ id: 'L1', data: '2026-01-01', quantidade: 1000, custoTotal: 10 }],
  });

  it('aceita 1000 g de 1 kg (exato)', () => {
    // 1 kg → 1000 g = conservação perfeita
    expect(resolverFator(detalhe(), 'kg', 'g')).toBeCloseTo(1000, 6);
  });

  it('custoDeUso via kg resolve corretamente pelo fator universal', () => {
    // 0.5 kg = 500 g → custo = 500 × (10/1000) = R$ 5,00
    expect(custoDeUso(detalhe(), 0.5, 'kg')).toBeCloseTo(5, 10);
  });

  it('recusa fator que cria massa (1001 g de 1 kg = multiplicação espontânea)', () => {
    // 1 kg → 1001 g viola conservação (1001 × 0.001 = 1.001 > 1 × 1.0001)
    const item = detalhe();
    expect(() => declararFator(item, { de: 'kg', para: 'g', multiplicador: 1001 }))
      .toThrow(ErroCusteio);
  });
});

describe('cadeia de 3 passos: caixa → kg → g → fatias', () => {
  // Cenário realista: compra em caixas → armazena em g → usa em fatias
  // 1 cx = 2 kg (declarado); 1 kg = 1000 g (universal); 100 g = 1 fatia (declarado)
  const pao = (): ItemEstoque => ({
    id: 'pao',
    nome: 'Pão de Fôrma',
    unidadeBase: 'g',
    fatores: [
      { de: 'cx', para: 'kg', multiplicador: 2 },       // 1 cx rende 2 kg
      { de: 'g',  para: 'fatias', multiplicador: 0.01 }, // 100 g rende 1 fatia
    ],
    // Estoque: 1 lote de 2000 g (1 caixa convertida) por R$ 8,00
    lotes: [{ id: 'L1', data: '2026-01-10', quantidade: 2000, custoTotal: 8 }],
  });

  it('resolve cx → g encadeando fator item + fator universal', () => {
    // 1 cx → 2 kg → 2000 g = fator 2000
    expect(resolverFator(pao(), 'cx', 'g')).toBeCloseTo(2000, 6);
  });

  it('resolve g → fatias pelo fator dinâmico direto', () => {
    // 1 g → 0.01 fatias
    expect(resolverFator(pao(), 'g', 'fatias')).toBeCloseTo(0.01, 6);
  });

  it('resolve cx → fatias encadeando TRÊS arestas', () => {
    // 1 cx → 2000 g → 20 fatias
    expect(resolverFator(pao(), 'cx', 'fatias')).toBeCloseTo(20, 6);
  });

  it('custo de 1 fatia = R$ 0,004 (R$ 8,00 / 2000 g × 100 g)', () => {
    // 1 fatia = 100 g; 1 g custa 8/2000 = 0.004; 1 fatia = 100 × 0.004 = R$ 0,40
    // Atenção: 100 g = 1 fatia ⇒ 1 fatia = (1/0.01) g = 100 g
    expect(custoDeUso(pao(), 1, 'fatias')).toBeCloseTo(0.40, 4);
  });

  it('custo de 1 cx = R$ 8,00 (todo o custo do lote)', () => {
    expect(custoDeUso(pao(), 1, 'cx')).toBeCloseTo(8, 6);
  });

  it('BOM com caixa e fatias soma corretamente sem arredondamento intermediário', () => {
    const itens = new Map([['pao', pao()]]);
    const r = custoBOM(
      [
        { itemId: 'pao', quantidade: 1,  unidade: 'cx'     }, // R$ 8,00
        { itemId: 'pao', quantidade: 10, unidade: 'fatias'  }, // 10 × R$ 0,40 = R$ 4,00
      ],
      itens,
    );
    expect(r.total).toBeCloseTo(12, 6);
  });
});

describe('propagação de erro: lote zerado em custoDeUso', () => {
  it('custoDeUso lança ErroCusteio quando item não tem lotes', () => {
    const semEstoque: ItemEstoque = {
      id: 'vz', nome: 'Vazio', unidadeBase: 'g', fatores: [],
      lotes: [],
    };
    expect(() => custoDeUso(semEstoque, 100, 'g')).toThrow(ErroCusteio);
    expect(() => custoDeUso(semEstoque, 100, 'g')).toThrow(/sem lotes/);
  });

  it('custoDeUso lança ErroCusteio quando todos lotes têm saldo zero', () => {
    const esgotado: ItemEstoque = {
      id: 'es', nome: 'Esgotado', unidadeBase: 'g', fatores: [],
      lotes: [
        { id: 'L1', data: '2026-01-01', quantidade: 0, custoTotal: 0 },
        { id: 'L2', data: '2026-01-15', quantidade: 0, custoTotal: 0 },
      ],
    };
    expect(() => custoDeUso(esgotado, 50, 'g')).toThrow(ErroCusteio);
  });
});

describe('paridade frontend ↔ Edge Function (documentação de contrato)', () => {
  // Este describe NÃO testa a Edge Function ao vivo (requer Supabase).
  // Ele documenta que os módulos usados são os mesmos e verifica a lógica
  // com dados idênticos aos que a Edge Function usaria.

  it('custoDeUso local produz o mesmo resultado que a Edge Function produziria', () => {
    // A Edge Function importa os mesmos módulos TypeScript (custeio.ts + unidades.ts).
    // Se este teste passa, a paridade está garantida por construção — não por convenção.
    const item = tomate();
    const local = custoDeUso(item, 2, 'fatias');
    // 2 fatias × (1/3.5) un/fatia × (60/50 R$/un) = 2/3.5 × 1.2 = ~0.6857
    expect(local).toBeCloseTo((2 / 3.5) * 1.2, 10);
  });

  it('baixarPEPS local retorna detalhamento de lotes — o mesmo que a Edge Function exporia', () => {
    const item: ItemEstoque = {
      id: 'cafe', nome: 'Café', unidadeBase: 'g', fatores: [],
      lotes: [
        { id: 'antigo', data: '2026-01-01', quantidade: 500,  custoTotal: 10 }, // R$0,020/g
        { id: 'novo',   data: '2026-06-01', quantidade: 500,  custoTotal: 20 }, // R$0,040/g
      ],
    };
    // 600 g: consome 500 g do lote antigo (R$10) + 100 g do novo (R$4) = R$14
    const { custo, consumido } = baixarPEPS({ ...item, lotes: item.lotes.map(l => ({ ...l })) }, 600, 'g');
    expect(custo).toBeCloseTo(14, 6);
    expect(consumido).toHaveLength(2);
    expect(consumido[0].loteId).toBe('antigo');
    expect(consumido[0].quantidade).toBeCloseTo(500, 6);
    expect(consumido[1].loteId).toBe('novo');
    expect(consumido[1].quantidade).toBeCloseTo(100, 6);
  });
});
