/**
 * Testes do rastreio 3D — montagem pura, sem banco (dados ad-hoc no formato
 * exato das linhas do Supabase; ver migrações 20260721/20260722).
 *
 * Cobre a matemática da subdivisão (conservação de valor por nível), a
 * hierarquia de custo PEPS → médio → cadastro, a máquina de estados e a
 * blindagem de contagens inteiras (regressão do crash de tela azul).
 */

import { describe, it, expect, vi } from 'vitest';

// A camada importa o cliente Supabase no topo; os testes usam só a função pura.
vi.mock('../../supabase', () => ({ supabase: {} }));

const { montarRastreio } = await import('./carregarRastreio');
const { contagemVisual } = await import('./RastreioEngine');

import type {
  LinhaCustoView,
  LinhaFatorRastreio,
  LinhaInsumoRastreio,
} from './carregarRastreio';

// ---------------------------------------------------------------------------
// Fixture base: queijo com cadeia cx→kg ×8 → kg→un ×8 → un→fatias ×5
// 40 fatias em estoque, custo base R$ 0,50/fatia (PEPS).
// Conservação: 0,125 cx × R$ 160 = 1 kg × R$ 20 = 8 un × R$ 2,50 = 40 × 0,50.
// ---------------------------------------------------------------------------

const insumoQueijo: LinhaInsumoRastreio = {
  id: 'i-queijo',
  nome: 'Queijo Mussarela',
  unidade_medida: 'fatias',
  quantidade_atual: 40,
  estoque_minimo: 10,
  preco_embalagem: 160,
  qtd_embalagem: 320,
  categoria_insumo: 'Ingrediente',
  is_preparo: false,
};

const fatoresQueijo: LinhaFatorRastreio[] = [
  { item_id: 'i-queijo', unidade_origem: 'un', unidade_destino: 'fatias', multiplicador: 5 },
  { item_id: 'i-queijo', unidade_origem: 'kg', unidade_destino: 'un', multiplicador: 8 },
  { item_id: 'i-queijo', unidade_origem: 'cx', unidade_destino: 'kg', multiplicador: 8 },
];

const viewQueijo: LinhaCustoView = {
  insumo_id: 'i-queijo',
  saldo_total: 40,
  qtd_lotes_ativos: 2,
  custo_medio_ponderado: 0.48,
  custo_estimado: 0.5,
  desvio_pct: 4.1,
  alerta_desvio: false,
  custo_peps_proximo: 0.5,
};

describe('subdivisão da cadeia (conservação de valor por nível)', () => {
  const [cat] = montarRastreio([insumoQueijo], [viewQueijo], fatoresQueijo);
  const item = cat.itens[0];

  it('converte a quantidade real para cada nível da cadeia', () => {
    expect(item.estagios.map((e) => e.unidade)).toEqual(['cx', 'kg', 'un', 'fatias']);
    expect(item.estagios.map((e) => e.quantidade)).toEqual([0.125, 1, 8, 40]);
  });

  it('deriva o custo por nível mantendo quantidade × custoUnitario constante', () => {
    expect(item.estagios[0].custoUnitario).toBeCloseTo(160, 9); // R$/cx
    expect(item.estagios[1].custoUnitario).toBeCloseTo(20, 9); // R$/kg
    expect(item.estagios[2].custoUnitario).toBeCloseTo(2.5, 9); // R$/un
    expect(item.estagios[3].custoUnitario).toBeCloseTo(0.5, 9); // R$/fatia
    for (const e of item.estagios) {
      expect(e.quantidade * e.custoUnitario!).toBeCloseTo(20, 9);
    }
  });

  it('rotula os estágios Compra → Armazenado → Quebra → Uso', () => {
    expect(item.estagios.map((e) => e.rotulo)).toEqual(['Compra', 'Armazenado', 'Quebra', 'Uso']);
  });

  it('classifica etapas humanas (rendimento declarado) e a compra como fato', () => {
    // cx→kg, kg→un e un→fatias não têm fator universal: são declarações humanas.
    expect(item.estagios.map((e) => e.tipo)).toEqual(['fisica', 'humana', 'humana', 'humana']);
  });

  it('usa o custo PEPS como origem e calcula o total investido', () => {
    expect(item.custoBase).toBeCloseTo(0.5, 9);
    expect(item.origemCusto).toBe('peps');
    expect(item.totalInvestido).toBeCloseTo(20, 9); // saldo 40 × 0,50
    expect(item.estado).toBe('ok');
    expect(item.lotesAtivos).toBe(2);
  });
});

