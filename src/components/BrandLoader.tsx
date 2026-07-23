import React from 'react';

export function BrandLoader({ fullscreen = true, title = 'SISTEMA INTELIGENTE PARA SUA COZINHA' }: { fullscreen?: boolean, title?: string }) {
  // O componente agora utiliza estritamente o CSS padrão (.mo-intro)
  // em vez de criar classes duplicadas.
  return (
    <div className={`mo-intro ${fullscreen ? '' : 'absolute'}`}>
      <div className="mo-intro-stage">
        <div className="mo-mark">
          <div className="mo-spot" />
          <div className="mo-parts">
            <img src="/icon.png" alt="" style={{ animation: 'popIn 1s cubic-bezier(0.2, 0.8, 0.2, 1) both' }} />
          </div>
          <div className="mo-shine"><span /></div>
        </div>
        <div className="mo-word"><b>MISE</b><i>ON</i></div>
        <div className="mo-line" />
        <div className="mo-tag">{title}</div>
      </div>
    </div>
  );
}
