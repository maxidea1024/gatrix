import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger';

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: request.method,
    url: request.url,
    statusCode: error.statusCode,
  });

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  reply.code(statusCode).send({
    error: error.name || 'Error',
    message,
    statusCode,
  });
}

export default errorHandler;