describe('passo dimensional é físico mesmo declarado por item', () => {
  it('kg→g ×1000 classifica como etapa física ✓', () => {
    const insumo: LinhaInsumoRastreio = {
      ...insumoQueijo,
      id: 'i-farinha',
      nome: 'Farinha',
      unidade_medida: 'g',
      quantidade_atual: 2000,
    };
    const fatores: LinhaFatorRastreio[] = [
      { item_id: 'i-farinha', unidade_origem: 'kg', unidade_destino: 'g', multiplicador: 1000 },
    ];
    const [cat] = montarRastreio([insumo], [], fatores);
    expect(cat.itens[0].estagios.map((e) => e.unidade)).toEqual(['kg', 'g']);
    expect(cat.itens[0].estagios[1].tipo).toBe('fisica');
  });
});

describe('itens sem cadeia e hierarquia de custo', () => {
  const insumoSimples: LinhaInsumoRastreio = {
    id: 'i-refri',
    nome: 'Refrigerante Lata',
    unidade_medida: 'un',
    quantidade_atual: 24,
    estoque_minimo: 6,
    preco_embalagem: 72,
    qtd_embalagem: 24,
    categoria_insumo: 'Revenda Direta',
    is_preparo: false,
  };

  it('sem fatores: exatamente 1 estágio na unidade base', () => {
    const [cat] = montarRastreio([insumoSimples], [], []);
    const item = cat.itens[0];
    expect(item.estagios).toHaveLength(1);
    expect(item.estagios[0].unidade).toBe('un');
    expect(item.estagios[0].quantidade).toBe(24);
    expect(item.estagios[0].rotulo).toBe('Compra');
  });

  it('sem lotes e sem preco_embalagem ⇒ sem_custo (mesmo com estoque)', () => {
    const semPreco = { ...insumoSimples, preco_embalagem: null, qtd_embalagem: null };
    const [cat] = montarRastreio([semPreco], [], []);
    const item = cat.itens[0];
    expect(item.custoBase).toBeNull();
    expect(item.totalInvestido).toBeNull();
    expect(item.estado).toBe('sem_custo');
    expect(item.estagios[0].custoUnitario).toBeNull();
  });

  it('cai para o médio ponderado quando não há PEPS, e para o cadastro sem lotes', () => {
    const soMedio: LinhaCustoView = { ...viewQueijo, insumo_id: 'i-refri', custo_peps_proximo: null, custo_medio_ponderado: 3.1, custo_estimado: 3 };
    let [cat] = montarRastreio([insumoSimples], [soMedio], []);
    expect(cat.itens[0].origemCusto).toBe('medio');
    expect(cat.itens[0].custoBase).toBeCloseTo(3.1, 9);

    const soCadastro: LinhaCustoView = { ...soMedio, custo_medio_ponderado: null };
    [cat] = montarRastreio([insumoSimples], [soCadastro], []);
    expect(cat.itens[0].origemCusto).toBe('cadastro');
    expect(cat.itens[0].custoBase).toBeCloseTo(3, 9); // 72/24
  });
});

