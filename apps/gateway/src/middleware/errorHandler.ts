import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const { method, url } = request;
    const statusCode = error.statusCode || 500;

    // Log do erro
    request.log.error({
      err: error,
      req: { method, url },
      statusCode,
    }, 'Erro não tratado');

    // Rate limit errors
    if (statusCode === 429) {
      return reply.status(429).send({
        error: 'Rate limit exceeded',
        message: 'Muitas tentativas. Tente novamente em alguns minutos.',
      });
    }

    // Validation errors (Zod, etc)
    if (statusCode === 400) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Dados inválidos fornecidos.',
      });
    }

    // Auth errors
    if (statusCode === 401) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Acesso não autorizado.',
      });
    }

    // Generic server error
    return reply.status(statusCode >= 500 ? statusCode : 500).send({
      error: 'Internal Server Error',
      message: 'Erro interno do servidor. Tente novamente mais tarde.',
    });
  });
}
