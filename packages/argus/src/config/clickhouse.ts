import { createClient, ClickHouseClient } from '@clickhouse/client';
import { config } from './index';
import { createLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('clickhouse');

let clickhouseClient: ClickHouseClient | null = null;

export function getClickHouseClient(): ClickHouseClient {
  if (!clickhouseClient) {
    clickhouseClient = createClient({
      url: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
      database: config.clickhouse.database,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
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

export const clickhouse = getClickHouseClient();

export async function testClickHouseConnection(): Promise<boolean> {
  try {
    const result = await clickhouse.query({
      query: 'SELECT 1 as test',
    });
    const data = await result.json();
    logger.info('ClickHouse connected successfully', { data });
    return true;
  } catch (error) {
    logger.error('ClickHouse connection failed', { error });
    return false;
  }
}

export async function initClickHouseDatabase(): Promise<void> {
  try {
    const adminClient = createClient({
      url: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      compression: {
        request: true,
        response: true,
      },
    });

    await adminClient.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${config.clickhouse.database}`,
    });
    logger.info(`ClickHouse database '${config.clickhouse.database}' ready`);

    await runClickHouseMigrations();
  } catch (error) {
    logger.error('Failed to initialize ClickHouse database', { error });
    throw error;
  }
}

async function runClickHouseMigrations(): Promise<void> {
  try {
    const migrationsDir = path.join(__dirname, '../../migrations/clickhouse');

    if (!fs.existsSync(migrationsDir)) {
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
          await clickhouse.exec({ query: statement });
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

export default clickhouse;