describe('máquina de estados (prioridade)', () => {
  const base = { ...insumoQueijo };
  const view = { ...viewQueijo };

  it('quantidade zerada ⇒ sem_estoque (ganha de crítico e de sem_custo)', () => {
    const [cat] = montarRastreio([{ ...base, quantidade_atual: 0, preco_embalagem: null, qtd_embalagem: null }], [{ ...view, saldo_total: 0 }], fatoresQueijo);
    expect(cat.itens[0].estado).toBe('sem_estoque');
  });

  it('no mínimo ⇒ critico', () => {
    const [cat] = montarRastreio([{ ...base, quantidade_atual: 10 }], [{ ...view, saldo_total: 10 }], fatoresQueijo);
    expect(cat.itens[0].estado).toBe('critico');
  });

  it('desvio ≥ 15% na view ⇒ alerta_desvio (com estoque saudável)', () => {
    const [cat] = montarRastreio([base], [{ ...view, alerta_desvio: true, desvio_pct: 18.4 }], fatoresQueijo);
    const item = cat.itens[0];
    expect(item.estado).toBe('alerta_desvio');
    expect(item.desvioPct).toBeCloseTo(18.4, 9);
  });

  it('crítico ganha de alerta_desvio; sem_custo esconde ambos', () => {
    let [cat] = montarRastreio(
      [{ ...base, quantidade_atual: 5 }],
      [{ ...view, saldo_total: 5, alerta_desvio: true }],
      fatoresQueijo,
    );
    expect(cat.itens[0].estado).toBe('critico');

    [cat] = montarRastreio(
      [{ ...base, quantidade_atual: 5, preco_embalagem: null, qtd_embalagem: null }],
      [{ ...view, saldo_total: 5, alerta_desvio: true, custo_peps_proximo: null, custo_medio_ponderado: null, custo_estimado: null }],
      fatoresQueijo,
    );
    expect(cat.itens[0].estado).toBe('sem_custo');
  });
});

describe('agrupamento e ordenação', () => {
  it('categorias por totalInvestido desc; itens idem; alertas = críticos + desvios', () => {
    const barato: LinhaInsumoRastreio = { ...insumoQueijo, id: 'i-barato', nome: 'Barato', categoria_insumo: 'Limpeza' };
    const critico: LinhaInsumoRastreio = { ...insumoQueijo, id: 'i-crit', nome: 'Crítico', quantidade_atual: 5 };
    const views: LinhaCustoView[] = [
      viewQueijo,
      { ...viewQueijo, insumo_id: 'i-barato', saldo_total: 1 },
      { ...viewQueijo, insumo_id: 'i-crit', saldo_total: 5 },
    ];
    const fatores: LinhaFatorRastreio[] = [
      ...fatoresQueijo,
      ...fatoresQueijo.map((f) => ({ ...f, item_id: 'i-barato' })),
      ...fatoresQueijo.map((f) => ({ ...f, item_id: 'i-crit' })),
    ];
    const cats = montarRastreio([barato, insumoQueijo, critico], views, fatores);

    expect(cats.map((c) => c.nome)).toEqual(['Ingrediente', 'Limpeza']);
    const ingrediente = cats[0];
    expect(ingrediente.itens.map((i) => i.insumoId)).toEqual(['i-queijo', 'i-crit']);
    expect(ingrediente.alertas).toBe(1); // o crítico
    expect(ingrediente.totalInvestido).toBeCloseTo(20 + 2.5, 9);
  });
});

describe('blindagem de contagens (regressão do crash fracionário)', () => {
  it('quantidades fracionárias produzem estágios fracionários sem quebrar', () => {
    const [cat] = montarRastreio(
      [{ ...insumoQueijo, quantidade_atual: 7.33 }],
      [{ ...viewQueijo, saldo_total: 7.33 }],
      fatoresQueijo,
    );
    const item = cat.itens[0];
    expect(item.estagios[3].quantidade).toBeCloseTo(7.33, 9);
    expect(item.estagios[2].quantidade).toBeCloseTo(7.33 / 5, 9);
    expect(item.estagios.every((e) => Number.isFinite(e.quantidade))).toBe(true);
  });

  it('contagemVisual sempre devolve inteiro ≥ 1, finito, com cap', () => {
    expect(contagemVisual(2.5)).toEqual({ n: 3, excedente: 0 });
    expect(contagemVisual(0.2)).toEqual({ n: 1, excedente: 0 });
    expect(contagemVisual(0)).toEqual({ n: 1, excedente: 0 });
    expect(contagemVisual(45)).toEqual({ n: 12, excedente: 33 });
    expect(contagemVisual(Number.NaN)).toEqual({ n: 1, excedente: 0 });
    expect(contagemVisual(Infinity)).toEqual({ n: 1, excedente: 0 });
    expect(Number.isInteger(contagemVisual(7.33).n)).toBe(true);
  });
});
