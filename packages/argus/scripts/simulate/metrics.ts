/**
 * Simulate Data — Metrics Templates & Log Event Generator
 */
import { PROJECT_ID, CHUNK_SIZE, DAYS_BACK } from './config';
import {
  randomFloat,
  randomPick,
  randomDateWeighted,
  formatDate,
  uuid,
  randomInt,
} from './helpers';
import { SERVER_RELEASES } from './releases';
import { ErrorScenario } from './scenarios';
import { k8sPodName, GAME_SHARDS } from './dynamic-tags';
import { generateContextualLogs } from './log-generators';

export const METRICS_TEMPLATES = [
  {
    name: 'system.cpu.utilization',
    type: 'gauge',
    unit: 'percent',
    valMin: 10,
    valMax: 95,
  },
  {
    name: 'system.memory.used',
    type: 'gauge',
    unit: 'byte',
    valMin: 1024 * 1024 * 100,
    valMax: 1024 * 1024 * 8000,
  },
  {
    name: 'http.server.requests',
    type: 'counter',
    unit: 'none',
    valMin: 1,
    valMax: 100,
  },
  {
    name: 'http.server.duration',
    type: 'distribution',
    unit: 'millisecond',
    valMin: 5,
    valMax: 500,
  },
  {
    name: 'custom.user.login',
    type: 'counter',
    unit: 'none',
    valMin: 1,
    valMax: 5,
  },
  {
    name: 'custom.checkout.cart_size',
    type: 'distribution',
    unit: 'none',
    valMin: 1,
    valMax: 15,
  },
  {
    name: 'game.concurrent_players',
    type: 'gauge',
    unit: 'none',
    valMin: 1000,
    valMax: 15000,
  },
];

export function generateLogsForEvent(
  issueId: number,
  traceId: string,
  timestamp: Date,
  scenario: ErrorScenario,
  user: { id: string; ip: string },
  server: string,
  env: string,
  release: string
): any[] {
  const baseTime = new Date(timestamp.getTime() - randomInt(5000, 30000));
  const service = randomPick(scenario.services);
  const pod = k8sPodName(service);

  const contextualLines = generateContextualLogs(
    scenario,
    user,
    server,
    env,
    release
  );

  return contextualLines.map((line, i) => ({
    log_id: uuid(),
    project_id: PROJECT_ID,
    trace_id: traceId,
    span_id: uuid().substring(0, 16),
    issue_id: String(issueId),
    timestamp: new Date(
      baseTime.getTime() + i * randomInt(200, 3000)
    ).toISOString(),
    level: line.level,
    logger_name: line.logger,
    message: line.msg,
    body: line.body || '',
    environment: env,
    release,
    service,
    attributes: {
      'server.name': server,
      environment: env,
      'trace.id': traceId,
      'kubernetes.pod_name': pod,
      'service.version': release,
      'game.shard': randomPick(GAME_SHARDS),
    },
  }));
}

export async function generateAndInsertMetrics(
  ch: any,
  chDatabase: string,
  totalMetrics: number
): Promise<number> {
  console.log('\n📈 Generating metrics...');
  let metricsCount = 0;
  for (let i = 0; i < totalMetrics; i += CHUNK_SIZE) {
    const metricBatch: any[] = [];
    const batchSize = Math.min(CHUNK_SIZE, totalMetrics - i);
    for (let j = 0; j < batchSize; j++) {
      const tpl = randomPick(METRICS_TEMPLATES);
      const ts = randomDateWeighted(DAYS_BACK);
      metricBatch.push({
        metric_id: uuid(),
        project_id: PROJECT_ID,
        timestamp: formatDate(ts),
        name: tpl.name,
        type: tpl.type,
        value: randomFloat(tpl.valMin, tpl.valMax),
        unit: tpl.unit,
        tags:
          tpl.name === 'game.concurrent_players'
            ? { server_shard: randomPick(GAME_SHARDS) }
            : {},
        environment: randomPick(['production', 'staging']),
        release: randomPick(SERVER_RELEASES),
      });
    }
    await ch.insert({
      table: `${chDatabase}.metrics`,
      values: metricBatch,
      format: 'JSONEachRow',
    });
    metricsCount += metricBatch.length;
  }
  console.log(`   ✓ ${metricsCount.toLocaleString()} metrics inserted`);
  return metricsCount;
}
