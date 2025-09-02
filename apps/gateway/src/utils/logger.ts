export interface LogContext {
  chatId?: number;
  userId?: number;
  conversationId?: string;
  action?: string;
  actionIndex?: number;
  timestamp?: number;
  duration?: number;
  error?: Error;
  operation?: string;
  [key: string]: any; // Permitir propriedades adicionais
}

export class StructuredLogger {
  private formatLog(level: string, message: string, context: LogContext) {
    const timestamp = new Date().toISOString();
    const { error, ...rest } = context;
    const logData = {
      timestamp,
      level,
      message,
      ...rest,
      ...(error instanceof Error
        ? { error_message: error.message, error_stack: error.stack }
        : error
        ? { error }
        : {}),
    };
    return JSON.stringify(logData);
  }

  info(message: string, context: LogContext = {}) {
    // eslint-disable-next-line no-console
    console.log(this.formatLog('info', message, context));
  }

  warn(message: string, context: LogContext = {}) {
    // eslint-disable-next-line no-console
    console.warn(this.formatLog('warn', message, context));
  }

  error(message: string, context: LogContext = {}) {
    // eslint-disable-next-line no-console
    console.error(this.formatLog('error', message, context));
  }

  // Log específico para operações de chat
  chatOperation(operation: string, context: LogContext) {
    this.info(`Chat operation: ${operation}`, {
      operation: 'chat',
      action: operation,
      ...context,
    });
  }

  // Log específico para operações de auth
  authOperation(operation: string, context: LogContext) {
    this.info(`Auth operation: ${operation}`, {
      operation: 'auth',
      action: operation,
      ...context,
    });
  }

  // Log de performance
  performance(operation: string, duration: number, context: LogContext = {}) {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      operation: 'performance',
      action: operation,
      duration,
      ...context,
    });
  }
}

// Helper para medir tempo de operações
export function measureTime() {
  const start = Date.now();
  return () => Date.now() - start;
}
