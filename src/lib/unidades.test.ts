import { describe, it, expect } from 'vitest';
import { validarConversao, destinosPermitidos, converter } from './unidades';
import { construirGrafoCusto, auditarConservacao, ErroConservacao } from './estoque3d/types';
import { COMPRAS_EXEMPLO } from './estoque3d/dadosExemplo';

describe('conservação dimensional (Q_d·F_d ≤ Q_o·F_o)', () => {
  it('rejeita multiplicação espontânea de massa: 1 kg → 10 kg', () => {
    const r = validarConversao('kg', 'kg', 1, 10);
    expect(r.ok).toBe(false);
  });

  it('rejeita 1 kg → 2000 g (2 kg saindo de 1 kg)', () => {
    const r = validarConversao('kg', 'g', 1, 2000);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('multiplicacao-espontanea');
  });

  it('aceita 1 kg → 1000 g (conservação exata)', () => {
    expect(validarConversao('kg', 'g', 1, 1000).ok).toBe(true);
  });

  it('aceita 1 kg → 850 g (perda por limpeza: tirar semente/osso)', () => {
    expect(validarConversao('kg', 'g', 1, 850).ok).toBe(true);
  });

  it('rejeita identidade kg → kg mesmo com rendimento 1', () => {
    const r = validarConversao('kg', 'kg', 1, 1);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('identidade');
  });

  it('rejeita massa → volume (sem densidade não há fator universal)', () => {
    expect(validarConversao('kg', 'L', 1, 1).motivo).toBe('grandeza-incompativel');
  });

  it('expõe o rendimento canônico da grandeza', () => {
    expect(validarConversao('kg', 'g', 1, 1000).rendimentoCanonico).toBe(1000);
    expect(validarConversao('L', 'ml', 1, 1000).rendimentoCanonico).toBe(1000);
  });
});

describe('rendimento por declaração humana (sem fator universal)', () => {
  it('aceita agrupador → massa: 1 caixa rende 20 kg', () => {
    expect(validarConversao('cx', 'kg', 1, 20).ok).toBe(true);
  });

  it('aceita massa → contagem: 10 kg de tomate rendem 50 un', () => {
    expect(validarConversao('kg', 'un', 10, 50).ok).toBe(true);
  });

  it('aceita quebra semântica: 2 un rendem 7 fatias', () => {
    expect(validarConversao('un', 'fatias', 2, 7).ok).toBe(true);
  });
});

describe('UX preventiva: destinos permitidos', () => {
  it('compra em kg NÃO oferece kg como destino', () => {
    const codigos = destinosPermitidos('kg').map((u) => u.codigo);
    expect(codigos).not.toContain('kg');
  });

  it('compra em kg oferece submúltiplo (g) e quebras semânticas', () => {
    const codigos = destinosPermitidos('kg').map((u) => u.codigo);
    expect(codigos).toContain('g');
    expect(codigos).toContain('fatias');
  });

  it('compra em kg não oferece unidades de volume', () => {
    const codigos = destinosPermitidos('kg').map((u) => u.codigo);
    expect(codigos).not.toContain('L');
    expect(codigos).not.toContain('ml');
  });
});

describe('conversão dimensional', () => {
  it('converte dentro da mesma grandeza', () => {
    expect(converter(2, 'kg', 'g')).toBe(2000);
  });
  it('retorna null sem fator universal', () => {
    expect(converter(1, 'cx', 'kg')).toBeNull();
  });
});

describe('grafo de custo: conservação de valor', () => {
  const grafo = construirGrafoCusto(COMPRAS_EXEMPLO);
  const porId = (id: string) => grafo.nos.find((n) => n.id === id)!;

  it('dilui 10 kg / R$ 60 em 50 un a R$ 1,20/un', () => {
    expect(porId('452-conv').custoUnitario).toBeCloseTo(1.2, 6);
  });

  it('dilui 2 un (R$ 2,40) em 7 fatias a ~R$ 0,34/fatia', () => {
    expect(porId('452-fatias').custoUnitario).toBeCloseTo(2.4 / 7, 6);
  });

  it('não perde nem cria custo (auditoria fecha em zero)', () => {
    expect(auditarConservacao(grafo)).toBeLessThan(1e-9);
  });

  it('bloqueia o grafo quando a compra viola a conservação de massa', () => {
    expect(() =>
      construirGrafoCusto([
        {
          id: 'x', produto: 'Tomate', unidade: 'kg', quantidade: 1,
          custoTotal: 5, data: '2026-07-20T00:00:00Z',
          transformacoes: [{
            id: 'y', produto: 'Fraude', unidade: 'g',
            quantidadeConsumida: 1, quantidadeProduzida: 10000,
          }],
        },
      ]),
    ).toThrow(ErroConservacao);
  });
});
