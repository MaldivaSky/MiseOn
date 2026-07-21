import { z } from 'zod';

// Custom refinements for monetary inputs
export const monetaryInputSchema = z
  .union([z.string(), z.number()])
  .transform((val) => {
    if (typeof val === 'number') return val;
    // Replace comma with dot and parse
    return parseFloat(val.replace(',', '.'));
  })
  .refine((val) => !isNaN(val) && val >= 0, {
    message: 'Valor monetário inválido. Deve ser um número positivo.',
  });

// Schema for PIX Webhook payload
export const pixWebhookSchema = z.object({
  pix: z
    .array(
      z.object({
        txid: z.string().min(1, 'TXID é obrigatório'),
        valor: monetaryInputSchema.optional(),
      }).passthrough() // Allow other fields from EFI
    )
    .optional()
    .default([]),
}).passthrough();

// Example schema for creating a payment/order
export const createOrderSchema = z.object({
  lojaId: z.string().uuid('ID de loja inválido'),
  valorTotal: monetaryInputSchema,
  itens: z.array(
    z.object({
      produtoId: z.string().uuid('ID de produto inválido'),
      quantidade: z.number().int().positive('Quantidade deve ser maior que zero'),
      precoUnitario: monetaryInputSchema,
    })
  ).min(1, 'Pedido deve ter pelo menos um item'),
});

// Authentication or basic user info schemas
export const userProfileSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
  documento: z.string().refine(
    (val) => {
      const cleanVal = val.replace(/\D/g, '');
      return cleanVal.length === 11 || cleanVal.length === 14;
    },
    { message: 'CPF ou CNPJ inválido' }
  ).optional(),
});
