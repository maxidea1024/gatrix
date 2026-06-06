#!/usr/bin/env ts-node
/**
 * argus-bench — Performance benchmarking tool for Argus pipeline.
 *
 * Usage:
 *   npx ts-node scripts/argus-bench.ts --scenario ingest --events 50000 --concurrency 100
 *   npx ts-node scripts/argus-bench.ts --scenario full-pipeline --events 10000
 *   npx ts-node scripts/argus-bench.ts --scenario trace-processing --events 5000 --spans-per-txn 10
 *   npx ts-node scripts/argus-bench.ts --scenario query --iterations 200
 *   npx ts-node scripts/argus-bench.ts --scenario stress --duration 300
 *
 * Baseline comparison:
 *   npx ts-node scripts/argus-bench.ts --scenario ingest --events 50000 --save baseline.json
 *   npx ts-node scripts/argus-bench.ts --scenario ingest --events 50000 --compare baseline.json
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ── CLI argument parsing ──

interface BenchArgs {
  scenario: string;
  events: number;
  concurrency: number;
  spansPerTxn: number;
  duration: number;
  iterations: number;
  save?: string;
  compare?: string;
  output: 'table' | 'json';
  apiUrl: string;
  dsnKey: string;
}

function parseArgs(): BenchArgs {
  const args = process.argv.slice(2);
  const get = (name: string, def?: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : def;
  };

  const scenario = get('scenario');
  if (!scenario) {
    console.error('Error: --scenario is required');
    console.error(
      'Available: ingest, full-pipeline, worker-processing, trace-processing, query, stress'
    );
    process.exit(1);
  }

  return {
    scenario,
    events: parseInt(get('events', '10000')!, 10),
    concurrency: parseInt(get('concurrency', '50')!, 10),
    spansPerTxn: parseInt(get('spans-per-txn', '5')!, 10),
    duration: parseInt(get('duration', '60')!, 10),
    iterations: parseInt(get('iterations', '100')!, 10),
    save: get('save'),
    compare: get('compare'),
    output: get('output', 'table') as 'table' | 'json',
    apiUrl: get('api-url', 'http://localhost:4000')!,
    dsnKey: get('dsn-key', 'bench-test-key')!,
  };
}

// ── Metric collection ──

interface BenchResult {
  scenario: string;
  timestamp: string;
  metrics: Record<string, number>;
  latencies: number[];
}

class MetricCollector {
  private latencies: number[] = [];
  private startTime = 0;
  private endTime = 0;
  private totalEvents = 0;
  private errors = 0;
  private startRss = 0;

  begin(totalEvents: number): void {
    this.totalEvents = totalEvents;
    this.startTime = Date.now();
    this.startRss = process.memoryUsage().rss;
  }

  recordLatency(ms: number): void {
    this.latencies.push(ms);
  }

  recordError(): void {
    this.errors++;
  }

  end(): void {
    this.endTime = Date.now();
  }

  getResult(scenario: string): BenchResult {
    const durationMs = this.endTime - this.startTime;
    const durationSec = durationMs / 1000;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const len = sorted.length;

    const p = (pct: number) =>
      len > 0 ? sorted[Math.min(Math.floor((len * pct) / 100), len - 1)] : 0;

    return {
      scenario,
      timestamp: new Date().toISOString(),
      metrics: {
        'Total Events': this.totalEvents,
        'Duration (s)': Math.round(durationSec * 100) / 100,
        'Throughput (events/sec)': Math.round(this.totalEvents / durationSec),
        'Latency p50 (ms)': Math.round(p(50) * 100) / 100,
        'Latency p95 (ms)': Math.round(p(95) * 100) / 100,
        'Latency p99 (ms)': Math.round(p(99) * 100) / 100,
        'Latency min (ms)': Math.round((sorted[0] || 0) * 100) / 100,
        'Latency max (ms)': Math.round((sorted[len - 1] || 0) * 100) / 100,
        'Error Count': this.errors,
        'Error Rate (%)':
          Math.round((this.errors / this.totalEvents) * 10000) / 100,
        'Peak RSS (MB)': Math.round(process.memoryUsage().rss / 1024 / 1024),
        'RSS Delta (MB)': Math.round(
          (process.memoryUsage().rss - this.startRss) / 1024 / 1024
        ),
      },
      latencies: sorted,
    };
  }
}

// ── Event generators ──

function generateErrorEvent(projectId: string): object {
  const errorTypes = [
    'TypeError',
    'ReferenceError',
    'SyntaxError',
    'RangeError',
    'NetworkError',
  ];
  const levels = ['error', 'fatal', 'warning'];
  const environments = ['production', 'staging', 'development'];
  const platforms = ['javascript', 'python', 'node', 'java'];

  return {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    platform: platforms[Math.floor(Math.random() * platforms.length)],
    level: levels[Math.floor(Math.random() * levels.length)],
    environment: environments[Math.floor(Math.random() * environments.length)],
    release: `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 100)}`,
    exception: {
      type: errorTypes[Math.floor(Math.random() * errorTypes.length)],
      value: `Benchmark error at ${Date.now()}`,
      stacktrace: {
        frames: [
          {
            filename: 'bench/test.js',
            function: 'benchmarkFunction',
            lineno: Math.floor(Math.random() * 1000),
            in_app: true,
          },
        ],
      },
    },
    user: {
      id: `user-${Math.floor(Math.random() * 1000)}`,
      email: `user${Math.floor(Math.random() * 1000)}@bench.test`,
    },
    tags: { benchmark: 'true', run_id: projectId },
  };
}

function generateTransactionEvent(): object {
  const ops = ['http.server', 'db.query', 'cache.get', 'grpc.server'];
  return {
    event_id: randomUUID(),
    type: 'transaction',
    timestamp: new Date().toISOString(),
    start_timestamp: new Date(Date.now() - Math.random() * 5000).toISOString(),
    platform: 'node',
    environment: 'production',
    transaction: `/api/bench/${randomUUID().slice(0, 8)}`,
    op: ops[Math.floor(Math.random() * ops.length)],
    tags: { benchmark: 'true' },
    spans: [],
  };
}

function generateSpans(
  count: number,
  traceId: string,
  parentSpanId: string
): object[] {
  const ops = ['db.query', 'http.client', 'cache.get', 'serialize', 'render'];
  return Array.from({ length: count }, () => ({
    span_id: randomUUID().replace(/-/g, '').slice(0, 16),
    parent_span_id: parentSpanId,
    trace_id: traceId,
    op: ops[Math.floor(Math.random() * ops.length)],
    description: `bench span ${Date.now()}`,
    start_timestamp: new Date(Date.now() - Math.random() * 3000).toISOString(),
    timestamp: new Date().toISOString(),
    status: 'ok',
    tags: { benchmark: 'true' },
  }));
}

// ── HTTP client ──

async function postEvent(
  url: string,
  dsnKey: string,
  body: object
): Promise<number> {
  const start = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${dsnKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return performance.now() - start;
}

// ── Concurrency limiter ──

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const currentIdx = idx++;
      results[currentIdx] = await tasks[currentIdx]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  );
  return results;
}

// ── Scenarios ──

async function scenarioIngest(args: BenchArgs): Promise<BenchResult> {
  const collector = new MetricCollector();
  const runId = randomUUID().slice(0, 8);
  const ingestUrl = `${args.apiUrl}/api/ingest/error`;

  console.log(
    `\n🔥 Ingest Scenario: ${args.events} events, ${args.concurrency} concurrency`
  );
  console.log(`   Target: ${ingestUrl}`);
  console.log(`   DSN Key: ${args.dsnKey}\n`);

  const tasks = Array.from({ length: args.events }, () => async () => {
    try {
      const event = generateErrorEvent(runId);
      const latency = await postEvent(ingestUrl, args.dsnKey, event);
      collector.recordLatency(latency);
    } catch {
      collector.recordError();
    }
  });

  collector.begin(args.events);
  await runWithConcurrency(tasks, args.concurrency);
  collector.end();

  return collector.getResult('ingest');
}

async function scenarioTraceProcessing(args: BenchArgs): Promise<BenchResult> {
  const collector = new MetricCollector();
  const txnUrl = `${args.apiUrl}/api/ingest/transaction`;
  const totalSpans = args.events * args.spansPerTxn;

  console.log(`\n🔥 Trace Processing Scenario:`);
  console.log(`   Transactions: ${args.events}`);
  console.log(`   Spans per txn: ${args.spansPerTxn}`);
  console.log(`   Total spans: ${totalSpans}\n`);

  const tasks = Array.from({ length: args.events }, () => async () => {
    try {
      const txn = generateTransactionEvent() as any;
      const traceId = randomUUID().replace(/-/g, '');
      const parentSpanId = randomUUID().replace(/-/g, '').slice(0, 16);
      txn.contexts = { trace: { trace_id: traceId, span_id: parentSpanId } };
      txn.spans = generateSpans(args.spansPerTxn, traceId, parentSpanId);

      const latency = await postEvent(txnUrl, args.dsnKey, txn);
      collector.recordLatency(latency);
    } catch {
      collector.recordError();
    }
  });

  collector.begin(args.events);
  await runWithConcurrency(tasks, args.concurrency);
  collector.end();

  const result = collector.getResult('trace-processing');
  result.metrics['Total Spans'] = totalSpans;
  result.metrics['Spans/sec'] = Math.round(
    totalSpans / (result.metrics['Duration (s)'] || 1)
  );

  return result;
}

async function scenarioQuery(args: BenchArgs): Promise<BenchResult> {
  const collector = new MetricCollector();
  const endpoints = [
    `${args.apiUrl}/api/argus/__BENCH_PROJECT__/issues?limit=25`,
    `${args.apiUrl}/api/argus/__BENCH_PROJECT__/issues/volume?period=24h`,
  ];

  console.log(`\n🔍 Query Scenario: ${args.iterations} iterations`);

  const tasks = Array.from({ length: args.iterations }, (_, i) => async () => {
    try {
      const url = endpoints[i % endpoints.length];
      const start = performance.now();
      await fetch(url);
      collector.recordLatency(performance.now() - start);
    } catch {
      collector.recordError();
    }
  });

  collector.begin(args.iterations);
  await runWithConcurrency(tasks, args.concurrency);
  collector.end();

  return collector.getResult('query');
}

async function scenarioStress(args: BenchArgs): Promise<BenchResult> {
  const collector = new MetricCollector();
  const ingestUrl = `${args.apiUrl}/api/ingest/error`;
  const runId = randomUUID().slice(0, 8);
  let eventsSent = 0;

  console.log(
    `\n💥 Stress Scenario: ${args.duration}s sustained load, ${args.concurrency} concurrency\n`
  );

  const endTime = Date.now() + args.duration * 1000;
  collector.begin(0);

  const workers = Array.from({ length: args.concurrency }, async () => {
    while (Date.now() < endTime) {
      try {
        const event = generateErrorEvent(runId);
        const latency = await postEvent(ingestUrl, args.dsnKey, event);
        collector.recordLatency(latency);
        eventsSent++;
      } catch {
        collector.recordError();
      }
    }
  });

  await Promise.all(workers);
  collector.end();

  const result = collector.getResult('stress');
  result.metrics['Total Events'] = eventsSent;
  result.metrics['Throughput (events/sec)'] = Math.round(
    eventsSent / (result.metrics['Duration (s)'] || 1)
  );

  return result;
}

// ── Output formatting ──

function printTable(result: BenchResult, baseline?: BenchResult): void {
  const divider = '─'.repeat(64);
  console.log(`\n┌${divider}┐`);
  console.log(
    `│ ${'Metric'.padEnd(30)} │ ${'Current'.padEnd(15)} │ ${'Change'.padEnd(12)} │`
  );
  console.log(`├${divider}┤`);

  for (const [key, value] of Object.entries(result.metrics)) {
    const formatted =
      typeof value === 'number' ? value.toLocaleString() : String(value);
    let change = '';

    if (baseline?.metrics[key] !== undefined) {
      const baseVal = baseline.metrics[key];
      if (baseVal > 0) {
        const pct = (((value - baseVal) / baseVal) * 100).toFixed(1);
        change = Number(pct) >= 0 ? `+${pct}%` : `${pct}%`;
      }
    }

    console.log(
      `│ ${key.padEnd(30)} │ ${formatted.padEnd(15)} │ ${change.padEnd(12)} │`
    );
  }

  console.log(`└${divider}┘\n`);
}

function printJson(result: BenchResult): void {
  const output = { ...result };
  delete (output as any).latencies; // Don't print raw latencies
  console.log(JSON.stringify(output, null, 2));
}

// ── Main ──

async function main() {
  const args = parseArgs();

  console.log('═══════════════════════════════════════════');
  console.log('  🏁 Argus Benchmark Tool');
  console.log('═══════════════════════════════════════════');

  let result: BenchResult;

  switch (args.scenario) {
    case 'ingest':
      result = await scenarioIngest(args);
      break;
    case 'trace-processing':
      result = await scenarioTraceProcessing(args);
      break;
    case 'query':
      result = await scenarioQuery(args);
      break;
    case 'stress':
      result = await scenarioStress(args);
      break;
    case 'full-pipeline':
      // Full pipeline: ingest + wait for processing
      result = await scenarioIngest(args);
      result.scenario = 'full-pipeline';
      console.log('⏳ Waiting 5s for workers to drain...');
      await new Promise((r) => setTimeout(r, 5000));
      break;
    default:
      console.error(`Unknown scenario: ${args.scenario}`);
      process.exit(1);
  }

  // Load baseline for comparison if specified
  let baseline: BenchResult | undefined;
  if (args.compare) {
    try {
      const baselinePath = path.resolve(args.compare);
      const data = fs.readFileSync(baselinePath, 'utf-8');
      baseline = JSON.parse(data);
      console.log(`📊 Comparing against baseline: ${args.compare}`);
    } catch (e) {
      console.warn(`⚠️  Could not load baseline: ${(e as Error).message}`);
    }
  }

  // Output
  if (args.output === 'json') {
    printJson(result);
  } else {
    printTable(result, baseline);
  }

  // Save result if specified
  if (args.save) {
    const savePath = path.resolve(args.save);
    fs.writeFileSync(savePath, JSON.stringify(result, null, 2));
    console.log(`💾 Results saved to: ${savePath}`);
  }
}

main().catch((e) => {
  console.error('Benchmark failed:', e);
  process.exit(1);
});
