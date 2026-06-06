import { createClient, ClickHouseClient } from '@clickhouse/client';
import { createLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('clickhouse');

// ─────────────────────────────────────────────────────────────────────────────
// ClickHouse Configuration — reads directly from environment variables.
// No dependency on argus config.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClickHouseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

function loadConfig(): ClickHouseConfig {
  return {
    host: process.env.CLICKHOUSE_HOST || 'localhost',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8123', 10),
    database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  };
}

let clickhouseClient: ClickHouseClient | null = null;

export function getClickHouseClient(): ClickHouseClient {
  if (!clickhouseClient) {
    const cfg = loadConfig();
    clickhouseClient = createClient({
      url: `http://${cfg.host === 'localhost' ? '127.0.0.1' : cfg.host}:${cfg.port}`,
      database: cfg.database,
      username: cfg.username,
      password: cfg.password,
      compression: {
        request: true,
        response: true,
      },
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 1,
        date_time_input_format: 'best_effort',
      },
    });
  }
  return clickhouseClient;
}

export async function testClickHouseConnection(): Promise<boolean> {
  try {
    const client = getClickHouseClient();
    const result = await client.query({ query: 'SELECT 1 as test' });
    const data = await result.json();
    logger.info('ClickHouse connected successfully', { data });
    return true;
  } catch (error) {
    logger.error('ClickHouse connection failed', { error });
    return false;
  }
}

export async function initClickHouseDatabase(): Promise<void> {
  const cfg = loadConfig();
  try {
    const adminClient = createClient({
      url: `http://${cfg.host === 'localhost' ? '127.0.0.1' : cfg.host}:${cfg.port}`,
      username: cfg.username,
      password: cfg.password,
      compression: {
        request: true,
        response: true,
      },
    });

    await adminClient.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${cfg.database}`,
    });
    logger.info(`ClickHouse database '${cfg.database}' ready`);

    await runClickHouseMigrations(cfg);
  } catch (error) {
    logger.error('Failed to initialize ClickHouse database', { error });
    throw error;
  }
}

async function runClickHouseMigrations(_cfg: ClickHouseConfig): Promise<void> {
  const client = getClickHouseClient();
  try {
    // Look for migrations relative to the consuming package (argus)
    // This allows optic to remain generic while argus owns the migration files
    const possibleDirs = [
      path.join(process.cwd(), 'migrations/clickhouse'),
      path.join(__dirname, '../../../argus/migrations/clickhouse'),
    ];

    let migrationsDir: string | null = null;
    for (const dir of possibleDirs) {
      if (fs.existsSync(dir)) {
        migrationsDir = dir;
        break;
      }
    }

    if (!migrationsDir) {
      logger.warn('ClickHouse migrations directory not found');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          await client.exec({ query: statement });
        } catch (error: any) {
          if (
            error.code === '57' ||
            error.message?.includes('already exists')
          ) {
            logger.debug(`Skipping already existing object in ${file}`);
          } else {
            throw error;
          }
        }
      }

      logger.info(`ClickHouse migration completed: ${file}`);
    }

    logger.info('All ClickHouse migrations completed successfully');
  } catch (error) {
    logger.error('Failed to run ClickHouse migrations', { error });
    throw error;
  }
}
