/**
 * Simulate Data — Cron & Uptime Monitors
 *
 * Seeds MySQL monitor definitions and ClickHouse check-in time-series data.
 */
import { PROJECT_ID, DAYS_BACK } from './config';
import { randomInt, randomPick, uuid, formatDate } from './helpers';

// ── Cron Monitor definitions ──

const CRON_MONITORS = [
  { name: 'Daily Backup', slug: 'daily-backup', schedule_type: 'crontab', schedule_value: '0 3 * * *', max_runtime: 120 },
  { name: 'Hourly Leaderboard Update', slug: 'hourly-leaderboard', schedule_type: 'crontab', schedule_value: '0 * * * *', max_runtime: 15 },
  { name: 'Session Cleanup', slug: 'session-cleanup', schedule_type: 'crontab', schedule_value: '*/15 * * * *', max_runtime: 10 },
  { name: 'Weekly Analytics Report', slug: 'weekly-analytics', schedule_type: 'crontab', schedule_value: '0 6 * * 1', max_runtime: 60 },
  { name: 'Auction Expiry Scanner', slug: 'auction-expiry', schedule_type: 'crontab', schedule_value: '*/5 * * * *', max_runtime: 5 },
  { name: 'Guild Tax Collection', slug: 'guild-tax', schedule_type: 'crontab', schedule_value: '0 0 * * *', max_runtime: 30 },
  { name: 'Market Price Index', slug: 'market-price-index', schedule_type: 'interval', schedule_value: '30', schedule_unit: 'minute', max_runtime: 10 },
  { name: 'Anti-Cheat Scan', slug: 'anticheat-scan', schedule_type: 'interval', schedule_value: '10', schedule_unit: 'minute', max_runtime: 20 },
];

// ── Uptime Monitor definitions ──

const UPTIME_MONITORS = [
  { name: 'Game API', url: 'https://api.game.internal/health', interval_seconds: 60 },
  { name: 'Auth Service', url: 'https://auth.game.internal/health', interval_seconds: 60 },
  { name: 'Payment Gateway', url: 'https://payment.game.internal/health', interval_seconds: 120 },
  { name: 'Matchmaking Service', url: 'https://matchmaking.game.internal/health', interval_seconds: 60 },
  { name: 'CDN Assets', url: 'https://cdn.game.internal/status', interval_seconds: 300 },
  { name: 'WebSocket Gateway', url: 'wss://ws.game.internal/ping', interval_seconds: 30 },
  { name: 'Analytics Collector', url: 'https://analytics.game.internal/health', interval_seconds: 120 },
];

