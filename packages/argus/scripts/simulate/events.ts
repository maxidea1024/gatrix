import { createClient } from '@clickhouse/client';
import mysql from 'mysql2/promise';
import { PROJECT_ID, CHUNK_SIZE, DAYS_BACK } from './config';
import { md5, uuid, randomInt, randomPick, weightedPick, randomDateWeighted, formatDate } from './helpers';
import { USERS, BROWSERS, OS_LIST } from './user-pool';
import { SCENARIOS, ErrorScenario } from './scenarios';
import { dynamicTags, dynamicExtra } from './dynamic-tags';

export interface EventRecord {
  event_id: string;
  project_id: string;
  issue_id: number;
  timestamp: string;
  received_at: string;
  platform: string;
  level: string;
  type: string;
  value: string;
  mechanism: string;
  fingerprint: string[];
  primary_hash: string;
  exception: string;
  stacktrace_frames: string;
  breadcrumbs: string;
  user_id: string;
  user_email: string;
  user_ip: string;
  user_name: string;
  environment: string;
  release: string;
  server_name: string;
  transaction: string;
  os_name: string;
  os_version: string;
  browser_name: string;
  browser_version: string;
  runtime_name: string;
  runtime_version: string;
  tags: Record<string, string>;
  extra: Record<string, string>;
  contexts: string;
  dsn_key_id: number;
  // Non-CH fields used by other generators
  title: string;
  message: string;
  culprit: string;
}

export interface IssueTracker {
  scenario: ErrorScenario;
  fingerprint: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
}

export function generateErrorEvents(
  activeDsnKeys: number[],
  dsnKeyTimestamps: Map<number, { min: Date; max: Date }>,
  totalEvents: number
): { allEvents: EventRecord[]; issueMap: Map<string, IssueTracker> } {
  const weightedScenarios: ErrorScenario[] = [];
  for (const s of SCENARIOS) {
    for (let i = 0; i < s.weight; i++) weightedScenarios.push(s);
  }

  const allEvents: EventRecord[] = [];
  const issueMap = new Map<string, IssueTracker>();

  for (let i = 0; i < totalEvents; i++) {
    const s = randomPick(weightedScenarios);
    const fingerprint = md5(`${s.id}|${s.title}`);
    const ts = randomDateWeighted(DAYS_BACK);
    const user = randomPick(USERS);
    const env = randomPick(s.environments);
    const release = randomPick(s.releases);
    const server = randomPick(s.servers);
    const browser = weightedPick(BROWSERS, BROWSERS.map((b) => b.w));
    const os = weightedPick(OS_LIST, OS_LIST.map((o) => o.w));
    const dsnKeyId = randomPick(activeDsnKeys);

    if (dsnKeyTimestamps.has(dsnKeyId)) {
      const existing = dsnKeyTimestamps.get(dsnKeyId)!;
      if (ts < existing.min) existing.min = ts;
      if (ts > existing.max) existing.max = ts;
    } else {
      dsnKeyTimestamps.set(dsnKeyId, { min: new Date(ts), max: new Date(ts) });
    }

    const tags = dynamicTags(s, server, env);
    const extra = dynamicExtra(s);

    const frames = s.frames.map((f) => ({
      ...f,
      lineno: f.lineno + randomInt(-2, 2),
      colno: f.colno + randomInt(-1, 1),
    }));

    const numBreadcrumbs = randomInt(3, 8);
    const breadcrumbs: any[] = [];
    for (let b = 0; b < numBreadcrumbs; b++) {
      const tpl = randomPick(s.breadcrumbTemplates);
      breadcrumbs.push({
        ...tpl,
        timestamp: formatDate(new Date(ts.getTime() - (numBreadcrumbs - b) * randomInt(500, 5000))),
        data: Math.random() < 0.3 ? { request_id: uuid().substring(0, 12) } : undefined,
      });
    }

    if (!issueMap.has(fingerprint)) {
      issueMap.set(fingerprint, {
        scenario: s,
        fingerprint,
        count: 0,
        firstSeen: ts,
        lastSeen: ts,
      });
    }
    const tracker = issueMap.get(fingerprint)!;
    tracker.count++;
    if (ts < tracker.firstSeen) tracker.firstSeen = ts;
    if (ts > tracker.lastSeen) tracker.lastSeen = ts;

    const exceptionJson = JSON.stringify({
      values: [
        {
          type: s.type,
          value: s.value,
          stacktrace: { frames },
        },
      ],
    });

    allEvents.push({
      event_id: uuid().replace(/-/g, ''),
      project_id: PROJECT_ID,
      issue_id: 0, // Will be filled after MySQL insert
      timestamp: formatDate(ts),
      received_at: formatDate(new Date(ts.getTime() + randomInt(100, 3000))),
      platform: s.platform,
      level: s.level,
      type: s.type,
      value: s.value,
      mechanism: randomPick(['generic', 'onerror', 'onunhandledrejection', 'instrument', '']),
      fingerprint: [fingerprint],
      primary_hash: fingerprint,
      exception: exceptionJson,
      stacktrace_frames: JSON.stringify(frames),
      breadcrumbs: JSON.stringify(breadcrumbs),
      user_id: user.id,
      user_email: user.email,
      user_ip: user.ip,
      user_name: user.name,
      environment: env,
      release,
      server_name: server,
      transaction: s.transaction,
      os_name: os.name,
      os_version: os.version,
      browser_name: browser.name,
      browser_version: browser.version,
      runtime_name: s.runtime === 'nodejs' ? 'node' : s.runtime === 'lua' ? 'lua' : 'unreal',
      runtime_version:
        s.runtime === 'nodejs'
          ? randomPick(['20.14.0', '20.12.2', '22.2.0'])
          : s.runtime === 'lua'
            ? randomPick(['5.4.6', '5.4.7', 'LuaJIT 2.1'])
            : randomPick(['5.3.2', '5.4.0']),
      tags,
      extra,
      contexts: JSON.stringify(s.contexts || {}),
      dsn_key_id: dsnKeyId,
      // Non-CH fields for other generators
      title: s.title,
      message: s.value,
      culprit: s.culprit,
    });
  }

  return { allEvents, issueMap };
}

