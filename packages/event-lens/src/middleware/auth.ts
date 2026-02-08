import { FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import logger from '../utils/logger';
import { AnalyticsClient } from '../types';

declare module 'fastify' {
  interface FastifyRequest {
    client?: AnalyticsClient;
  }
}

export async function authenticateClient(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const clientId = request.headers['event-lens-client-id'] as string;
  const clientSecret = request.headers['event-lens-client-secret'] as string;

  if (!clientId || !clientSecret) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing authentication headers: event-lens-client-id and event-lens-client-secret',
    });
  }

  try {
    const [rows] = await mysqlPool.query(
      'SELECT * FROM analytics_clients WHERE id = ? AND secret = ?',
      [clientId, clientSecret]
    );

    const clients = rows as AnalyticsClient[];
    if (clients.length === 0) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid client credentials',
      });
    }

    // 클라이언트 정보를 request에 추가
    request.client = clients[0];

    logger.debug('Client authenticated', {
      clientId,
      projectId: clients[0].projectId,
    });
  } catch (error) {
    logger.error('Authentication failed', { error, clientId });
    return reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

export async function requireWriteAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.client) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Client not authenticated',
    });
  }

  if (request.client.type !== 'write' && request.client.type !== 'root') {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Write access required',
    });
  }
}

export async function requireReadAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.client) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Client not authenticated',
    });
  }

  if (request.client.type !== 'read' && request.client.type !== 'root') {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Read access required',
    });
  }
}

export default {
  authenticateClient,
  requireWriteAccess,
  requireReadAccess,
};
