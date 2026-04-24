import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import * as crypto from 'crypto';
import axios from 'axios';
import { GatrixError } from '../middleware/error-handler';
import { asyncHandler } from '../utils/async-handler';
import { createLogger } from '../config/logger';
import { CcuHistoryModel } from '../models/ccu-history';
import serviceDiscoveryService from '../services/service-discovery-service';

const logger = createLogger('PlayerConnectionsController');

// Timeout for admind API requests (ms)
const ADMIND_TIMEOUT = 8000;

// AES-256-CBC decryption for authd payment stats
const PAYMENT_KEY =
  'a3f8c2e1b4d7609582746f1e3a9b0c5d8e2f1a4b7c6d9e0f3a2b5c8d1e4f7a00';
const PAYMENT_IV = 'e7c3a1f9b2d8046583716e2f4a0b9c5d';

function decryptAES256CBC(encryptedBase64: string): string {
  const key = Buffer.from(PAYMENT_KEY, 'hex');
  const iv = Buffer.from(PAYMENT_IV, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Helper: get admind base URL via service discovery.
 * Finds the first ready admind instance and returns its internalApi URL.
 */
async function getAdmindApiUrl(): Promise<string> {
  const instances = await serviceDiscoveryService.getServices('admind');
  const ready = instances.filter((i) => i.status === 'ready');
  if (ready.length === 0) {
    throw new GatrixError(
      'No admind instances found via service discovery. Ensure admind is registered and running.',
      503
    );
  }
  const inst = ready[0];
  const port = inst.ports?.internalApi;
  if (!port || !inst.internalAddress) {
    throw new GatrixError(
      'admind instance has no internalApi port configured',
      503
    );
  }
  return `http://${inst.internalAddress}:${port}`;
}

/**
 * Helper: get authd base URL via service discovery (externalApi port).
 */
async function getAuthdApiUrl(): Promise<string> {
  const instances = await serviceDiscoveryService.getServices('authd');
  const ready = instances.filter((i) => i.status === 'ready');
  if (ready.length === 0) {
    throw new GatrixError(
      'No authd instances found via service discovery.',
      503
    );
  }
  const inst = ready[0];
  const port = inst.ports?.externalApi;
  if (!port || !inst.internalAddress) {
    throw new GatrixError(
      'authd instance has no externalApi port configured',
      503
    );
  }
  return `http://${inst.internalAddress}:${port}`;
}

/**
 * Fetch helper for admind Gatrix REST API
 */
async function admindRequest(
  baseUrl: string,
  method: 'GET' | 'POST',
  path: string,
  body?: any
): Promise<any> {
  const url = `${baseUrl}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIND_TIMEOUT);

  try {
    const options: RequestInit = {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new GatrixError(
        `Admind API returned HTTP ${response.status}: ${text}`,
        502
      );
    }

    return response.json();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err instanceof GatrixError) throw err;
    if (err.name === 'AbortError') {
      throw new GatrixError('Admind API request timed out', 504);
    }
    logger.error('Admind API connection failed', {
      url,
      method,
      error: err.message,
      code: err.code,
      cause: err.cause?.message || err.cause?.code || undefined,
    });
    throw new GatrixError(`Admind API connection failed: ${err.message}`, 502);
  }
}

export class PlayerConnectionsController {
  /**
   * GET /ccu
   * Proxy real-time CCU from admind Gatrix REST API
   */
  static getCcu = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const admindUrl = await getAdmindApiUrl();
      const data = await admindRequest(admindUrl, 'GET', '/gatrix/v1/ccu');

      // Transform response for frontend:
      // admind returns: { total, botTotal, worlds: [{ worldId, userCount, botCount }] }
      res.json({
        success: true,
        data: {
          total: data.total || 0,
          botTotal: data.botTotal || 0,
          worlds: (data.worlds || []).map((w: any) => ({
            worldId: w.worldId,
            name: w.worldId, // worldId is the name in this context
            count: w.userCount || 0,
            botCount: w.botCount || 0,
          })),
        },
      });
    }
  );

  /**
   * GET /ccu/history?from=...&to=...&worldId=...
   * Query CCU history from the local database for graphing
   */
  static getCcuHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment is required', 400);
      }

      const { from, to, worldId } = req.query;

      // Default: last 24 hours
      const now = new Date();
      const fromDate = from
        ? new Date(from as string)
        : new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : now;

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new GatrixError(
          'Invalid date format for from/to parameters',
          400
        );
      }

      const records = await CcuHistoryModel.getHistory(
        environmentId,
        fromDate,
        toDate,
        worldId === 'null' ? null : (worldId as string | undefined)
      );

      res.json({
        success: true,
        data: { records },
      });
    }
  );

  /**
   * GET /users
   * Query connected user data from admind gatrix API.
   */
  static getConnectedUsers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit, worldId, search, sortBy, sortDesc } = req.query;

      const admindUrl = await getAdmindApiUrl();

      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', String(page));
      if (limit) queryParams.append('limit', String(limit));
      if (worldId) queryParams.append('worldId', String(worldId));
      if (search) queryParams.append('search', String(search));
      if (sortBy) queryParams.append('sortBy', String(sortBy));
      if (sortDesc !== undefined)
        queryParams.append('sortDesc', String(sortDesc));

      const queryStr = queryParams.toString()
        ? `?${queryParams.toString()}`
        : '';

      try {
        const response = await axios.get(
          `${admindUrl}/gatrix/v1/users${queryStr}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );

        res.json({
          success: true,
          data: response.data,
        });
      } catch (error: any) {
        const upstreamStatus = error.response?.status;
        const upstreamData = error.response?.data;
        const requestUrl = `${admindUrl}/gatrix/v1/users${queryStr}`;
        logger.error('Failed to get connected users from admind', {
          message: error.message,
          code: error.code,
          url: requestUrl,
          upstreamStatus,
          upstreamError: upstreamData?.error || upstreamData,
        });
        const detail = upstreamStatus
          ? `Admind returned ${upstreamStatus}: ${upstreamData?.error || error.message}`
          : `Admind unreachable: ${error.code || error.message}`;
        throw new GatrixError(
          `Failed to retrieve connected users: ${detail}`,
          502,
          true,
          'UPSTREAM_ERROR',
          {
            admindUrl: requestUrl,
            upstreamStatus: upstreamStatus || null,
            upstreamError: upstreamData?.error || null,
            errorCode: error.code || null,
            errorMessage: error.message,
          }
        );
      }
    }
  );

  /**
   * GET /all-players
   * Query all registered players from game auth DB via admind.
   * Server-side pagination is enforced.
   */
  static getAllPlayers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        page,
        limit,
        search,
        worldId,
        sortBy,
        sortDesc,
        isOnline,
        loginPlatform,
      } = req.query;

      const admindUrl = await getAdmindApiUrl();

      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', String(page));
      if (limit) queryParams.append('limit', String(limit));
      if (search) queryParams.append('search', String(search));
      if (worldId) queryParams.append('worldId', String(worldId));
      if (sortBy) queryParams.append('sortBy', String(sortBy));
      if (sortDesc !== undefined)
        queryParams.append('sortDesc', String(sortDesc));
      if (isOnline !== undefined && isOnline !== '')
        queryParams.append('isOnline', String(isOnline));
      if (loginPlatform)
        queryParams.append('loginPlatform', String(loginPlatform));

      const queryStr = queryParams.toString()
        ? `?${queryParams.toString()}`
        : '';

      try {
        const response = await axios.get(
          `${admindUrl}/gatrix/v1/all-players${queryStr}`,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          }
        );

        res.json({
          success: true,
          data: response.data,
        });
      } catch (error: any) {
        logger.error('Failed to get all players from admind:', error.message);
        throw new GatrixError(
          'Failed to retrieve all players from game server',
          502
        );
      }
    }
  );

  /**
   * GET /all-characters
   * Returns all characters from admind (one row per character).
   */
  static getAllCharacters = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        page,
        limit,
        search,
        worldId,
        sortBy,
        sortDesc,
        isOnline,
        loginPlatform,
      } = req.query;

      const admindUrl = await getAdmindApiUrl();

      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', String(page));
      if (limit) queryParams.append('limit', String(limit));
      if (search) queryParams.append('search', String(search));
      if (worldId) queryParams.append('worldId', String(worldId));
      if (sortBy) queryParams.append('sortBy', String(sortBy));
      if (sortDesc !== undefined)
        queryParams.append('sortDesc', String(sortDesc));
      if (isOnline !== undefined && isOnline !== '')
        queryParams.append('isOnline', String(isOnline));
      if (loginPlatform)
        queryParams.append('loginPlatform', String(loginPlatform));

      const queryStr = queryParams.toString()
        ? `?${queryParams.toString()}`
        : '';

      try {
        const response = await axios.get(
          `${admindUrl}/gatrix/v1/all-characters${queryStr}`,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          }
        );

        res.json({
          success: true,
          data: response.data,
        });
      } catch (error: any) {
        logger.error(
          'Failed to get all characters from admind:',
          error.message
        );
        throw new GatrixError(
          'Failed to retrieve all characters from game server',
          502
        );
      }
    }
  );

  /**
   * POST /kick
   * Proxy kick request to admind Gatrix REST API
   * Body: { type: 'all' | 'world' | 'user', worldId?, userId?, message? }
   */
  static kickPlayers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { type, worldId, userId } = req.body;

      if (!type || !['all', 'world', 'user'].includes(type)) {
        throw new GatrixError(
          'Invalid kick type. Must be "all", "world", or "user"',
          400
        );
      }

      const admindUrl = await getAdmindApiUrl();

      logger.info(
        `Player kick requested: type=${type}, worldId=${worldId}, userId=${userId}`,
        {
          user: req.user?.userId,
        }
      );

      let data: any;

      if (type === 'all') {
        data = await admindRequest(admindUrl, 'POST', '/gatrix/v1/kick/all', {
          ...(worldId ? { gameServerId: worldId } : {}),
        });
      } else if (type === 'world') {
        if (!worldId) {
          throw new GatrixError('worldId is required for world kick', 400);
        }
        data = await admindRequest(admindUrl, 'POST', '/gatrix/v1/kick/all', {
          gameServerId: worldId,
        });
      } else if (type === 'user') {
        if (!userId) {
          throw new GatrixError('userId is required for user kick', 400);
        }
        data = await admindRequest(admindUrl, 'POST', '/gatrix/v1/kick/user', {
          userId,
        });
      }

      res.json({
        success: true,
        data,
        message: 'Kick command sent successfully',
      });
    }
  );

  /**
   * GET /sync-online-status/preview
   * Dry-run: returns stale entries that would be fixed, with user details.
   */
  static previewSyncOnlineStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const admindUrl = await getAdmindApiUrl();
      const data = await admindRequest(
        admindUrl,
        'GET',
        '/gatrix/v1/sync-online-status/preview'
      );

      res.json({
        success: true,
        data,
      });
    }
  );

  /**
   * POST /sync-online-status
   * Triggers admind to cross-reference actual connected users with DB isOnline flags
   * and fix stale entries.
   */
  static syncOnlineStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const admindUrl = await getAdmindApiUrl();
      const data = await admindRequest(
        admindUrl,
        'POST',
        '/gatrix/v1/sync-online-status'
      );

      logger.info('Online status sync completed', {
        user: req.user?.userId,
        fixed: data.fixed,
        totalDbOnline: data.totalDbOnline,
        totalActualOnline: data.totalActualOnline,
      });

      res.json({
        success: true,
        data,
      });
    }
  );

  /**
   * GET /payment-stats
   * Retrieve payment statistics from authd via service discovery.
   * IP-restricted: only allowed from whitelisted IPs.
   */
  static getPaymentStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      // Find authd via service discovery
      const authUrl = await getAuthdApiUrl();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ADMIND_TIMEOUT);

      try {
        const response = await fetch(`${authUrl}/refreshCache`, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new GatrixError(
            `authd payment stats returned ${response.status}`,
            502
          );
        }

        const encrypted: any = await response.json();

        logger.info('authd refreshCache response received', {
          hasData: !!encrypted?.data,
          algorithm: encrypted?.algorithm,
        });

        // Decrypt AES-256-CBC response from authd
        const decrypted = decryptAES256CBC(encrypted.data);
        const stats = JSON.parse(decrypted);

        logger.info('Payment stats decrypted', {
          totalCount: stats.totalCount,
          totalAmount: stats.totalAmount,
        });

        // Return only summary: totalCount and totalAmount
        res.json({
          success: true,
          data: {
            totalCount: stats.totalCount || 0,
            totalAmount: stats.totalAmount || 0,
          },
        });
      } catch (err: any) {
        clearTimeout(timeout);
        if (err instanceof GatrixError) throw err;
        if (err.name === 'AbortError') {
          throw new GatrixError('authd payment stats request timed out', 504);
        }
        logger.error('Failed to get payment stats from authd', {
          error: err.message,
        });
        throw new GatrixError(
          `Failed to retrieve payment stats: ${err.message}`,
          502
        );
      }
    }
  );
}
