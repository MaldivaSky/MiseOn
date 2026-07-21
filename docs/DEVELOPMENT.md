# Guia de Desenvolvimento MiseOn

Este documento descreve as práticas e arquitetura de segurança e validação adotadas na aplicação.

## 1. Edge Functions (Server-Side)

### Validação de JWT e Permissões
Toda e qualquer rota Edge Function que execute **mutações** ou requeira contexto de quem está fazendo a chamada (usuário ou plataforma) **deve** ser protegida usando o `withAuth`.

```typescript
import { withAuth } from '../_shared/jwt-middleware.ts';

const handler = async (req: Request, ctx: { user: any, supabase: any }) => {
  // req está autenticado, ctx.user contém o usuário
  // Utilize ctx.supabase para acessar o banco de forma segura com as permissões do RLS associado.
};

export default withAuth(handler);
```

As únicas exceções a essa regra são:
- Webhooks de terceiros (ex: iFood, Pix/Efí) que utilizam validações específicas de API Key ou HMAC.
- Endpoints de autenticação pública (login, reset password).
- Health-checks (caso existam).

### Validação de Entrada com Zod
Não confie no payload recebido (`req.json()`). Utilize o `validate-middleware` com esquemas do `zod` em conjunto com a autenticação:

```typescript
import { z } from 'npm:zod';
import { withAuthAndValidation } from '../_shared/validate-middleware.ts';

const mySchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
});

const handler = async (req: Request, ctx: { user: any, supabase: any }, body: z.infer<typeof mySchema>) => {
  // body.id e body.amount estão rigorosamente validados e tipados
};

// Envolve a função combinando Auth + Validation
export default withAuth((req, ctx) => withAuthAndValidation(mySchema, handler)(req, ctx));
```

## 2. Formulários (Client-Side)

Utilize **Sempre** `react-hook-form` em conjunto com `@hookform/resolvers/zod`.

Isso garante:
- Tipagem estrita a partir dos esquemas (Zero `any`).
- Regras de validação consistentes entre Frontend e Backend (Reutilize os schemas de `src/validation/schemas.ts`).
- Excelente desempenho, pois `react-hook-form` não gera re-renders a cada tecla pressionada.

### Exemplo
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

function Form() {
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  });
  
  return (
    <form onSubmit={handleSubmit(data => console.log(data))}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
    </form>
  );
}
```

## 3. Segredos e Chaves
**Nunca coloque credenciais no código**. Mesmo o arquivo `.env.local` não deve subir ao git (já incluso no `.gitignore`).
Rotacione suas chaves a cada 90 dias através do painel do Supabase -> Settings -> Secrets e GitHub Actions. Em caso de vazamento acidental, revogue imediatamente.
