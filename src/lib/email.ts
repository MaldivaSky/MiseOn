import { supabase } from './supabase';

export interface InvoiceItem {
  nome: string;
  quantidade: number;
  preco: string;
}

export interface InvoiceData {
  numero: string;
  itens: InvoiceItem[];
  valorTotal: string;
  linkPdf?: string;
}

export interface PaymentData {
  pedidoId: string;
  valor: string;
  metodo: string;
  transacaoId: string;
  ultimosDigitos?: string;
}

/**
 * Envia um email de nota fiscal para o usuário autenticado.
 */
export async function sendInvoiceEmail(invoiceData: InvoiceData): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateType: 'invoice',
        data: invoiceData
      }
    });

    if (error) throw error;
    return { success: true, ...data };
  } catch (error: any) {
    console.error('Erro ao enviar email de invoice:', error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
}

/**
 * Envia um email de confirmação de pagamento para o usuário autenticado.
 */
export async function sendPaymentEmail(paymentData: PaymentData): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateType: 'payment-confirmed',
        data: paymentData
      }
    });

    if (error) throw error;
    return { success: true, ...data };
  } catch (error: any) {
    console.error('Erro ao enviar email de pagamento:', error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
}
