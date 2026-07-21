import { createClient } from 'jsr:@supabase/supabase-js@2';

export type RequestContext = {
  user: any;
  supabase: any;
};

export type AuthenticatedHandler = (
  req: Request,
  ctx: RequestContext
) => Promise<Response>;

/**
 * Middleware para validar o JWT do usuário ou a chave de Service Role.
 * Injeta o usuário autenticado (ou admin) no contexto.
 */
export const withAuth = (handler: AuthenticatedHandler) => {
  return async (req: Request): Promise<Response> => {
    // 1. Extrair token do header Authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Invalid Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // 2. Inicializar cliente do Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      let user = null;
      let supabaseClient = null;

      // Se for a service role key (para requisições server-to-server confiáveis)
      if (token === supabaseServiceKey) {
        user = { role: 'service_role' };
        supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
      } else {
        // Se for token de usuário (JWT)
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        
        const { data: { user: authUser }, error } = await supabaseClient.auth.getUser();
        if (error || !authUser) {
          throw new Error('Invalid JWT Token');
        }
        user = authUser;
      }

      // 3. Executar o handler injetando o contexto
      return await handler(req, { user, supabase: supabaseClient });
    } catch (e) {
      console.error('Auth Error:', String(e));
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
};
