import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import axios from 'axios';
import { GatrixError } from '../middleware/error-handler';
import { asyncHandler } from '../utils/async-handler';
import { createLogger } from '../config/logger';
import VarsModel from '../models/vars';
import { CcuHistoryModel } from '../models/ccu-history';

const logger = createLogger('PlayerConnectionsController');

// Timeout for admind API requests (ms)
const ADMIND_TIMEOUT = 8000;

/**
 * Helper: get admindApiUrl for the current environment
 * Priority: vars (Network Settings) > ADMIND_API_URL env var
 */
async function getAdmindApiUrl(environmentId: string): Promise<string> {
  const url = await VarsModel.get('admindApiUrl', environmentId);
  const resolved = url || process.env.ADMIND_API_URL || '';
  if (!resolved) {
    throw new GatrixError(
      'admindApiUrl is not configured. Please set it in System Settings > Network Settings or ADMIND_API_URL env var.',
      400
    );
  }
  // Trim trailing slash
  return resolved.replace(/\/+$/, '');
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
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment is required', 400);
      }

      const admindUrl = await getAdmindApiUrl(environmentId);
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
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment is required', 400);
      }

      const { page, limit, worldId, search, sortBy, sortDesc } = req.query;

      const admindUrl = await getAdmindApiUrl(environmentId);

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
            timeout: 5000,
          }
        );

        res.json({
          success: true,
          data: response.data,
        });
      } catch (error: any) {
        logger.error(
          'Failed to get connected users from admind:',
          error.message
        );
        throw new GatrixError(
          'Failed to retrieve connected users from game server',
          502
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
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment is required', 400);
      }

      const { page, limit, search, worldId, sortBy, sortDesc, isOnline, loginPlatform } = req.query;

      const admindUrl = await getAdmindApiUrl(environmentId);

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
        logger.error(
          'Failed to get all players from admind:',
          error.message
        );
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
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment is required', 400);
      }

      const { page, limit, search, worldId, sortBy, sortDesc, isOnline, loginPlatform } = req.query;

      const admindUrl = await getAdmindApiUrl(environmentId);

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
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment is required', 400);
      }

      const { type, worldId, userId } = req.body;

      if (!type || !['all', 'world', 'user'].includes(type)) {
        throw new GatrixError(
          'Invalid kick type. Must be "all", "world", or "user"',
          400
        );
      }

      const admindUrl = await getAdmindApiUrl(environmentId);

      logger.info(
        `Player kick requested: type=${type}, worldId=${worldId}, userId=${userId}`,
        {
          environmentId,
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
}
