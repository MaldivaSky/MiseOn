import { useEffect, useState } from 'react';

export default function BrandIntro({
  children,
  onFinish,
  once = true,
  duration = 5000,
}: {
  children?: React.ReactNode;
  onFinish?: () => void;
  once?: boolean;
  duration?: number;
}) {
  const [visivel, setVisivel] = useState(
    () => !(once && sessionStorage.getItem('miseon_intro_v4'))
  );

  const fechar = () => {
    if (once) sessionStorage.setItem('miseon_intro_v4', '1');
    setVisivel(false);
    onFinish?.();
  };

  useEffect(() => {
    if (!visivel) return;
    const t = setTimeout(fechar, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, duration]);

  if (!visivel) return <>{children}</>;

  return (
    <>
      {children}
      <div
        onClick={fechar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(130% 130% at 50% 36%, #0C1730 0%, #060B18 60%, #03060E 100%)',
          cursor: 'pointer',
          animation: 'brandFade 3.2s ease forwards',
          overflow: 'hidden',
        }}
      >
        {/* Grid de pontos */}
        <div style={{
          position: 'absolute', inset: '-6%',
          backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          opacity: .5,
          maskImage: 'radial-gradient(620px 460px at 50% 42%, #000, transparent 76%)',
          WebkitMaskImage: 'radial-gradient(620px 460px at 50% 42%, #000, transparent 76%)',
          pointerEvents: 'none',
        }} />

        {/* Vinheta */}
        <div style={{
          position: 'absolute', inset: 0,
          boxShadow: 'inset 0 0 260px rgba(0,0,0,.85)',
          pointerEvents: 'none',
        }} />

        {/* Glow azul */}
        <div style={{
          position: 'absolute',
          width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(10,92,196,.35), rgba(252,91,36,.1) 45%, transparent 68%)',
          filter: 'blur(40px)',
          animation: 'brandGlow 3.2s ease-out both',
          pointerEvents: 'none',
        }} />

        {/* Logo oficial */}
        <div style={{
          position: 'relative',
          animation: 'brandLogoIn 3.2s cubic-bezier(.16,1,.3,1) both',
        }}>
          {/* Brilho especular */}
          <div style={{
            position: 'absolute', inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            WebkitMaskImage: 'url(/brand/icon.png)',
            maskImage: 'url(/brand/icon.png)',
            WebkitMaskSize: '80px 80px',
            maskSize: '80px 80px',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: '0 center',
            maskPosition: '0 center',
          }}>
            <div style={{
              position: 'absolute', top: '-25%', left: 0, width: '40%', height: '150%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.9), transparent)',
              animation: 'brandShine 3.2s ease-in-out 1.5s both',
            }} />
          </div>

          <img
            src="/brand/logo.png"
            alt="MiseOn"
            style={{
              width: 'min(600px, 88vw)',
              display: 'block',
              filter: 'drop-shadow(0 20px 60px rgba(10,92,196,.6)) drop-shadow(0 4px 20px rgba(252,91,36,.4))',
            }}
          />
        </div>

        {/* Linha */}
        <div style={{
          height: 2,
          width: 'min(320px, 60vw)',
          margin: '28px auto 20px',
          background: 'linear-gradient(90deg, transparent, #FC5B24, transparent)',
          animation: 'brandLine 3.2s ease-out .6s both',
          transformOrigin: 'center',
        }} />

        {/* Tagline */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          letterSpacing: '.32em',
          color: '#9AA7C0',
          textTransform: 'uppercase',
          animation: 'brandTag 3.2s ease-out .8s both',
        }}>
          Sistema inteligente para sua cozinha
        </div>

        <style>{`
          @keyframes brandFade {
            0%   { opacity: 0; }
            5%   { opacity: 1; }
            88%  { opacity: 1; }
            100% { opacity: 0; pointer-events: none; }
          }
          @keyframes brandLogoIn {
            0%   { opacity: 0; transform: scale(.7) translateY(30px); filter: blur(12px); }
            40%  { opacity: 1; transform: scale(1.04) translateY(-4px); filter: blur(0); }
            55%  { transform: scale(.98) translateY(0); }
            70%  { transform: scale(1.02) translateY(-2px); }
            100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
          }
          @keyframes brandGlow {
            0%   { opacity: 0; transform: scale(.5); }
            50%  { opacity: 1; transform: scale(1.1); }
            100% { opacity: .6; transform: scale(1); }
          }
          @keyframes brandLine {
            0%, 55%  { transform: scaleX(0); opacity: 0; }
            80%  { transform: scaleX(1); opacity: 1; }
            100% { transform: scaleX(1); opacity: 1; }
          }
          @keyframes brandTag {
            0%, 65%  { opacity: 0; transform: translateY(10px); }
            85%  { opacity: 1; transform: none; }
            100% { opacity: 1; }
          }
          @keyframes brandShine {
            0%   { transform: translateX(-200%) skewX(-16deg); }
            100% { transform: translateX(600%) skewX(-16deg); }
          }
        `}</style>
      </div>
    </>
  );
}
