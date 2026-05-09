import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';

import { GatrixError } from '../middleware/error-handler';
import { asyncHandler } from '../utils/async-handler';
import { createLogger } from '../config/logger';
import serviceDiscoveryService from '../services/service-discovery-service';

const logger = createLogger('RippleCmsController');

const ADMIND_TIMEOUT = 15000; // CMS operations may take longer

/**
 * Get admind base URL via service discovery.
 */
async function getAdmindApiUrl(environmentId?: string): Promise<string> {
  const instances = await serviceDiscoveryService.getServices('admind');
  let ready = instances.filter((i) => i.status === 'ready');

  if (environmentId && ready.length > 0) {
    const envFiltered = ready.filter(
      (i) => i.labels.environmentId === environmentId
    );
    if (envFiltered.length > 0) {
      ready = envFiltered;
    } else {
      throw new GatrixError(
        `No admind instance registered for this environment.`,
        404
      );
    }
  }

  if (ready.length === 0) {
    throw new GatrixError(
      'No admind instances found via service discovery.',
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
 * Proxy helper for admind Gatrix REST API
 */
async function admindRequest(
  baseUrl: string,
  method: 'GET' | 'POST' | 'DELETE',
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
    });
    throw new GatrixError(`Admind API connection failed: ${err.message}`, 502);
  }
}

export class RippleCmsController {
  // ── Ripple Endpoints ──

  /** GET /ripple/status — Ripple health + refreshable list */
  static getRippleStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const admindUrl = await getAdmindApiUrl(req.environmentId);

      const [health, refreshables] = await Promise.all([
        admindRequest(admindUrl, 'GET', '/ripple/health'),
        admindRequest(admindUrl, 'GET', '/ripple/refreshables'),
      ]);

