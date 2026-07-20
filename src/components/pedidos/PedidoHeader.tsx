import { Flame } from 'lucide-react';
import type { PedidoHeaderProps } from '../../types';
import { FLUXO, STATUS_LABEL } from './constants';

export function PedidoHeader({ pedido: p }: PedidoHeaderProps) {
  const fluxo = FLUXO[p.status] ?? FLUXO.CANCELADO;
  const hora = new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const naCozinha = p.estacao_atual === 'COZINHA';

  return (
    <>
      {/* ── Header azul ── */}
      <div style={{ background: '#004198', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <img src="/brand/icon.png" alt="MiseOn" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </div>
          <span style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: 18,
            color: '#EAF1FB',
            letterSpacing: '.02em',
          }}>
            #{p.numero}
          </span>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          padding: '4px 10px',
          borderRadius: 8,
          background: fluxo.bg,
          color: fluxo.color,
          border: `1px solid ${fluxo.color}40`,
        }}>
          {STATUS_LABEL[p.status] || p.status}
        </span>
      </div>

      {/* ── Info cliente ── */}
      <div className="border-b border-gray-100 px-4 py-3 dark:border-white/5">
        <p className="m-0 font-['Sora'] text-sm font-semibold text-gray-900 dark:text-[#EAF1FB]">
          {p.identificador_cliente}
        </p>
        <div className="mt-1 flex justify-between">
          <span className="font-['JetBrains_Mono'] text-[11px] text-gray-500 dark:text-[#6C7A96]">{p.telefone_contato}</span>
          <span className="rounded-md bg-gray-100 px-2 py-[1px] font-['JetBrains_Mono'] text-[11px] text-gray-500 dark:bg-white/5 dark:text-[#6C7A96]">{hora}</span>
        </div>
      </div>

      {/* ── Status em destaque ── */}
      {p.status === 'NOVO' && (
        <div style={{ margin: '12px 16px 0', background: 'rgba(252,91,36,.1)', border: '1px solid rgba(252,91,36,.35)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, color: '#FE7A47' }}>Aguardando aceite</div>
        </div>
      )}
      {naCozinha && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-orange-300/40 bg-orange-500/10 px-3.5 py-2.5" style={{ animation: 'pulse 1.8s infinite' }}>
          <Flame size={16} className="shrink-0 text-orange-500" />
          <div>
            <p className="font-['Sora'] text-sm font-bold text-orange-500">Na cozinha</p>
            <p className="text-[11px] text-gray-400 dark:text-[#AEB9CE]">Só a cozinha avança este pedido agora.</p>
          </div>
        </div>
      )}
      {p.status === 'ACEITO' && !naCozinha && p.requer_cozinha && (
        <div style={{ margin: '12px 16px 0', background: 'rgba(252,91,36,.1)', border: '1px solid rgba(252,91,36,.35)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, color: '#FE7A47' }}>Aceito — pronto para ir à cozinha</div>
          <div style={{ fontSize: 12, color: '#AEB9CE', marginTop: 4 }}>Estoque baixado por ficha técnica ✓</div>
        </div>
      )}
    </>
  );
}
