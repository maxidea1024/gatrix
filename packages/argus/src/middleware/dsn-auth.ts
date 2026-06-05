import { FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { redis } from '../config/redis';
import { createLogger } from '../utils/logger';
import { ArgusDsnKey } from '../types/issues';

const logger = createLogger('dsn-auth');

const DSN_CACHE_PREFIX = 'argus:dsn:';
const DSN_CACHE_TTL = 300; // 5 minutes

export interface DsnAuthResult {
  projectId: string; // gatrix project ID (ULID)
  dsnKey: ArgusDsnKey;
}

/**
 * Resolve a public key to a project. Uses Redis cache.
 */
export async function resolveDsn(publicKey: string): Promise<DsnAuthResult | null> {
  // Check Redis cache first
  const cacheKey = `${DSN_CACHE_PREFIX}${publicKey}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Query MySQL
  const [rows] = await mysqlPool.query(
    `SELECT d.*, p.gatrix_project_id
     FROM g_argus_dsnKeys d
     JOIN g_argus_projects p ON d.project_id = p.id
     WHERE d.public_key = ? AND d.is_active = 1`,
    [publicKey]
  );

  const results = rows as any[];
  if (results.length === 0) {
    return null;
  }

  const row = results[0];
  const result: DsnAuthResult = {
    projectId: row.gatrix_project_id,
    dsnKey: {
      id: row.id,
      project_id: row.project_id,
      label: row.label,
      public_key: row.public_key,
      secret_key: row.secret_key,
      is_active: row.is_active === 1,
      rate_limit_window: row.rate_limit_window,
      rate_limit_count: row.rate_limit_count,
      created_at: row.created_at,
    },
  };

  // Cache for 5 minutes
  await redis.set(cacheKey, JSON.stringify(result), 'EX', DSN_CACHE_TTL);

  return result;
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
      message: 'Missing or invalid Authorization header. Expected: Bearer <publicKey>',
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

  const auth = await resolveDsn(publicKey);

  if (!auth) {
    logger.warn('DSN authentication failed', { publicKey: publicKey.slice(0, 8) + '...' });
    reply.code(403).send({
      error: 'Forbidden',
      message: 'Invalid or inactive DSN key',
    });
    return;
  }

  // Attach auth result to request
  (request as any).argusAuth = auth;
}
