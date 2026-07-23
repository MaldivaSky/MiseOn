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
            <img src="/brand/part-mbase.png" alt="" />
            <img src="/brand/part-arrowshaft.png" alt="" />
            <img src="/brand/part-hat.png" alt="" />
            <img src="/brand/part-arrowhead.png" alt="" />
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
