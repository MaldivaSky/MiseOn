// Supabase Edge Functions environment runs on Deno.
// We use a structured JSON format so that logs can be easily parsed by Logflare / Datadog / Supabase Logs Explorer.

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface EdgeLogPayload {
  message: string;
  tenant_id?: string;
  req_id?: string;
  context?: Record<string, any>;
  error?: Error | unknown;
}

export class EdgeLogger {
  private baseContext: Record<string, any>;

  constructor(baseContext: Record<string, any> = {}) {
    this.baseContext = baseContext;
  }

  // Permite criar um logger derivado com contexto extra (ex: um req_id específico)
  withContext(context: Record<string, any>) {
    return new EdgeLogger({ ...this.baseContext, ...context });
  }

  private log(level: LogLevel, payload: EdgeLogPayload) {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      level,
      message: payload.message,
      tenant_id: payload.tenant_id ?? this.baseContext.tenant_id,
      req_id: payload.req_id ?? this.baseContext.req_id,
      context: { ...this.baseContext.context, ...payload.context },
      error: payload.error ? this.formatError(payload.error) : undefined,
    };

    // Imprimir o objeto como string JSON puro garante que o Supabase/Logflare extraia os campos corretamente
    const logString = JSON.stringify(logEntry);

    switch (level) {
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
      case 'debug':
        console.debug(logString);
        break;
    }
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return String(error);
  }

  info(message: string, payload?: Omit<EdgeLogPayload, 'message' | 'error'>) {
    this.log('info', { message, ...payload });
  }

  warn(message: string, payload?: Omit<EdgeLogPayload, 'message' | 'error'>) {
    this.log('warn', { message, ...payload });
  }

  error(message: string, error?: unknown, payload?: Omit<EdgeLogPayload, 'message' | 'error'>) {
    this.log('error', { message, error, ...payload });
  }

  debug(message: string, payload?: Omit<EdgeLogPayload, 'message' | 'error'>) {
    this.log('debug', { message, ...payload });
  }
}

export const logger = new EdgeLogger();
