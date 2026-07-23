export default function MiseOnLogo({ size = 160, className = '' }: { size?: number, className?: string }) {
  return (
    <img 
      src="/MiseOn-repagina-removebg-preview.png" 
      alt="MiseOn" 
      style={{ 
        width: size,
        maxWidth: '100%',
        height: 'auto',
        objectFit: 'contain' 
      }} 
      className={className} 
    />
  );
}
