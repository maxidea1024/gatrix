#!/usr/bin/env node

/**
 * Gatrix Config Generator
 *
 * Reads gatrix.config.json5 and generates .env files consumed by
 * docker-compose and docker stack.
 *
 * Usage:
 *   node scripts/generate-env.js [OPTIONS]
 *
 * Options:
 *   --config <path>      Path to JSON5 config file (default: ./gatrix.config.json5)
 *   --output <path>      Output .env file path (default: ./.env)
 *   --host <address>     Server host address for URL generation (e.g., localhost, 192.168.1.100)
 *   --protocol <proto>   Protocol: http or https (default: http for dev, https for prod)
 *   --force              Overwrite existing .env without confirmation
 *   --dry-run            Print output to stdout without writing file
 *   --help               Show this help message
 *
 * Examples:
 *   node scripts/generate-env.js --host localhost --force
 *   node scripts/generate-env.js --host example.com --protocol https --force
 *   node scripts/generate-env.js --config ./my-config.json5 --output ./deploy/.env --force
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSON5 = require('json5');

// ============================================================
// CLI argument parsing
// ============================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    configPath: null,
    outputPath: null,
    host: null,
    protocol: null,
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
        opts.configPath = args[++i];
        break;
      case '--output':
        opts.outputPath = args[++i];
        break;
      case '--host':
        opts.host = args[++i];
        break;
      case '--protocol':
        opts.protocol = args[++i];
        break;
      case '--force':
        opts.force = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--help':
        console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[0]);
        process.exit(0);
    }
  }

  // Resolve paths relative to project root
  const projectRoot = path.resolve(__dirname, '..');
  opts.configPath = opts.configPath
    ? path.resolve(opts.configPath)
    : path.join(projectRoot, 'gatrix.config.json5');
  opts.outputPath = opts.outputPath
    ? path.resolve(opts.outputPath)
    : path.join(projectRoot, '.env');

  return opts;
}

// ============================================================
// Read and parse JSON5 config
// ============================================================
function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`[ERROR] Config file not found: ${configPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  try {
    return JSON5.parse(raw);
  } catch (e) {
    console.error(`[ERROR] Failed to parse JSON5 config: ${e.message}`);
    process.exit(1);
  }
}

// ============================================================
// Secret generation utilities
// ============================================================
function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length * 0.75))
    .toString('base64')
    .substring(0, length);
}

function generateJwtSecret() {
  return generateRandomString(32);
}

function generateSessionSecret() {
  return generateRandomString(20);
}

// ============================================================
// Generate .env content from config
// ============================================================
function generateEnv(cfg, opts) {
  const lines = [];

  function line(text) { lines.push(text); }
  function comment(text) { lines.push(`# ${text}`); }
  function section(title) {
    lines.push('');
    lines.push(`# ============================================`);
    lines.push(`# ${title}`);
    lines.push(`# ============================================`);
  }
  function env(key, value) {
    if (value === undefined || value === null) {
      lines.push(`${key}=`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}=${value}`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  const g = cfg.global || {};
  const infra = cfg.infrastructure || {};
  const svc = cfg.services || {};
  const mon = cfg.monitoring || {};
  const swarm = cfg.swarm || {};

  // Resolve host and protocol
  const host = opts.host || 'localhost';
  const nodeEnv = g.nodeEnv || 'development';
  const protocol = opts.protocol || (nodeEnv === 'production' ? 'https' : 'http');
  const frontendPort = svc.frontend?.port || 43000;
  const grafanaPort = mon.grafana?.port || 44000;
  const edgePort = svc.edge?.port || 3400;
  const baseUrl = `${protocol}://${host}:${frontendPort}`;

  // -- Header
  line('# ============================================');
  line('# Gatrix Environment Configuration');
  line('# ============================================');
  line('# AUTO-GENERATED from gatrix.config.json5');
  line(`# Generated at: ${new Date().toISOString()}`);
  line('# Do not edit this file directly. Modify gatrix.config.json5 instead.');
  line('# Regenerate with: node scripts/generate-env.js');

  // -- Volume Data Root
  section('Volume Data Root Path');
  env('DATA_ROOT', g.dataRoot || './data/gatrix-storage-root');

  // -- Database (shared / backend primary)
  section('Database Configuration');
  const backendDb = svc.backend?.db || {};
  env('DB_HOST', 'mysql');
  env('DB_PORT', 3306);
  env('DB_NAME', backendDb.name || 'gatrix');
  env('DB_USER', backendDb.user || 'gatrix_user');
  env('DB_PASSWORD', backendDb.password || 'gatrix_password');
  env('DB_ROOT_PASSWORD', infra.mysql?.rootPassword || 'gatrix_rootpassword');

  // -- Crash Database
  section('Crash Database (separated for load isolation)');
  const crashDb = svc.crashDb || {};
  env('CRASH_DB_NAME', crashDb.name || 'gatrix_crash');
  env('CRASH_DB_USER', crashDb.user || 'gatrix_user');
  env('CRASH_DB_PASSWORD', crashDb.password || 'gatrix_password');

  // -- Redis
  section('Redis Configuration');
  const backendRedis = svc.backend?.redis || {};
  env('REDIS_HOST', 'redis');
  env('REDIS_PORT', 6379);
  env('REDIS_PASSWORD', backendRedis.password || '');
  env('REDIS_DB', backendRedis.db ?? 0);

  // -- Host Port Mappings
  section('Host Port Mappings');
  env('MYSQL_HOST_PORT', infra.mysql?.hostPort || 43306);
  env('REDIS_HOST_PORT', infra.redis?.hostPort || 46379);

  // -- JWT Configuration
  section('JWT Configuration');
  const jwt = svc.backend?.jwt || {};
  env('JWT_SECRET', jwt.secret || generateJwtSecret());
  env('JWT_REFRESH_SECRET', jwt.refreshSecret || generateJwtSecret());
  env('JWT_EXPIRES_IN', jwt.expiresIn || '7d');

  // -- Session
  section('Session Configuration');
  const session = svc.backend?.session || {};
  env('SESSION_SECRET', session.secret || generateSessionSecret());
  env('SESSION_MAX_AGE', session.maxAge || 86400000);
  env('SESSION_TTL', session.ttl || 86400);

  // -- OAuth
  section('OAuth Configuration');
  const oauth = svc.backend?.oauth || {};
  env('GOOGLE_CLIENT_ID', oauth.google?.clientId || '');
  env('GOOGLE_CLIENT_SECRET', oauth.google?.clientSecret || '');
  env('GITHUB_CLIENT_ID', oauth.github?.clientId || '');
  env('GITHUB_CLIENT_SECRET', oauth.github?.clientSecret || '');

  // -- Server
  section('Server Configuration');
  env('PORT', svc.backend?.port || 45000);
  env('BACKEND_PORT', svc.backend?.port || 45000);
  env('NODE_ENV', g.nodeEnv || 'development');

  // -- CORS / Frontend URL
  section('CORS and Frontend');
  env('CORS_ORIGIN', baseUrl);
  env('FRONTEND_URL', baseUrl);
  env('FRONTEND_PORT', frontendPort);
  env('FRONTEND_HTTPS_PORT', svc.frontend?.httpsPort || 43443);

  // -- Admin
  section('Admin Configuration');
  const admin = svc.backend?.admin || {};
  env('ADMIN_EMAIL', admin.email || 'admin@gatrix.com');
  env('ADMIN_PASSWORD', admin.password || 'admin123');
  env('ADMIN_NAME', admin.name || 'Administrator');

  // -- Logging
  section('Logging');
  const logging = svc.backend?.logging || {};
  env('LOG_LEVEL', logging.level || 'info');
  env('LOG_DIR', logging.dir || 'logs');
  env('CHAT_LOG_LEVEL', svc.chatServer?.logging?.level || 'info');
  env('EVENT_LENS_LOG_LEVEL', svc.eventLens?.logging?.level || 'info');
  env('EDGE_LOG_LEVEL', svc.edge?.logging?.level || 'info');

  // -- SMTP
  section('SMTP / Email Configuration');
  const smtp = svc.backend?.smtp || {};
  env('SMTP_HOST', smtp.host || '');
  env('SMTP_PORT', smtp.port || 587);
  env('SMTP_USER', smtp.user || '');
  env('SMTP_PASS', smtp.pass || '');
  env('SMTP_FROM', smtp.from || '');
  env('SMTP_SECURE', smtp.secure || false);

  // -- Chat Server
  section('Chat Server Configuration');
  env('CHAT_SERVER_URL', 'http://chat-server:5100');
  env('CHAT_PORT', svc.chatServer?.port || 45100);

  const chatDb = svc.chatServer?.db || {};
  env('CHAT_DB_NAME', chatDb.name || 'gatrix_chat');
  env('CHAT_DB_HOST', 'mysql');
  env('CHAT_DB_PORT', 3306);
  env('CHAT_DB_USER', chatDb.user || 'gatrix_user');
  env('CHAT_DB_PASSWORD', chatDb.password || 'gatrix_password');

  const chatRedis = svc.chatServer?.redis || {};
  env('CHAT_REDIS_DB', chatRedis.db ?? 1);

  const chatCluster = svc.chatServer?.cluster || {};
  env('CHAT_CLUSTER_ENABLED', chatCluster.enabled ?? true);
  env('CHAT_CLUSTER_WORKERS', chatCluster.workers ?? 0);
  env('CHAT_STICKY_SESSION', chatCluster.stickySession ?? true);

  const chatBroadcast = svc.chatServer?.broadcasting || {};
  env('CHAT_BROADCAST_BATCH_SIZE', chatBroadcast.batchSize || 1000);
  env('CHAT_USE_MESSAGE_PACK', chatBroadcast.useMessagePack ?? true);
  env('CHAT_BROADCAST_COMPRESSION', chatBroadcast.compression ?? true);
  env('CHAT_WS_MAX_CONNECTIONS', svc.chatServer?.ws?.maxConnections || 10000);
  env('CHAT_MONITORING_ENABLED', true);

  // -- Event Lens
  section('Event Lens Configuration');
  env('EVENT_LENS_PORT', svc.eventLens?.port || 45200);

  // Event Lens uses MYSQL_* variables (not DB_*)
  const eventLensDb = svc.eventLens?.db || {};
  env('MYSQL_HOST', 'mysql');
  env('MYSQL_PORT', 3306);
  env('MYSQL_DATABASE', eventLensDb.name || 'gatrix');
  env('MYSQL_USER', eventLensDb.user || 'gatrix_user');
  env('MYSQL_PASSWORD', eventLensDb.password || 'gatrix_password');

  const ch = svc.eventLens?.clickhouse || {};
  env('CLICKHOUSE_HOST', 'clickhouse');
  env('CLICKHOUSE_PORT', 8123);
  env('CLICKHOUSE_DATABASE', ch.database || 'event_lens');
  env('CLICKHOUSE_USERNAME', ch.username || 'default');
  env('CLICKHOUSE_PASSWORD', ch.password || '');
  env('CLICKHOUSE_HTTP_PORT', infra.clickhouse?.httpPort || 48123);
  env('CLICKHOUSE_NATIVE_PORT', infra.clickhouse?.nativePort || 49000);

  const worker = svc.eventLens?.worker || {};
  env('WORKER_BATCH_SIZE', worker.batchSize || 1000);
  env('WORKER_BATCH_TIMEOUT', worker.batchTimeout || 5000);
  env('WORKER_CONCURRENCY', worker.concurrency || 10);

  // -- Service Discovery
  section('Service Discovery');
  const sd = svc.backend?.serviceDiscovery || {};
  env('SERVICE_DISCOVERY_MODE', sd.mode || 'etcd');
  env('SERVICE_DISCOVERY_HEARTBEAT_TTL', sd.heartbeatTTL || 30);
  env('SERVICE_DISCOVERY_INACTIVE_KEEP_TTL', sd.inactiveKeepTTL || 60);
  env('SERVICE_DISCOVERY_TERMINATED_MARKER_TTL', sd.terminatedMarkerTTL || 300);
  env('ETCD_HOSTS', 'http://etcd:2379');
  env('ETCD_PORT', infra.etcd?.port || 42379);

  // -- Gatrix Integration (Backend <-> Chat/EventLens)
  section('Gatrix Integration');
  env('GATRIX_API_URL', `http://backend:${svc.backend?.port || 45000}`);
  env('GATRIX_API_SECRET', 'change-this-to-secure-shared-secret');
  env('GATRIX_URL', `http://backend:${svc.backend?.port || 45000}`);

  // -- Frontend / Vite
  section('Frontend Configuration');
  const vite = svc.frontend?.vite || {};
  env('VITE_API_URL', vite.apiUrl || '/api/v1');
  env('VITE_APP_NAME', vite.appName || 'Gatrix');
  env('VITE_DEFAULT_LANGUAGE', g.defaultLanguage || 'zh');
  env('VITE_ROUTER_BASENAME', '/');

  // URL generation based on host and protocol
  if (nodeEnv === 'production') {
    env('VITE_GRAFANA_URL', '/grafana');
    env('GRAFANA_URL', `${baseUrl}/grafana`);
    env('GRAFANA_ROOT_URL', `${baseUrl}/grafana/`);
  } else {
    env('VITE_GRAFANA_URL', `${protocol}://${host}:${grafanaPort}`);
    env('GRAFANA_URL', `${protocol}://${host}:${grafanaPort}`);
    env('GRAFANA_ROOT_URL', `${protocol}://${host}:${grafanaPort}/`);
  }
  env('VITE_BULL_BOARD_URL', `${baseUrl}/bull-board`);
  env('VITE_EDGE_URL', `${protocol}://${host}:${edgePort}`);
  env('DEFAULT_LANGUAGE', g.defaultLanguage || 'zh');

  // -- Edge Server
  section('Edge Server Configuration');
  env('EDGE_PORT', svc.edge?.port || 3400);
  env('EDGE_BYPASS_TOKEN', svc.edge?.bypassToken || 'gatrix-edge-internal-bypass-token');
  env('EDGE_API_TOKEN', svc.edge?.bypassToken || 'gatrix-edge-internal-bypass-token');
  env('EDGE_APPLICATION_NAME', svc.edge?.applicationName || 'edge-server');
  env('EDGE_ENVIRONMENTS', '*');

  const edgeCache = svc.edge?.cache || {};
  env('EDGE_SYNC_METHOD', edgeCache.syncMethod || 'event');
  env('EDGE_CACHE_POLLING_INTERVAL_MS', edgeCache.pollingIntervalMs || 60000);

  const edgeRedis = svc.edge?.redis || {};
  env('EDGE_REDIS_HOST', edgeRedis.host || 'redis');
  env('EDGE_REDIS_PORT', edgeRedis.port || 6379);
  env('EDGE_REDIS_PASSWORD', edgeRedis.password || '');
  env('EDGE_REDIS_DB', edgeRedis.db ?? 0);

  env('EDGE_FORCE_HTTPS', svc.edge?.forceHttps ?? false);

  // -- Data Retention
  section('Data Retention');
  const retention = svc.backend?.retention || {};
  env('FEATURE_FLAG_METRICS_RETENTION_DAYS', retention.featureFlagMetricsDays || 14);
  env('PLANNING_DATA_RETENTION_DAYS', retention.planningDataDays || 14);
  env('CHANGE_REQUEST_REJECTION_RETENTION_DAYS', retention.changeRequestRejectionDays || 14);
  env('SERVER_LIFECYCLE_RETENTION_DAYS', retention.serverLifecycleDays || 14);

  // -- Rate Limiting
  section('Rate Limiting');
  env('DISABLE_RATE_LIMIT', svc.backend?.disableRateLimit ?? false);
  env('DISABLE_X_POWERED_BY', true);

  // -- Change Request
  section('Change Request Configuration');
  env('CR_REQUEST_DELAY_MS', 2000);

  // -- Monitoring
  section('Monitoring');
  const grafana = mon.grafana || {};
  env('GRAFANA_PORT', grafana.port || 44000);
  env('GRAFANA_DOMAIN', grafana.domain || 'localhost');
  env('GRAFANA_TRUSTED_ORIGINS', grafana.trustedOrigins || '*');
  env('GRAFANA_ALLOWED_ORIGINS', grafana.allowedOrigins || '*');
  env('GRAFANA_ADMIN_PASSWORD', grafana.adminPassword || 'admin');
  env('PROMETHEUS_PORT', mon.prometheus?.port || 49090);
  env('LOKI_PORT', mon.loki?.port || 43100);

  // -- Swarm Deployment
  section('Swarm Deployment - Scaling');
  const replicas = swarm.replicas || {};
  env('BACKEND_REPLICAS', replicas.backend || 1);
  env('FRONTEND_REPLICAS', replicas.frontend || 1);
  env('EVENT_LENS_REPLICAS', replicas.eventLens || 1);
  env('EVENT_LENS_WORKER_REPLICAS', replicas.eventLensWorker || 1);
  env('CHAT_SERVER_REPLICAS', replicas.chatServer || 1);
  env('EDGE_REPLICAS', replicas.edge || 1);

  section('Swarm Deployment - Ports');
  const swarmPorts = swarm.ports || {};
  env('HTTP_PORT', swarmPorts.http || 43000);
  env('HTTPS_PORT', swarmPorts.https || 443);
  env('PORTAINER_PORT', swarmPorts.portainer || 9000);
  env('VISUALIZER_PORT', swarmPorts.visualizer || 8080);

  lines.push('');
  return lines.join('\n');
}

// ============================================================
// Main
// ============================================================
function main() {
  const opts = parseArgs();

  console.log('[INFO] Gatrix Config -> .env Generator');
  console.log(`[INFO] Config: ${opts.configPath}`);
  console.log(`[INFO] Output: ${opts.outputPath}`);

  // Load config
  const cfg = loadConfig(opts.configPath);

  // Generate .env content
  const content = generateEnv(cfg, opts);

  if (opts.dryRun) {
    console.log('\n--- DRY RUN (output to stdout) ---\n');
    console.log(content);
    return;
  }

  // Check existing file
  if (fs.existsSync(opts.outputPath) && !opts.force) {
    console.error(`[ERROR] Output file already exists: ${opts.outputPath}`);
    console.error('[INFO]  Use --force to overwrite.');
    process.exit(1);
  }

  // Write file
  fs.writeFileSync(opts.outputPath, content, 'utf8');
  console.log(`[OK] .env file generated: ${opts.outputPath}`);

  // Count variables
  const varCount = content.split('\n').filter(l => l.match(/^[A-Z_]+=/) ).length;
  console.log(`[OK] ${varCount} environment variables written.`);
}

main();