export async function insertIssuesIntoMySQL(
  pool: mysql.Pool,
  issueMap: Map<string, IssueTracker>
): Promise<Map<string, number>> {
  console.log('\n💾 Inserting issues into MySQL...');
  const fingerprintToId = new Map<string, number>();
  let shortId = 1;
  for (const [, tracker] of issueMap) {
    const s = tracker.scenario;
    try {
      const [result] = await pool.query(
        `INSERT INTO g_argus_issues
         (project_id, short_id, primary_hash, fingerprint, type, title, level, platform,
          culprit, first_seen, last_seen, times_seen, status,
          priority, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unresolved', 'medium', NULL)
         ON DUPLICATE KEY UPDATE
           times_seen = times_seen + VALUES(times_seen),
           last_seen = GREATEST(last_seen, VALUES(last_seen))`,
        [
          PROJECT_ID,
          shortId++,
          tracker.fingerprint,
          JSON.stringify([tracker.fingerprint]),
          s.type,
          s.title,
          s.level,
          s.platform,
          s.culprit,
          tracker.firstSeen,
          tracker.lastSeen,
          tracker.count,
        ]
      );
      const insertId = (result as any).insertId;
      if (insertId > 0) {
        fingerprintToId.set(tracker.fingerprint, insertId);
      }
    } catch (err) {
      // Ignore duplicate key errors
    }
  }
  // Also fetch any that were ON DUPLICATE KEY UPDATE (insertId=0)
  try {
    const [rows] = await pool.query(
      'SELECT id, primary_hash FROM g_argus_issues WHERE project_id = ?',
      [PROJECT_ID]
    );
    for (const row of rows as any[]) {
      fingerprintToId.set(row.primary_hash, row.id);
    }
  } catch {}
  console.log(`   ✓ ${issueMap.size} issues inserted (${fingerprintToId.size} mapped)`);
  return fingerprintToId;
}

export async function insertEventsIntoClickHouse(
  ch: any,
  allEvents: EventRecord[],
  chDatabase: string
): Promise<void> {
  console.log('\n💾 Inserting error events into ClickHouse...');
  for (let offset = 0; offset < allEvents.length; offset += CHUNK_SIZE) {
    const chunk = allEvents.slice(offset, offset + CHUNK_SIZE);
    await ch.insert({
      table: `${chDatabase}.errors`,
      values: chunk,
      format: 'JSONEachRow',
    });
    process.stdout.write(`\r   ⏳ ${Math.min(offset + CHUNK_SIZE, allEvents.length).toLocaleString()} / ${allEvents.length.toLocaleString()}`);
  }
  console.log('\n   ✓ Done');
}
