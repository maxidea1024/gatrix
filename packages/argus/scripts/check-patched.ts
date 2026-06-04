import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const CH_CONFIG = {
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
};

async function main() {
  const client = createClient(CH_CONFIG);
  const result = await client.query({
    query: `SELECT event_id, breadcrumbs FROM argus.errors WHERE breadcrumbs LIKE '%"data"%' LIMIT 1`,
    format: 'JSONEachRow',
  });
  const rows = await result.json();
  console.log(JSON.stringify(rows, null, 2));
  await client.close();
}
main().catch(console.error);