      res.json({
        success: true,
        data: {
          health,
          refreshables: refreshables.items || [],
          registeredCount: refreshables.count || 0,
          admindUrl,
        },
      });
    }
  );

  /** POST /ripple/refresh — Trigger a ripple refresh */
  static triggerRefresh = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { pattern, cascade, triggeredBy, metadata } = req.body;

      if (!pattern || typeof pattern !== 'string') {
        throw new GatrixError('Missing or invalid "pattern"', 400);
      }

      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const data = await admindRequest(admindUrl, 'POST', '/ripple/refresh', {
        pattern,
        cascade: !!cascade,
        triggeredBy: triggeredBy || req.user?.email || 'gatrix',
        metadata,
      });

      res.json({ success: true, data });
    }
  );

  /** GET /ripple/metrics — Ripple Prometheus metrics */
  static getRippleMetrics = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const data = await admindRequest(admindUrl, 'GET', '/ripple/metrics');
      res.json({ success: true, data });
    }
  );

  /** GET /ripple/history — Ripple Execution Event History */
  static getRippleHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { requestId, limit, handlerKey } = req.query;
      const admindUrl = await getAdmindApiUrl(req.environmentId);

      const params = new URLSearchParams();
      if (requestId) params.append('requestId', requestId as string);
      if (handlerKey) params.append('handlerKey', handlerKey as string);
      if (limit) params.append('limit', limit as string);

      const queryString = params.toString();
      const url = `/gatrix/v1/cms/execution-log${queryString ? `?${queryString}` : ''}`;

      const data = await admindRequest(admindUrl, 'GET', url);
      res.json({ success: true, data });
    }
  );

  // ── CMS Endpoints ──

  /** GET /cms/tables — List all CMS tables */
  static getCmsTables = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const data = await admindRequest(
        admindUrl,
        'GET',
        '/gatrix/v1/cms/tables'
      );
      res.json({ success: true, data: { ...data, admindUrl } });
    }
  );

  /** GET /cms/tables/:tableName — Get CMS table detail */
  static getCmsTableDetail = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { tableName } = req.params;
      const binaryCode = req.query.binaryCode
        ? `?binaryCode=${req.query.binaryCode}`
        : '';

      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const data = await admindRequest(
        admindUrl,
        'GET',
        `/gatrix/v1/cms/tables/${encodeURIComponent(tableName)}${binaryCode}`
      );
      res.json({ success: true, data });
    }
  );

  /** GET /cms/tables/:tableName/history — Get CMS table version history */
  static getCmsTableHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { tableName } = req.params;
      const limit = req.query.limit || 20;
      const binaryCode = req.query.binaryCode || '';
      const qs = `?limit=${limit}${binaryCode ? `&binaryCode=${binaryCode}` : ''}`;

      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const data = await admindRequest(
        admindUrl,
        'GET',
        `/gatrix/v1/cms/tables/${encodeURIComponent(tableName)}/history${qs}`
      );
      res.json({ success: true, data });
    }
  );

  /** GET /cms/tables/:tableName/history/:version/data — Get decompressed data for a specific version */
  static getCmsTableVersionData = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { tableName, version } = req.params;
      const binaryCode = req.query.binaryCode || '';
      const qs = binaryCode ? `?binaryCode=${binaryCode}` : '';

      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const data = await admindRequest(
        admindUrl,
        'GET',
        `/gatrix/v1/cms/tables/${encodeURIComponent(tableName)}/history/${version}/data${qs}`
      );
      res.json({ success: true, data });
    }
  );

  /** GET /cms/tables/:tableName/history/:version/diff — Get pre-computed diff patch for a specific version */
  static getCmsTableVersionDiff = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { tableName, version } = req.params;
      const binaryCode = req.query.binaryCode || '';
      const qs = binaryCode ? `?binaryCode=${binaryCode}` : '';

      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const url = `${admindUrl}/gatrix/v1/cms/tables/${encodeURIComponent(tableName)}/history/${version}/diff${qs}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new GatrixError(
          `Admind API returned HTTP ${response.status}: ${text}`,
          response.status === 404 ? 404 : 502
        );
      }
      const text = await response.text();
      res.type('text/plain').send(text);
    }
  );

  /** POST /cms/upload — Upload CMS table data */
  static uploadCmsTable = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { tableName, binaryCode, data, comment, refresh, cascade } =
        req.body;

      if (!tableName) {
        throw new GatrixError('Missing "tableName"', 400);
      }
      if (!data) {
        throw new GatrixError('Missing "data"', 400);
      }
      if (!comment) {
        throw new GatrixError('Missing "comment"', 400);
      }

      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const result = await admindRequest(
        admindUrl,
        'POST',
        '/gatrix/v1/cms/upload',
        {
          tableName,
          binaryCode: binaryCode || null,
          data,
          comment,
          uploadedBy: req.user?.email || 'gatrix',
          refresh: !!refresh,
          cascade: !!cascade,
        }
      );
      res.json({ success: true, data: result });
    }
  );

  /** POST /cms/rollback — Rollback CMS table to a previous version */
  static rollbackCmsTable = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { tableName, version, binaryCode, refresh } = req.body;

      if (!tableName) {
        throw new GatrixError('Missing "tableName"', 400);
      }
      if (typeof version !== 'number') {
        throw new GatrixError('Missing or invalid "version"', 400);
      }

      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const result = await admindRequest(
        admindUrl,
        'POST',
        '/gatrix/v1/cms/rollback',
        {
          tableName,
          version,
          binaryCode: binaryCode || null,
          refresh: !!refresh,
        }
      );
      res.json({ success: true, data: result });
    }
  );

  /** GET /cms/refresh-history — Get CMS Ripple refresh history */
  static getCmsRefreshHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const data = await admindRequest(
        admindUrl,
        'GET',
        '/gatrix/v1/cms/refresh-history'
      );
      res.json({ success: true, data });
    }
  );

  /** DELETE /ripple/history — Clear execution log and optionally refresh history */
  static clearRippleHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { includeHistory } = req.query;
      const admindUrl = await getAdmindApiUrl(req.environmentId);
      const qs = includeHistory === 'true' ? '?includeHistory=true' : '';
      const data = await admindRequest(
        admindUrl,
        'DELETE',
        `/gatrix/v1/cms/execution-log${qs}`
      );
      res.json({ success: true, data });
    }
  );
}
