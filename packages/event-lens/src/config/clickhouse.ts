import { createClient, ClickHouseClient } from '@clickhouse/client';
import { config } from './index';
import logger from '../utils/logger';

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
  } catch (error) {
    logger.error('❌ Failed to initialize ClickHouse database', { error });
    throw error;
  }
}

export default clickhouse;

