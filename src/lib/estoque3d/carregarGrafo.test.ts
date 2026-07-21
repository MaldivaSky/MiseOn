import { describe, it, expect, vi } from 'vitest';

// A ponte importa o cliente Supabase no topo; para testar as funções puras
// de reconstrução não queremos abrir conexão nenhuma.
vi.mock('../supabase', () => ({ supabase: {} }));

const { reconstruirCadeia, montarCompras } = await import('./carregarGrafo');
const { construirGrafoCusto, auditarConservacao } = await import('./types');

// Formato exato das linhas do banco (ver migração 20260721240000/240200).
const insumos = [
  { id: 'i-tom', nome: 'Tomate', unidade_medida: 'fatias' },
  { id: 'i-ceb', nome: 'Cebola', unidade_medida: 'g' },
];
const fatores = [
  { item_id: null, unidade_origem: 'kg', unidade_destino: 'g', multiplicador: 1000 },
  { item_id: 'i-tom', unidade_origem: 'un', unidade_destino: 'fatias', multiplicador: 5 },
  { item_id: 'i-tom', unidade_origem: 'kg', unidade_destino: 'un', multiplicador: 8 },
];

describe('reconstrução da cadeia a partir dos fatores', () => {
  it('ordena kg → un → fatias mesmo com os fatores fora de ordem', () => {
    const cadeia = reconstruirCadeia(fatores.filter(f => f.item_id === 'i-tom'), 'fatias');
    expect(cadeia.map(p => `${p.de}->${p.para}`)).toEqual(['kg->un', 'un->fatias']);
  });

  it('devolve cadeia vazia quando o insumo não tem fatores', () => {
    expect(reconstruirCadeia([], 'g')).toEqual([]);
  });

  it('não entra em laço infinito se os dados formarem ciclo', () => {
    const ciclo = [
      { item_id: 'x', unidade_origem: 'un', unidade_destino: 'fatias', multiplicador: 2 },
      { item_id: 'x', unidade_origem: 'fatias', unidade_destino: 'un', multiplicador: 2 },
    ];
    expect(() => reconstruirCadeia(ciclo, 'un')).not.toThrow();
  });
});

