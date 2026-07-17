import QRCode from 'qrcode';

/** Gera um QR Code como data URL (PNG), 100% client-side — sem depender de serviço externo. */
export async function gerarQrDataUrl(conteudo: string, tamanho = 320): Promise<string> {
  return QRCode.toDataURL(conteudo, {
    width: tamanho,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
