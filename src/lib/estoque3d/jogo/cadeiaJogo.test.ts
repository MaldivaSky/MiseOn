import { describe, it, expect } from 'vitest';

import { extrairCadeias, CAP_ITENS } from './cadeiaJogo';
import { construirGrafoCusto, type CompraInput } from '../types';
import { COMPRAS_EXEMPLO } from '../dadosExemplo';

describe('extrairCadeias — dataset clássico (tomate #452 + cebola #453)', () => {
  const grafo = construirGrafoCusto(COMPRAS_EXEMPLO);
  const cadeias = extrairCadeias(grafo);

  it('retorna 2 cadeias, ordenadas por custo: Tomate #452 primeiro', () => {
    expect(cadeias).toHaveLength(2);
    expect(cadeias[0].raiz.id).toBe('452');
    expect(cadeias[0].raiz.rotulo).toContain('Tomate');
    expect(cadeias[1].raiz.id).toBe('453');
  });

  it('cadeia #452 tem 3 estágios com quantidades [10, 50, 7]', () => {
    const tomate = cadeias[0];
    expect(tomate.estagios).toHaveLength(3);
    expect(tomate.estagios.map((e) => e.no.quantidade)).toEqual([10, 50, 7]);
    expect(tomate.estagios.map((e) => e.no.unidade)).toEqual(['kg', 'un', 'fatias']);
  });

  it('porta 1 é física (×5) e porta 2 é humana (×3,5)', () => {
    const tomate = cadeias[0];
    expect(tomate.portas).toHaveLength(2);

    expect(tomate.portas[0].indice).toBe(1);
    expect(tomate.portas[0].tipo).toBe('fisica');
    expect(tomate.portas[0].multiplicador).toBeCloseTo(5, 9);
    expect(tomate.portas[0].quantidadeProduzida).toBe(50);

    expect(tomate.portas[1].indice).toBe(2);
    expect(tomate.portas[1].tipo).toBe('humana');
    expect(tomate.portas[1].multiplicador).toBeCloseTo(3.5, 9);
    expect(tomate.portas[1].quantidadeProduzida).toBe(7);
  });

  it('nenhuma cadeia do dataset tem ramificação', () => {
    expect(cadeias.every((c) => !c.temRamificacao)).toBe(true);
  });
});

describe('extrairCadeias — casos de borda', () => {
  it('compra sem transformações vira 1 estágio e 0 portas', () => {
    const compras: CompraInput[] = [
      {
        id: '900', produto: 'Sal', unidade: 'g', quantidade: 1000,
        custoTotal: 2, data: '2026-07-20T00:00:00Z', transformacoes: [],
      },
    ];
    const cadeias = extrairCadeias(construirGrafoCusto(compras));
    expect(cadeias).toHaveLength(1);
    expect(cadeias[0].estagios).toHaveLength(1);
    expect(cadeias[0].portas).toHaveLength(0);
    expect(cadeias[0].temRamificacao).toBe(false);
  });

  it('respeita o CAP_ITENS: 100 un → 40 visíveis + 60 de excedente', () => {
    const compras: CompraInput[] = [
      {
        id: '901', produto: 'Tomate', unidade: 'kg', quantidade: 10,
        custoTotal: 100, data: '2026-07-20T00:00:00Z',
        transformacoes: [
          {
            id: '901-conv', produto: 'Tomate unidade', unidade: 'un',
            quantidadeConsumida: 10, quantidadeProduzida: 100,
          },
        ],
      },
    ];
    const [cadeia] = extrairCadeias(construirGrafoCusto(compras));
    // Estágio da compra cabe inteiro na cena.
    expect(cadeia.estagios[0].itensVisiveis).toBe(10);
    expect(cadeia.estagios[0].excedente).toBe(0);
    // Estágio final estoura o cap visual — mas a quantidade real é preservada.
    expect(cadeia.estagios[1].no.quantidade).toBe(100);
    expect(cadeia.estagios[1].itensVisiveis).toBe(CAP_ITENS);
    expect(cadeia.estagios[1].excedente).toBe(100 - CAP_ITENS);
  });

  it('ramificação: segue o filho de maior custoAlocado e marca temRamificacao', () => {
    const compras: CompraInput[] = [
      {
        id: '902', produto: 'Carne', unidade: 'kg', quantidade: 10,
        custoTotal: 200, data: '2026-07-20T00:00:00Z',
        transformacoes: [
          {
            id: '902-grande', produto: 'Carne peça', unidade: 'peça',
            quantidadeConsumida: 6, quantidadeProduzida: 12, // R$ 120 alocados
          },
          {
            id: '902-pequena', produto: 'Carne fatiada', unidade: 'fatias',
            quantidadeConsumida: 4, quantidadeProduzida: 20, // R$ 80 alocados
          },
        ],
      },
    ];
    const [cadeia] = extrairCadeias(construirGrafoCusto(compras));
    expect(cadeia.temRamificacao).toBe(true);
    expect(cadeia.estagios[1].no.id).toBe('902-grande');
    expect(cadeia.portas[0].multiplicador).toBeCloseTo(2, 9);
  });
});

