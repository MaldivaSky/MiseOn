import type { StatusPedido } from '../../types';

export const FLUXO: Record<string, { prox?: StatusPedido; label?: string; bg: string; color: string }> = {
  NOVO:       { prox: 'ACEITO',     label: 'Aceitar pedido',   bg: 'rgba(252,91,36,.18)',  color: '#FC5B24' },
  ACEITO:     { bg: 'rgba(10,92,196,.18)',  color: '#6B9EFF' },
  PREPARANDO: { bg: 'rgba(10,92,196,.18)',  color: '#6B9EFF' },
  PRONTO:     { prox: 'EM_ROTA',    label: 'Saiu p/ entrega',  bg: 'rgba(124,58,237,.18)', color: '#A78BFA' },
  EM_ROTA:    { prox: 'FINALIZADO', label: 'Finalizar',        bg: 'rgba(16,185,129,.18)', color: '#34D399' },
  FINALIZADO: { bg: 'rgba(16,185,129,.14)', color: '#34D399' },
  CANCELADO:  { bg: 'rgba(239,68,68,.14)',  color: '#F87171' },
};

export const STATUS_LABEL: Record<string, string> = {
  NOVO: 'NOVO', ACEITO: 'ACEITO', PREPARANDO: 'PREP.', PRONTO: 'PRONTO',
  EM_ROTA: 'EM ROTA', FINALIZADO: 'FINALIZADO', CANCELADO: 'CANCELADO',
};
