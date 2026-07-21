/**
 * Camada de Serviço de Custeio — ponto de entrada recomendado.
 *
 * Arquitetura de duas velocidades:
 *
 *   LOCAL  (zero latência) — usa src/lib/custeio.ts diretamente.
 *          Ideal para: cálculos de UI em tempo real, simulador ao vivo,
 *          tooltips de custo, previews enquanto o lojista digita.
 *
 *   REMOTO (Edge Function) — usa custeio-calcular no Supabase.
 *          Ideal para: gravar custos em fichas técnicas, validar CMV
 *          antes de emitir nota, auditar margens. A Edge Function usa os
 *          mesmos módulos TypeScript (custeio.ts + unidades.ts), então
 *          o resultado é GARANTIDAMENTE idêntico ao local — sem drift.
 *
 * Decisão de design:
 *   NÃO substituímos as chamadas locais. A lógica TypeScript é a fonte
 *   única de verdade; a Edge Function é apenas essa mesma lógica rodando
 *   no servidor, com acesso direto e autoritativo ao banco.
 *
 * @example — Calcular custo de uso para UI (local, sem latência)
 *   import { custoDeUso } from './custeio';
 *   const custo = custoDeUso(item, 200, 'ml');
 *
 * @example — Calcular e salvar custo canônico de uma ficha técnica (remoto)
 *   import { calcularCustoRemoto } from './custeio-service';
 *   const r = await calcularCustoRemoto({ acao: 'CALCULAR_BOM', receita: [...] });
 */

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Tipos da API da Edge Function
// ---------------------------------------------------------------------------

export type MetodoCusteio = 'PEPS' | 'MEDIO';

export interface InputCalcularCusto {
  acao: 'CALCULAR_CUSTO';
  insumo_id: string;
  quantidade: number;
  unidade: string;
  metodo?: MetodoCusteio;
}

export interface InputCalcularBOM {
  acao: 'CALCULAR_BOM';
  receita: Array<{ insumo_id: string; quantidade: number; unidade: string }>;
  metodo?: MetodoCusteio;
}

export interface InputBaixarPEPS {
  acao: 'BAIXAR_PEPS';
  insumo_id: string;
  quantidade: number;
  unidade: string;
}

export type InputCusteio = InputCalcularCusto | InputCalcularBOM | InputBaixarPEPS;

export interface RespostaCusto {
  custo: number;
  custo_unitario_base?: number;
  metodo: MetodoCusteio;
  detalhes?: {
    linhas?: Array<{ nome: string; custo: number; quantidade: number; unidade: string }>;
    lotes_consumidos?: Array<{ loteId: string; quantidade: number; custo: number }>;
  };
}

// ---------------------------------------------------------------------------
// Chamada remota — Edge Function
// ---------------------------------------------------------------------------

/**
 * Calcula custo via Edge Function (fonte canônica para persistência).
 *
 * Use para operações que precisam de consistência com o banco:
 * - Gravar custo de ficha técnica
 * - Auditar margem antes de precificar
 * - Verificar CMV de um pedido antes de emitir nota fiscal
 */
export async function calcularCustoRemoto(input: InputCusteio): Promise<RespostaCusto> {
  const { data, error } = await supabase.functions.invoke<RespostaCusto>(
    'custeio-calcular',
    { body: input },
  );

  if (error) {
    throw new Error(`[custeio-service] Edge Function falhou: ${error.message}`);
  }
  if (!data) {
    throw new Error('[custeio-service] Resposta vazia da Edge Function.');
  }
  return data;
}

// ---------------------------------------------------------------------------
// Helpers tipados (açúcar sintático sobre calcularCustoRemoto)
// ---------------------------------------------------------------------------

/** Custo de `quantidade` de `unidade` de um insumo específico — via Edge Function. */
export const calcularCustoInsumo = (
  insumo_id: string,
  quantidade: number,
  unidade: string,
  metodo: MetodoCusteio = 'PEPS',
): Promise<RespostaCusto> =>
  calcularCustoRemoto({ acao: 'CALCULAR_CUSTO', insumo_id, quantidade, unidade, metodo });

/** Custo composto de uma receita (BOM) — via Edge Function. */
export const calcularCustoBOM = (
  receita: Array<{ insumo_id: string; quantidade: number; unidade: string }>,
  metodo: MetodoCusteio = 'PEPS',
): Promise<RespostaCusto> =>
  calcularCustoRemoto({ acao: 'CALCULAR_BOM', receita, metodo });

/** Preview do custo de uma baixa PEPS (não muta estoque) — via Edge Function. */
export const previewBaixaPEPS = (
  insumo_id: string,
  quantidade: number,
  unidade: string,
): Promise<RespostaCusto> =>
  calcularCustoRemoto({ acao: 'BAIXAR_PEPS', insumo_id, quantidade, unidade });
