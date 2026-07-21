import { describe, it, expect } from 'vitest';
import { calcularPosicoesAssentos, prepararLayoutSalao3D } from './layoutMesas';
import type { Mesa, Comanda, Pedido } from '../../types';

describe('layoutMesas', () => {
  it('calcula posições trigonométricas de assentos para mesa REDONDA', () => {
    const assentos = calcularPosicoesAssentos('REDONDA', 4);
    expect(assentos).toHaveLength(4);
    expect(assentos[0].numero).toBe(1);
    expect(assentos[1].numero).toBe(2);
    // Deve distribuir em 360 graus (90 graus entre cada cadeira)
    expect(Math.abs(assentos[0].xRel)).toBeLessThan(0.001);
    expect(assentos[0].zRel).toBeLessThan(0); // Topo (-Z)
  });

  it('calcula posições para mesa RETANGULAR com 6 lugares', () => {
    const assentos = calcularPosicoesAssentos('RETANGULAR', 6);
    expect(assentos).toHaveLength(6);
    // 3 cadeiras de cada lado
    const ladoNorte = assentos.filter((a) => a.zRel < 0);
    const ladoSul = assentos.filter((a) => a.zRel > 0);
    expect(ladoNorte.length).toBeGreaterThanOrEqual(3);
    expect(ladoSul.length).toBeGreaterThanOrEqual(3);
  });

  it('prepara layout do salão com status 3D e assentos corretos', () => {
    const mesas: Mesa[] = [
      { id: 'm1', loja_id: 'l1', numero: 1, capacidade: 4, ativo: true, criado_em: '2026-01-01' },
      { id: 'm2', loja_id: 'l1', numero: 2, capacidade: 2, ativo: true, criado_em: '2026-01-01' },
    ];
    const comandas: Comanda[] = [
      { id: 'c1', loja_id: 'l1', mesa_id: 'm1', status: 'ABERTA', taxa_servico_pct: 10, valor_servico: 0, aberta_em: new Date().toISOString() },
    ];
    const pedidos: Pedido[] = [
      {
        id: 'p1', numero: 101, tipo_pedido: 'SALAO', status: 'ACEITO', identificador_cliente: 'Cliente 1',
        subtotal: 50, taxa_entrega: 0, desconto: 0, valor_total: 50, comanda_id: 'c1', mesa_numero: 1, criado_em: new Date().toISOString(),
        itens_pedido: [{ id: 'i1', nome_produto: 'Chopp', preco_unitario: 10, quantidade: 2, assento_numero: 1 }],
      },
    ];

    const layout = prepararLayoutSalao3D(mesas, comandas, pedidos);
    expect(layout).toHaveLength(2);

    const mesa1 = layout.find((m) => m.mesa.id === 'm1')!;
    expect(mesa1.status3D).toBe('EM_PREPARO'); // Devido ao pedido com status ACEITO
    expect(mesa1.totalParcial).toBe(50);
    expect(mesa1.assentos[0].valorConsumido).toBe(20); // 2x Chopp R$ 10 no assento 1
  });
});
