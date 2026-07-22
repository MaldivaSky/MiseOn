/**
 * Agendador da fila de e-mail (Vercel Cron).
 *
 * Por que existe: os gatilhos no Postgres enfileiram sozinhos, mas nada
 * drena a fila. `pg_cron` + `pg_net` fariam o proprio banco chamar a
 * edge function — e exigiriam guardar a service role key dentro do
 * banco (Vault), criando uma segunda copia do segredo mais critico
 * dentro do sistema que ele protege. Por isso o agendamento e externo.
 *
 * Menor privilegio: esta rota NAO conhece a service role key. Ela usa
 * EMAIL_WORKER_TOKEN, que so sabe fazer uma coisa — drenar a fila. Se
 * vazar, o estrago e disparar e-mails ja aprovados; a service key
 * daria o banco inteiro.
 *
 * Duas barreiras de autenticacao:
 *   1. CRON_SECRET      — prova que a chamada veio do Vercel Cron
 *   2. EMAIL_WORKER_TOKEN — prova, para a edge function, que a chamada
 *                           tem permissao de drenar
 *
 * Variaveis necessarias no Vercel (Project Settings -> Environment Variables):
 *   CRON_SECRET             (o Vercel envia como Bearer no header)
 *   EMAIL_WORKER_TOKEN      (mesmo valor definido nos Secrets do Supabase)
 *   SUPABASE_FUNCTIONS_URL  ex.: https://<ref>.supabase.co/functions/v1
 */

import { timingSafeEqual } from 'node:crypto';

/** Comparacao em tempo constante: evita descobrir o segredo medindo a resposta. */
function segredoConfere(recebido: string, esperado: string) {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(req: any, res: any) {
  const cronSecret = process.env.CRON_SECRET;
  const workerToken = process.env.EMAIL_WORKER_TOKEN;
  const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL;

  if (!cronSecret || !workerToken || !functionsUrl) {
    console.error('cron/email: variaveis de ambiente ausentes');
    return res.status(500).json({ error: 'Agendador nao configurado' });
  }

  const auth = String(req.headers.authorization ?? '');
  const enviado = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!segredoConfere(enviado, cronSecret)) {
    // Sem detalhe no corpo: nada que ajude a calibrar tentativas.
    return res.status(401).json({ error: 'Nao autorizado' });
  }

  try {
    const resposta = await fetch(`${functionsUrl}/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-token': workerToken,
      },
      body: JSON.stringify({ acao: 'processar' }),
    });

    const corpo = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      console.error('cron/email: worker respondeu', resposta.status, corpo);
      return res.status(502).json({ error: 'Worker falhou', status: resposta.status });
    }

    console.log('cron/email:', JSON.stringify(corpo));
    return res.status(200).json(corpo);
  } catch (e) {
    console.error('cron/email: falha ao chamar o worker', e);
    return res.status(502).json({ error: 'Falha de comunicacao com o worker' });
  }
}
