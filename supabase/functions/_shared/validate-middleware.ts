import { z } from 'npm:zod';

type HandlerWithBody<T> = (req: Request, body: T) => Promise<Response>;

/**
 * Middleware para validar o body (JSON) da requisição usando um schema Zod.
 * Garante que a Edge Function só seja executada se os dados estiverem válidos,
 * prevenindo SQL Injection, dados malformados, etc.
 */
export const withValidation = <T>(schema: z.ZodSchema<T>, handler: HandlerWithBody<T>) => {
  return async (req: Request): Promise<Response> => {
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {}; // Fallback para body vazio/inválido
    }

    const validationResult = schema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation Error',
          issues: validationResult.error.issues,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return await handler(req, validationResult.data);
  };
};

/**
 * Combinação de Auth + Validation.
 * Útil para rotas privadas que também exigem validação de body.
 */
export const withAuthAndValidation = <T>(
  schema: z.ZodSchema<T>,
  handler: (req: Request, ctx: { user: any; supabase: any }, body: T) => Promise<Response>
) => {
  return async (req: Request, ctx: { user: any; supabase: any }): Promise<Response> => {
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {};
    }

    const validationResult = schema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation Error',
          issues: validationResult.error.issues,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return await handler(req, ctx, validationResult.data);
  };
};
