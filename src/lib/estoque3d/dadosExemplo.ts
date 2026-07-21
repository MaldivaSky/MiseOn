/**
 * Dataset de exemplo do Grafo de Transformação de Insumos.
 *
 * Reproduz o caso clássico do sistema (conservação de valor):
 *   Compra #452: 10 kg de tomate por R$ 60,00  → R$ 6,00/kg
 *     └─ Conversão: 10 kg → 50 un                → R$ 1,20/un
 *          ├─ Produção: 2 un (R$ 2,40) → 7 fatias → ~R$ 0,34/fatia
 *          └─ (as 48 un restantes seguem como estoque atômico)
 *
 * Inclui uma segunda compra (cebola) para exercitar múltiplas raízes e a
 * divisão do círculo em setores proporcionais ao custo total de cada compra.
 */

import type { CompraInput } from './types';

export const COMPRAS_EXEMPLO: CompraInput[] = [
  {
    id: '452',
    produto: 'Tomate',
    unidade: 'kg',
    quantidade: 10,
    custoTotal: 60,
    data: '2026-07-20T09:00:00Z',
    transformacoes: [
      {
        id: '452-conv',
        produto: 'Tomate unidade',
        unidade: 'un',
        quantidadeConsumida: 10, // consome os 10 kg
        quantidadeProduzida: 50, // rende 50 unidades
        data: '2026-07-20T09:05:00Z',
        filhos: [
          {
            id: '452-fatias',
            produto: 'Fatia de tomate',
            unidade: 'fatias',
            quantidadeConsumida: 2, // pega 2 unidades (R$ 2,40)
            quantidadeProduzida: 7, // vira 7 fatias
            data: '2026-07-21T08:30:00Z', // recente → brilha (bloom)
          },
        ],
      },
    ],
  },
  {
    id: '453',
    produto: 'Cebola',
    unidade: 'kg',
    quantidade: 5,
    custoTotal: 18,
    data: '2026-07-19T10:00:00Z',
    transformacoes: [
      {
        id: '453-conv',
        produto: 'Cebola unidade',
        unidade: 'un',
        quantidadeConsumida: 5,
        quantidadeProduzida: 40,
        data: '2026-07-19T10:10:00Z',
        filhos: [
          {
            id: '453-aneis',
            produto: 'Anéis de cebola',
            unidade: 'porção',
            quantidadeConsumida: 6,
            quantidadeProduzida: 12,
            data: '2026-07-21T07:45:00Z', // recente → brilha
          },
        ],
      },
    ],
  },
];
