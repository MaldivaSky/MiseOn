export default function MiseOnLogo({ size = 160, className = '' }: { size?: number, className?: string }) {
  // Retorna a imagem oficial transparente para evitar falhas no SVG
  return (
    <img 
      src="/brand/logo-horizontal.png" 
      alt="MiseOn" 
      style={{ width: size, objectFit: 'contain' }} 
      className={className} 
    />
  );
}
