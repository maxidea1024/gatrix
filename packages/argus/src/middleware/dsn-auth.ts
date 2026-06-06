import { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../utils/logger';
import { ArgusDsnKey } from '../types/issues';
import { dsnStore } from '../utils/dsn-store';

const logger = createLogger('dsn-auth');

export interface DsnAuthResult {
  projectId: string; // gatrix project ID (ULID)
  dsnKey: ArgusDsnKey;
}

/**
 * Resolve a public key to a project.
 * Uses in-memory DsnStore (O(1) lookup, no Redis/MySQL calls).
 */
export function resolveDsn(publicKey: string): DsnAuthResult | null {
  return dsnStore.lookup(publicKey);
}

/**
 * Fastify preHandler hook for DSN authentication.
 * Expects `Authorization: Bearer <publicKey>` header.
 * Sets `request.argusAuth` with the resolved project info.
 */
export async function dsnAuthHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      error: 'Unauthorized',
      message:
        'Missing or invalid Authorization header. Expected: Bearer <publicKey>',
    });
    return;
  }

  const publicKey = authHeader.slice(7).trim();

  if (!publicKey) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Empty public key',
    });
    return;
  }

  const auth = resolveDsn(publicKey);

  if (!auth) {
    logger.warn('DSN authentication failed', {
      publicKey: publicKey.slice(0, 8) + '...',
    });
    reply.code(403).send({
      error: 'Forbidden',
      message: 'Invalid or inactive DSN key',
    });
    return;
  }

  // Attach auth result to request
  (request as any).argusAuth = auth;
}