describe('extrairCadeias — blindagem do crash: quantidade fracionária', () => {
  // Causa raiz do "isVector3" (tela azul): dados reais trazem frações
  // (2,5 kg, 7,33 un — nascem de qtdBase / multiplicadorTotal) e a cena só
  // entende contagem INTEIRA de instâncias. O contrato garante inteiro ≥ 1.

  it('compra fracionária (2,5 kg) sem transformação → itensVisiveis inteiro ≥ 1', () => {
    const compras: CompraInput[] = [
      {
        id: '910', produto: 'Queijo', unidade: 'kg', quantidade: 2.5,
        custoTotal: 60, data: '2026-07-20T00:00:00Z', transformacoes: [],
      },
    ];
    const [cadeia] = extrairCadeias(construirGrafoCusto(compras));
    expect(cadeia.estagios[0].no.quantidade).toBe(2.5); // quantidade REAL preservada
    expect(Number.isInteger(cadeia.estagios[0].itensVisiveis)).toBe(true);
    expect(cadeia.estagios[0].itensVisiveis).toBeGreaterThanOrEqual(1);
  });

  it('cadeia 10 kg → 75 un: estágio final vê 40 visíveis + 35 de excedente', () => {
    const compras: CompraInput[] = [
      {
        id: '911', produto: 'Tomate', unidade: 'kg', quantidade: 10,
        custoTotal: 80, data: '2026-07-20T00:00:00Z',
        transformacoes: [
          {
            id: '911-conv', produto: 'Tomate unidade', unidade: 'un',
            quantidadeConsumida: 10, quantidadeProduzida: 75,
          },
        ],
      },
    ];
    const [cadeia] = extrairCadeias(construirGrafoCusto(compras));
    expect(cadeia.estagios[1].no.quantidade).toBe(75);
    expect(cadeia.estagios[1].itensVisiveis).toBe(CAP_ITENS);
    expect(cadeia.estagios[1].excedente).toBe(75 - CAP_ITENS);
  });

  it('NENHUM itensVisiveis é fracionário — varre cadeias reais e de borda', () => {
    // Frações típicas de dados reais: 2,5 kg na raiz e 7,33 un (÷3) no filho.
    const compras: CompraInput[] = [
      {
        id: '912', produto: 'Presunto', unidade: 'kg', quantidade: 2.5,
        custoTotal: 50, data: '2026-07-20T00:00:00Z',
        transformacoes: [
          {
            id: '912-conv', produto: 'Presunto unidade', unidade: 'un',
            quantidadeConsumida: 2.5, quantidadeProduzida: 22 / 3, // 7,333…
          },
        ],
      },
    ];
    const todos = [
      ...extrairCadeias(construirGrafoCusto(compras)),
      ...extrairCadeias(construirGrafoCusto(COMPRAS_EXEMPLO)),
    ];
    for (const cadeia of todos) {
      for (const est of cadeia.estagios) {
        expect(Number.isInteger(est.itensVisiveis)).toBe(true);
        expect(est.itensVisiveis).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(est.excedente)).toBe(true);
        expect(est.excedente).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
