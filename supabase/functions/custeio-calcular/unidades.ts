/**
 * Registro canônico de unidades e grandezas do MiseOn.
 *
 * CÓPIA AUTORIZADA para o runtime Deno da Edge Function.
 * Fonte de verdade: src/lib/unidades.ts
 *
 * Deno não usa paths relativos de Vite; mantemos uma cópia aqui para que
 * a Edge Function use EXATAMENTE a mesma lógica que o frontend, sem transpilers.
 * Qualquer alteração em unidades.ts DEVE ser refletida aqui.
 */

export type Grandeza = 'massa' | 'volume' | 'contagem' | 'semantico' | 'agrupador';

export interface Unidade {
  codigo: string;
  rotulo: string;
  grandeza: Grandeza;
  fatorBase: number | null;
}

export const BASE_POR_GRANDEZA: Record<Grandeza, string | null> = {
  massa: 'kg',
  volume: 'L',
  contagem: null,
  semantico: null,
  agrupador: null,
};

export const UNIDADES: readonly Unidade[] = [
  { codigo: 'kg',     rotulo: 'Quilograma (kg)',  grandeza: 'massa',     fatorBase: 1     },
  { codigo: 'g',      rotulo: 'Grama (g)',         grandeza: 'massa',     fatorBase: 0.001 },
  { codigo: 'L',      rotulo: 'Litro (L)',          grandeza: 'volume',    fatorBase: 1     },
  { codigo: 'ml',     rotulo: 'Mililitro (ml)',     grandeza: 'volume',    fatorBase: 0.001 },
  { codigo: 'un',     rotulo: 'Unidade (un)',       grandeza: 'contagem',  fatorBase: null  },
  { codigo: 'fatias', rotulo: 'Fatias',             grandeza: 'semantico', fatorBase: null  },
  { codigo: 'porção', rotulo: 'Porções',            grandeza: 'semantico', fatorBase: null  },
  { codigo: 'peça',   rotulo: 'Peças',              grandeza: 'semantico', fatorBase: null  },
  { codigo: 'cx',     rotulo: 'Caixa (cx)',         grandeza: 'agrupador', fatorBase: null  },
  { codigo: 'pct',    rotulo: 'Pacote (pct)',       grandeza: 'agrupador', fatorBase: null  },
  { codigo: 'fardo',  rotulo: 'Fardo',              grandeza: 'agrupador', fatorBase: null  },
  { codigo: 'lata',   rotulo: 'Lata',               grandeza: 'agrupador', fatorBase: null  },
  { codigo: 'gf',     rotulo: 'Garrafa (gf)',       grandeza: 'agrupador', fatorBase: null  },
];

const POR_CODIGO = new Map(UNIDADES.map((u) => [u.codigo, u]));

export function getUnidade(codigo: string): Unidade | undefined {
  return POR_CODIGO.get(codigo);
}

export function ehDimensional(u: Unidade): boolean {
  return u.fatorBase != null;
}

export type MotivoRejeicao =
  | 'unidade-desconhecida'
  | 'identidade'
  | 'grandeza-incompativel'
  | 'multiplicacao-espontanea';

export interface ResultadoValidacao {
  ok: boolean;
  motivo?: MotivoRejeicao;
  mensagem?: string;
  rendimentoCanonico?: number;
}

export function validarConversao(
  codigoOrigem: string,
  codigoDestino: string,
  quantidadeOrigem = 1,
  quantidadeDestino = 1,
): ResultadoValidacao {
  const origem = getUnidade(codigoOrigem);
  const destino = getUnidade(codigoDestino);

  if (!origem || !destino) {
    return {
      ok: false,
      motivo: 'unidade-desconhecida',
      mensagem: `Unidade desconhecida: "${!origem ? codigoOrigem : codigoDestino}".`,
    };
  }

  if (origem.codigo === destino.codigo) {
    return {
      ok: false,
      motivo: 'identidade',
      mensagem: `"${origem.rotulo}" não se converte em si mesmo.`,
    };
  }

  const ambasDimensionais = ehDimensional(origem) && ehDimensional(destino);

  if (ambasDimensionais && origem.grandeza !== destino.grandeza) {
    return {
      ok: false,
      motivo: 'grandeza-incompativel',
      mensagem: `Não é possível converter ${origem.grandeza} em ${destino.grandeza}.`,
    };
  }

  if (ambasDimensionais && origem.grandeza === destino.grandeza) {
    const baseOrigem = quantidadeOrigem * origem.fatorBase!;
    const baseDestino = quantidadeDestino * destino.fatorBase!;
    const rendimentoCanonico = origem.fatorBase! / destino.fatorBase!;

    if (baseDestino > baseOrigem * (1 + 1e-4)) {
      const base = BASE_POR_GRANDEZA[origem.grandeza];
      const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
      return {
        ok: false,
        motivo: 'multiplicacao-espontanea',
        mensagem:
          `${fmt(quantidadeOrigem)} ${origem.codigo} = ${fmt(baseOrigem)} ${base}, mas ` +
          `${fmt(quantidadeDestino)} ${destino.codigo} = ${fmt(baseDestino)} ${base}. ` +
          `Rendimento máximo: ${(quantidadeOrigem * rendimentoCanonico).toLocaleString('pt-BR')} ${destino.codigo}.`,
        rendimentoCanonico,
      };
    }
    return { ok: true, rendimentoCanonico };
  }

  return { ok: true };
}

export function converter(
  quantidade: number,
  codigoOrigem: string,
  codigoDestino: string,
): number | null {
  const origem = getUnidade(codigoOrigem);
  const destino = getUnidade(codigoDestino);
  if (!origem?.fatorBase || !destino?.fatorBase) return null;
  if (origem.grandeza !== destino.grandeza) return null;
  return (quantidade * origem.fatorBase) / destino.fatorBase;
}
