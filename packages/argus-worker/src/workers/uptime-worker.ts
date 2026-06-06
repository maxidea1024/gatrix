import axios from 'axios';
import { mysqlPool, redis, COUNTERS, createLogger } from '@gatrix/argus';

const logger = createLogger('uptime-worker');

const LOOP_INTERVAL_MS = 10000; // Check every 10 seconds
const MAX_CONCURRENT_CHECKS = 10; // Limit concurrent HTTP requests

interface CheckResult {
  monitorId: number;
  projectId: string;
  prevStatus: string;
  status: string;
  responseMs: number;
  statusCode: number | null;
  errorMessage: string | null;
  monitorName: string;
  monitorUrl: string;
  // For response capture on failure
  responseHeaders: string | null;
  responseBody: string | null;
  // Monitor config (carried for threshold evaluation)
  downtimeThreshold: number;
  recoveryThreshold: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  isMuted: boolean;
}

export class UptimeWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    logger.info('Uptime worker started');

    this.processLoop().catch((error) => {
      logger.error('Uptime worker loop crashed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async close(): Promise<void> {
    this.running = false;
    logger.info('Uptime worker stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.pollMonitors();
      } catch (error) {
        logger.error('Error in uptime processing loop', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await this.sleep(LOOP_INTERVAL_MS);
    }
  }

  private async pollMonitors(): Promise<void> {
    // Get monitors with their latest checkin time (single query, no N+1)
    const [rows]: any = await mysqlPool.query(`
      SELECT m.*, 
        (SELECT MAX(checked_at) FROM g_argus_uptimeCheckins c WHERE c.monitor_id = m.id) as last_checked_at
      FROM g_argus_uptimeMonitors m
      WHERE m.status != 'disabled'
    `);

    const now = Date.now();
    const dueMonitors = rows.filter((monitor: any) => {
      const lastCheck = monitor.last_checked_at ? new Date(monitor.last_checked_at).getTime() : 0;
      const intervalMs = monitor.interval_seconds * 1000;
      return now - lastCheck >= intervalMs;
    });

    if (dueMonitors.length === 0) return;

    // Parallel HTTP checks with concurrency limit
    const results: CheckResult[] = [];
    for (let i = 0; i < dueMonitors.length; i += MAX_CONCURRENT_CHECKS) {
      const batch = dueMonitors.slice(i, i + MAX_CONCURRENT_CHECKS);
      const batchResults = await Promise.allSettled(
        batch.map((monitor: any) => this.httpCheck(monitor))
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled') results.push(r.value);
      }
    }

    if (results.length === 0) return;

    // Process each result individually (avoids CASE WHEN deadlocks)
    for (const result of results) {
      await this.processCheckResult(result);
    }
  }

  /**
   * Process a single check result:
   *   1. INSERT checkin record
   *   2. Update consecutive counters
   *   3. Evaluate thresholds (Sentry's downtime_threshold / recovery_threshold)
   *   4. Transition status and optionally create/resolve issue
   *   5. Capture response on failure (if enabled)
   */
  private async processCheckResult(result: CheckResult): Promise<void> {
    // 1. INSERT checkin record
    const [insertResult]: any = await mysqlPool.query(
      `INSERT INTO g_argus_uptimeCheckins (monitor_id, status, response_ms, status_code, error_message)
       VALUES (?, ?, ?, ?, ?)`,
      [result.monitorId, result.status, result.responseMs, result.statusCode, result.errorMessage]
    );

    // 2. Update consecutive counters
    let newConsecutiveFailures = result.consecutiveFailures;
    let newConsecutiveSuccesses = result.consecutiveSuccesses;
    let newStatus = result.prevStatus;

    if (result.status === 'up') {
      newConsecutiveFailures = 0;
      newConsecutiveSuccesses++;
    } else {
      newConsecutiveSuccesses = 0;
      newConsecutiveFailures++;
    }

    // 3. Evaluate thresholds (mirrors Sentry's UptimeDetectorHandler)
    const downtimeThreshold = result.downtimeThreshold || 3;
    const recoveryThreshold = result.recoveryThreshold || 1;

    if (result.status === 'down' && newConsecutiveFailures >= downtimeThreshold) {
      // Transition to 'down' — threshold met
      if (result.prevStatus !== 'down') {
        newStatus = 'down';
        logger.info('Uptime monitor transitioning to DOWN', {
          monitorId: result.monitorId,
          name: result.monitorName,
          consecutiveFailures: newConsecutiveFailures,
          threshold: downtimeThreshold,
        });
        // Create issue only if not muted
        if (!result.isMuted) {
          await this.createIssue({
            id: result.monitorId,
            project_id: result.projectId,
            name: result.monitorName,
            url: result.monitorUrl,
          });
        }
      }
    } else if (result.status === 'up' && newConsecutiveSuccesses >= recoveryThreshold) {
      // Transition to 'up' — recovery threshold met
      if (result.prevStatus === 'down') {
        newStatus = 'up';
        logger.info('Uptime monitor recovered to UP', {
          monitorId: result.monitorId,
          name: result.monitorName,
          consecutiveSuccesses: newConsecutiveSuccesses,
          threshold: recoveryThreshold,
        });
        // Auto-resolve open issue
        await this.resolveIssue(result.monitorId, result.projectId);
      }
    }

    // 4. Update monitor state (individual UPDATE, no CASE WHEN)
    await mysqlPool.query(
      `UPDATE g_argus_uptimeMonitors
         SET status = ?,
             consecutive_failures = ?,
             consecutive_successes = ?
       WHERE id = ?`,
      [newStatus, newConsecutiveFailures, newConsecutiveSuccesses, result.monitorId]
    );

    // 5. Capture response on failure (mirrors Sentry's UptimeResponseCapture)
    if (result.status === 'down' && result.responseHeaders) {
      try {
        await mysqlPool.query(
          `INSERT INTO g_argus_uptimeResponseCaptures
            (monitor_id, checkin_id, status_code, response_headers, response_body)
           VALUES (?, ?, ?, ?, ?)`,
          [
            result.monitorId,
            insertResult.insertId,
            result.statusCode,
            result.responseHeaders,
            result.responseBody ? result.responseBody.substring(0, 65536) : null, // Cap at 64KB
          ]
        );
      } catch (captureErr) {
        logger.warn('Failed to capture response', {
          monitorId: result.monitorId,
          error: captureErr instanceof Error ? captureErr.message : String(captureErr),
        });
      }
    }
  }

  /**
   * Perform a single HTTP check and return the result.
   * Supports:
   *   - Custom timeout (timeout_ms)
   *   - Custom headers (JSON)
   *   - Custom body (for POST/PUT/PATCH)
   *   - Expected status code matching
   */
  private async httpCheck(monitor: any): Promise<CheckResult> {
    const startTime = Date.now();
    let status = 'up';
    let responseMs = 0;
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    let responseHeaders: string | null = null;
    let responseBody: string | null = null;

    try {
      // Build headers from monitor config
      let headers: Record<string, string> = {};
      if (monitor.headers) {
        try {
          headers = typeof monitor.headers === 'string' ? JSON.parse(monitor.headers) : monitor.headers;
        } catch {
          // Invalid headers JSON, use empty
        }
      }

      const response = await axios.request({
        url: monitor.url,
        method: (monitor.method || 'GET').toUpperCase(),
        timeout: monitor.timeout_ms || 10000,
        headers,
        data: monitor.body || undefined,
        // Don't throw on non-2xx so we can check expected status codes
        validateStatus: () => true,
        // Limit response size to avoid memory issues
        maxContentLength: 1024 * 1024, // 1MB
      });

      responseMs = Date.now() - startTime;
      statusCode = response.status;

      // Determine if status code is acceptable
      let expectedCodes: number[] | null = null;
      if (monitor.expected_status_codes) {
        try {
          expectedCodes = typeof monitor.expected_status_codes === 'string'
            ? JSON.parse(monitor.expected_status_codes)
            : monitor.expected_status_codes;
        } catch {
          // Invalid JSON, fall through to default behavior
        }
      }

      if (expectedCodes && expectedCodes.length > 0) {
        // Check against explicit expected codes
        if (!expectedCodes.includes(statusCode)) {
          status = 'down';
          errorMessage = `Unexpected status code: ${statusCode} (expected: ${expectedCodes.join(', ')})`;
        }
      } else {
        // Default: any 2xx is OK
        if (statusCode < 200 || statusCode >= 300) {
          status = 'down';
          errorMessage = `HTTP ${statusCode}`;
        }
      }

      // Capture response data for failure debugging
      if (status === 'down') {
        try {
          responseHeaders = JSON.stringify(response.headers);
          responseBody = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);
        } catch {
          // Best effort
        }
      }
    } catch (error: any) {
      status = 'down';
      responseMs = Date.now() - startTime;
      errorMessage = error.code === 'ECONNABORTED'
        ? `Timeout after ${monitor.timeout_ms || 10000}ms`
        : (error.message || 'Unknown error');

      logger.warn('Uptime check failed', {
        monitorId: monitor.id,
        url: monitor.url,
        error: errorMessage,
      });
    }

    return {
      monitorId: monitor.id,
      projectId: monitor.project_id,
      prevStatus: monitor.status,
      status,
      responseMs,
      statusCode,
      errorMessage,
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      responseHeaders,
      responseBody,
      downtimeThreshold: monitor.downtime_threshold || 3,
      recoveryThreshold: monitor.recovery_threshold || 1,
      consecutiveFailures: monitor.consecutive_failures || 0,
      consecutiveSuccesses: monitor.consecutive_successes || 0,
      isMuted: !!monitor.is_muted,
    };
  }

  private async createIssue(monitor: any): Promise<void> {
    const hash = require('crypto').createHash('md5').update(`uptime_down_${monitor.id}`).digest('hex');
    
    // Check if unresolved issue already exists
    const [existing]: any = await mysqlPool.query(
      `SELECT id FROM g_argus_issues WHERE project_id = ? AND primary_hash = ? AND status = 'unresolved'`,
      [monitor.project_id, hash]
    );

    if (existing.length > 0) {
      await mysqlPool.query(
        `UPDATE g_argus_issues SET times_seen = times_seen + 1, last_seen = NOW() WHERE id = ?`,
        [existing[0].id]
      );
      return;
    }

    // Atomic short_id via Redis (consistent with issue-grouper)
    const nextShortId = await redis.hincrby(
      COUNTERS.ISSUE_SHORT_ID(monitor.project_id),
      'seq',
      1
    );

    await mysqlPool.query(
      `INSERT IGNORE INTO g_argus_issues (
        project_id, short_id, title, culprit, type, level, platform, 
        primary_hash, first_seen, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        monitor.project_id,
        nextShortId,
        `Uptime Monitor Down: ${monitor.name}`,
        monitor.url,
        'uptime_error',
        'error',
        'other',
        hash
      ]
    );
  }

  /**
   * Auto-resolve an open uptime issue when the monitor recovers.
   * Mirrors Sentry's resolve_incident_group.
   */
  private async resolveIssue(monitorId: number, projectId: string): Promise<void> {
    const hash = require('crypto').createHash('md5').update(`uptime_down_${monitorId}`).digest('hex');

    await mysqlPool.query(
      `UPDATE g_argus_issues SET status = 'resolved' 
       WHERE project_id = ? AND primary_hash = ? AND status = 'unresolved'`,
      [projectId, hash]
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
