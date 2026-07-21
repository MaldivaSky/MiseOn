/**
 * Tipos e utilitários de domínio da Engine 3D Inteligente de Mesas & Assentos.
 */

import type { Mesa, Comanda, Pedido, ItemPedido, FormatoMesa } from '../../types';

export type StatusMesa3D = 'LIVRE' | 'OCUPADA' | 'EM_PREPARO' | 'AGUARDANDO_CONTA' | 'CHAMA_GARCOM';

export interface Assento3D {
  numero: number;
  xRelativo: number;
  zRelativo: number;
  ocupado: boolean;
  valorConsumido: number;
  totalItens: number;
  itens: ItemPedido[];
}

export interface Mesa3DPosicionada {
  mesa: Mesa;
  comanda?: Comanda;
  status3D: StatusMesa3D;
  assentos: Assento3D[];
  x: number;
  z: number;
  rotacao: number;
  formato: FormatoMesa;
  capacidade: number;
  totalParcial: number;
  totalPago: number;
  saldoDevedor: number;
  tempoMinutos: number;
  temItemEmPreparo: boolean;
  pedidos: Pedido[];
}

export interface InfoHoverMesa {
  mesa3d: Mesa3DPosicionada;
  assentoHover?: number | null;
  telaX: number;
  telaY: number;
}

export interface PosicaoTelaMesa {
  mesaId: string;
  numero: number;
  telaX: number;
  telaY: number;
  visivel: boolean;
  status3D: StatusMesa3D;
}

export type ModoDivisaoConta = 'IGUALITARIA' | 'POR_ASSENTO' | 'PARCIAL_VALOR';

export interface OpcoesEngineMesas {
  onHover?: (info: InfoHoverMesa | null) => void;
  onSelectMesa?: (mesa3d: Mesa3DPosicionada, assentoNumero?: number | null) => void;
  onLayoutChange?: (mesaId: string, novaPos: { x: number; z: number; rotacao: number }) => void;
  corFundo?: number;
  modoEdicao?: boolean;
}

/** Cores de estado em representação hex & RGB para Shaders PBR e Bloom */
export const COR_STATUS_3D: Record<StatusMesa3D, { hex: number; rgb: [number, number, number]; glow: number }> = {
  LIVRE: { hex: 0x10b981, rgb: [0.06, 0.72, 0.51], glow: 0.2 },       // Verde Esmeralda Suave
  OCUPADA: { hex: 0xf97316, rgb: [0.97, 0.45, 0.08], glow: 0.7 },     // Laranja Quente Vivido
  EM_PREPARO: { hex: 0x3b82f6, rgb: [0.23, 0.51, 0.96], glow: 1.2 },  // Azul Eletrico Pulsação
  AGUARDANDO_CONTA: { hex: 0xeab308, rgb: [0.91, 0.70, 0.03], glow: 1.6 }, // Dourado Neon Bloom
  CHAMA_GARCOM: { hex: 0xef4444, rgb: [0.93, 0.26, 0.26], glow: 2.2 }, // Vermelho Alerta Máximo
};