describe('montagem das compras a partir dos lotes', () => {
  // 120 fatias @ R$0,05 = R$6,00. Cadeia ×8×5 = ×40 ⇒ a compra foi 3 kg.
  const lotes = [
    { id: 'L-tom', insumo_id: 'i-tom', quantidade_inicial: 120, quantidade_restante: 120,
      custo_unitario: 0.05, criado_em: '2026-07-20T10:00:00Z' },
    { id: 'L-ceb', insumo_id: 'i-ceb', quantidade_inicial: 3900, quantidade_restante: 3900,
      custo_unitario: 0.005, criado_em: '2026-07-19T10:00:00Z' },
  ];

  it('deduz a quantidade comprada dividindo pela cadeia (120 fatias = 3 kg)', () => {
    const compras = montarCompras(insumos, lotes, fatores);
    const tomate = compras.find(c => c.id === 'L-tom')!;
    expect(tomate.unidade).toBe('kg');
    expect(tomate.quantidade).toBeCloseTo(3, 9);
    expect(tomate.custoTotal).toBeCloseTo(6, 9);
  });

  it('aninha as transformações na ordem da cadeia', () => {
    const tomate = montarCompras(insumos, lotes, fatores).find(c => c.id === 'L-tom')!;
    const nivel1 = tomate.transformacoes[0];
    expect(nivel1.unidade).toBe('un');
    expect(nivel1.quantidadeProduzida).toBeCloseTo(24, 9); // 3 kg × 8
    const nivel2 = nivel1.filhos![0];
    expect(nivel2.unidade).toBe('fatias');
    expect(nivel2.quantidadeProduzida).toBeCloseTo(120, 9); // 24 un × 5
  });

  it('insumo sem fatores vira compra simples, sem ramificação', () => {
    const cebola = montarCompras(insumos, lotes, fatores).find(c => c.id === 'L-ceb')!;
    expect(cebola.unidade).toBe('g');
    expect(cebola.transformacoes).toEqual([]);
  });

  it('descarta lote sem custo (nada a diluir)', () => {
    const semCusto = [{ ...lotes[0], id: 'L-zero', custo_unitario: 0 }];
    expect(montarCompras(insumos, semCusto, fatores)).toEqual([]);
  });

  it('o grafo resultante passa nas travas e conserva o valor', () => {
    const grafo = construirGrafoCusto(montarCompras(insumos, lotes, fatores));
    expect(auditarConservacao(grafo)).toBeLessThan(1e-9);
    // Custo por fatia = R$6,00 / 120 = R$0,05 — igual ao custo do lote.
    const fatia = grafo.nos.find(n => n.unidade === 'fatias')!;
    expect(fatia.custoUnitario).toBeCloseTo(0.05, 9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NOVOS TESTES — Fase A: Cadeia de 3 elos + ciclos + insumo compra direta
// ─────────────────────────────────────────────────────────────────────────────

describe('reconstruirCadeia — cadeia de 3 elos (cx → kg → g)', () => {
  // Cenário: insumo comprado em caixas → controlado em kg → usado em g
  const fatores3Elos = [
    { item_id: 'i-pao', unidade_origem: 'cx', unidade_destino: 'kg',  multiplicador: 2    },
    { item_id: 'i-pao', unidade_origem: 'kg', unidade_destino: 'g',   multiplicador: 1000 },
  ];

  it('ordena a cadeia de 3 elos na ordem cx → kg → g', () => {
    const cadeia = reconstruirCadeia(fatores3Elos, 'g');
    expect(cadeia.map(p => `${p.de}->${p.para}`)).toEqual(['cx->kg', 'kg->g']);
  });

  it('multiplica os fatores acumulados corretamente (2 × 1000 = 2000)', () => {
    const cadeia = reconstruirCadeia(fatores3Elos, 'g');
    const multTotal = cadeia.reduce((a, p) => a * p.multiplicador, 1);
    expect(multTotal).toBeCloseTo(2000, 6);
  });

  it('monta compra corretamente a partir de um lote na unidade final da cadeia', () => {
    const insumoPao = [{ id: 'i-pao', nome: 'Pão de Fôrma', unidade_medida: 'g' }];
    const lotePao = [{
      id: 'L-pao', insumo_id: 'i-pao',
      quantidade_inicial: 4000, quantidade_restante: 4000,
      custo_unitario: 0.004, criado_em: '2026-07-01T00:00:00Z',
    }];
    // 4000 g = 2 cx (cadeia: 1 cx → 2000 g); custo = 4000 × 0.004 = R$ 16
    const compras = montarCompras(insumoPao, lotePao, fatores3Elos);
    expect(compras).toHaveLength(1);
    const c = compras[0];
    expect(c.unidade).toBe('cx');
    expect(c.quantidade).toBeCloseTo(2, 6);     // 4000 / 2000
    expect(c.custoTotal).toBeCloseTo(16, 6);    // 4000 × 0.004
    expect(c.transformacoes).toHaveLength(1);   // 1 raiz
    expect(c.transformacoes[0].unidade).toBe('kg');
    expect(c.transformacoes[0].filhos?.[0]?.unidade).toBe('g');
  });
});

describe('reconstruirCadeia — ciclo no grafo de fatores', () => {
  // Banco com dados inconsistentes: A→B, B→A (ciclo). Deve retornar []
  // sem travar o processo — o visualizador 3D não pode ficar em loop.
  it('retorna cadeia vazia quando há ciclo e não lança exceção', () => {
    const ciclico = [
      { item_id: 'x', unidade_origem: 'un',     unidade_destino: 'fatias', multiplicador: 4 },
      { item_id: 'x', unidade_origem: 'fatias', unidade_destino: 'un',     multiplicador: 4 },
    ];
    // Todos os nós aparecem como destino; nenhum é "ponto de partida" → retorna []
    expect(reconstruirCadeia(ciclico, 'fatias')).toEqual([]);
  });
});

describe('reconstruirCadeia — insumo sem fatores (compra direta)', () => {
  it('devolve cadeia vazia para insumo sem fatores declarados', () => {
    expect(reconstruirCadeia([], 'ml')).toEqual([]);
  });

  it('montarCompras transforma lote sem fatores em compra simples (sem transformações)', () => {
    const insumoSimples = [{ id: 'i-sal', nome: 'Sal', unidade_medida: 'g' }];
    const loteSal = [{
      id: 'L-sal', insumo_id: 'i-sal',
      quantidade_inicial: 1000, quantidade_restante: 800,
      custo_unitario: 0.002, criado_em: '2026-07-15T00:00:00Z',
    }];
    const compras = montarCompras(insumoSimples, loteSal, []);
    expect(compras).toHaveLength(1);
    expect(compras[0].transformacoes).toEqual([]);
    expect(compras[0].unidade).toBe('g');
    expect(compras[0].quantidade).toBeCloseTo(1000, 6);  // quantidade_inicial
  });
});