export async function generateAndInsertMonitors(
  pool: any,
  ch: any,
  chDatabase: string,
  internalProjectId: number,
): Promise<void> {
  console.log('\n📡 Generating cron & uptime monitors...');

  // Ensure ClickHouse tables exist
  try {
    await ch.exec({ query: `
      CREATE TABLE IF NOT EXISTS ${chDatabase}.cron_checkins (
        monitor_id UInt64, project_id String, checkin_id String,
        status LowCardinality(String), duration Nullable(UInt32),
        environment LowCardinality(String), expected_time Nullable(DateTime),
        timeout_at Nullable(DateTime), trace_id Nullable(String),
        timestamp DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (project_id, monitor_id, timestamp)
      TTL timestamp + INTERVAL 90 DAY
    `});
    await ch.exec({ query: `
      CREATE TABLE IF NOT EXISTS ${chDatabase}.uptime_checkins (
        monitor_id UInt64, project_id String,
        status LowCardinality(String), response_ms UInt32,
        status_code Nullable(UInt16), error_message Nullable(String),
        timestamp DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (project_id, monitor_id, timestamp)
      TTL timestamp + INTERVAL 90 DAY
    `});
  } catch (e: any) {
    console.log(`   ⚠ CH table creation: ${e.message?.substring(0, 80)}`);
  }

  // ── 1. Cron Monitors (MySQL) ──
  const cronMonitorIds: number[] = [];
  for (const cm of CRON_MONITORS) {
    try {
      const [result] = await pool.query(
        `INSERT INTO g_argus_cronMonitors
         (project_id, name, slug, status, type, schedule_type, schedule_value, schedule_unit,
          checkin_margin, max_runtime, environment)
         VALUES (?, ?, ?, 'active', 'cron_job', ?, ?, ?, 5, ?, 'production')
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [PROJECT_ID, cm.name, cm.slug, cm.schedule_type, cm.schedule_value, cm.schedule_unit || null, cm.max_runtime]
      );
      const id = result.insertId;
      if (id > 0) cronMonitorIds.push(id);
    } catch (e: any) {
      // Get existing ID
      try {
        const [rows] = await pool.query(
          'SELECT id FROM g_argus_cronMonitors WHERE project_id = ? AND slug = ?',
          [PROJECT_ID, cm.slug]
        );
        if ((rows as any[]).length > 0) cronMonitorIds.push((rows as any[])[0].id);
      } catch {}
    }
  }
  console.log(`   ✓ ${cronMonitorIds.length} cron monitors`);

  // ── 2. Cron Check-ins (ClickHouse) ──
  if (cronMonitorIds.length > 0) {
    const checkins: any[] = [];
    const now = Date.now();

    for (const monitorId of cronMonitorIds) {
      // Generate checkins for last DAYS_BACK days at roughly expected intervals
      const interval = randomPick([300000, 900000, 3600000, 86400000]); // 5m, 15m, 1h, 1d
      const totalCheckins = Math.min(Math.floor((DAYS_BACK * 86400000) / interval), 2000);

      for (let i = 0; i < totalCheckins; i++) {
        const ts = new Date(now - i * interval - randomInt(0, Math.floor(interval * 0.1)));
        const isError = Math.random() < 0.05; // 5% failure rate
        const isTimeout = !isError && Math.random() < 0.02;

        checkins.push({
          monitor_id: monitorId,
          project_id: PROJECT_ID,
          checkin_id: uuid(),
          status: isError ? 'error' : isTimeout ? 'timeout' : 'ok',
          duration: isError ? null : randomInt(100, 30000),
          environment: 'production',
          expected_time: formatDate(new Date(now - i * interval)),
          timeout_at: isTimeout ? formatDate(new Date(ts.getTime() + 60000)) : null,
          trace_id: Math.random() < 0.7 ? uuid() : null,
          timestamp: formatDate(ts),
        });
      }
    }

    // Insert in chunks
    const CHUNK = 5000;
    for (let i = 0; i < checkins.length; i += CHUNK) {
      const chunk = checkins.slice(i, i + CHUNK);
      await ch.insert({
        table: `${chDatabase}.cron_checkins`,
        values: chunk,
        format: 'JSONEachRow',
      });
    }
    console.log(`   ✓ ${checkins.length.toLocaleString()} cron check-ins`);

    // Update last_checkin_at on MySQL monitors
    for (const monitorId of cronMonitorIds) {
      try {
        await pool.query(
          `UPDATE g_argus_cronMonitors
           SET last_checkin_at = UTC_TIMESTAMP(),
               last_status = ?
           WHERE id = ?`,
          [randomPick(['ok', 'ok', 'ok', 'error']), monitorId]
        );
      } catch {}
    }
  }

  // ── 3. Uptime Monitors (MySQL) ──
  const uptimeMonitorIds: number[] = [];
  for (const um of UPTIME_MONITORS) {
    try {
      const uptime = 95 + Math.random() * 5;
      const avgResponse = randomInt(20, 500);
      const status = uptime > 99 ? 'up' : (uptime > 95 ? 'degraded' : 'down');

      const [result] = await pool.query(
        `INSERT INTO g_argus_uptimeMonitors
         (project_id, name, url, method, interval_seconds, status, uptime_percent, avg_response_ms, environment)
         VALUES (?, ?, ?, 'GET', ?, ?, ?, ?, 'production')
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [PROJECT_ID, um.name, um.url, um.interval_seconds, status, uptime.toFixed(2), avgResponse]
      );
      const id = result.insertId;
      if (id > 0) uptimeMonitorIds.push(id);
    } catch (e: any) {
      try {
        const [rows] = await pool.query(
          'SELECT id FROM g_argus_uptimeMonitors WHERE project_id = ? AND name = ?',
          [PROJECT_ID, um.name]
        );
        if ((rows as any[]).length > 0) uptimeMonitorIds.push((rows as any[])[0].id);
      } catch {}
    }
  }
  console.log(`   ✓ ${uptimeMonitorIds.length} uptime monitors`);

  // ── 4. Uptime Check-ins (ClickHouse + MySQL) ──
  if (uptimeMonitorIds.length > 0) {
    const checkins: any[] = [];
    const mysqlCheckins: any[][] = [];
    const now = Date.now();

    for (const monitorId of uptimeMonitorIds) {
      const interval = randomPick([30000, 60000, 120000, 300000]);
      const totalCheckins = Math.min(Math.floor((DAYS_BACK * 86400000) / interval), 3000);

      for (let i = 0; i < totalCheckins; i++) {
        const ts = new Date(now - i * interval - randomInt(0, 5000));
        const isDown = Math.random() < 0.03;
        const responseMs = isDown ? randomInt(5000, 30000) : randomInt(15, 800);
        const statusCode = isDown ? randomPick([0, 500, 502, 503, 504]) : 200;

        checkins.push({
          monitor_id: monitorId,
          project_id: PROJECT_ID,
          status: isDown ? 'down' : 'up',
          response_ms: responseMs,
          status_code: statusCode,
          error_message: isDown ? randomPick(['Connection timeout', 'Service unavailable', 'DNS resolution failed', null]) : null,
          timestamp: formatDate(ts),
        });

        mysqlCheckins.push([monitorId, isDown ? 'down' : 'up', responseMs, ts]);
      }
    }

    // Insert ClickHouse checkins
    const CHUNK = 5000;
    for (let i = 0; i < checkins.length; i += CHUNK) {
      const chunk = checkins.slice(i, i + CHUNK);
      await ch.insert({
        table: `${chDatabase}.uptime_checkins`,
        values: chunk,
        format: 'JSONEachRow',
      });
    }
    console.log(`   ✓ ${checkins.length.toLocaleString()} uptime check-ins (ClickHouse)`);

    // Also insert subset into MySQL for backward compat
    const mysqlSubset = mysqlCheckins.slice(0, 5000);
    const MYSQL_BATCH = 500;
    for (let i = 0; i < mysqlSubset.length; i += MYSQL_BATCH) {
      const batch = mysqlSubset.slice(i, i + MYSQL_BATCH);
      try {
        await pool.query(
          `INSERT INTO g_argus_uptimeCheckins (monitor_id, status, response_ms, checked_at) VALUES ?`,
          [batch]
        );
      } catch {}
    }
    console.log(`   ✓ ${mysqlSubset.length.toLocaleString()} uptime check-ins (MySQL)`);
  }
}
