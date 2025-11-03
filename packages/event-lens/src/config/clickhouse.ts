import { createClient, ClickHouseClient } from '@clickhouse/client';
import { config } from './index';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

let clickhouseClient: ClickHouseClient | null = null;

export function getClickHouseClient(): ClickHouseClient {
  if (!clickhouseClient) {
    clickhouseClient = createClient({
      host: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
      database: config.clickhouse.database,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      compression: {
        request: true,
        response: true,
      },
      clickhouse_settings: {
        async_insert: 1,
        wait_for_async_insert: 0,
      },
    });
  }
  return clickhouseClient;
}

export const clickhouse = getClickHouseClient();

// 연결 테스트
export async function testClickHouseConnection(): Promise<boolean> {
  try {
    const result = await clickhouse.query({
      query: 'SELECT 1 as test',
    });
    const data = await result.json();
    logger.info('✅ ClickHouse connected successfully', { data });
    return true;
  } catch (error) {
    logger.error('❌ ClickHouse connection failed', { error });
    return false;
  }
}

// 데이터베이스 초기화
export async function initClickHouseDatabase(): Promise<void> {
  try {
    // 데이터베이스 생성
    await clickhouse.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${config.clickhouse.database}`,
    });
    logger.info(`✅ ClickHouse database '${config.clickhouse.database}' ready`);

    // 마이그레이션 실행
    await runClickHouseMigrations();
  } catch (error) {
    logger.error('❌ Failed to initialize ClickHouse database', { error });
    throw error;
  }
}

// ClickHouse 마이그레이션 실행
async function runClickHouseMigrations(): Promise<void> {
  try {
    const migrationsDir = path.join(__dirname, '../../migrations/clickhouse');

    if (!fs.existsSync(migrationsDir)) {
      logger.warn('⚠️  ClickHouse migrations directory not found');
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // SQL 문을 세미콜론으로 분리
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await clickhouse.exec({ query: statement });
        } catch (error: any) {
          // 이미 존재하는 테이블/뷰는 무시
          if (error.code === '57' || error.message?.includes('already exists')) {
            logger.debug(`⏭️  Skipping already existing object in ${file}`);
          } else {
            throw error;
          }
        }
      }

      logger.info(`✅ ClickHouse migration completed: ${file}`);
    }

    logger.info('✅ All ClickHouse migrations completed successfully');
  } catch (error) {
    logger.error('❌ Failed to run ClickHouse migrations', { error });
    throw error;
  }
}

export default clickhouse;

