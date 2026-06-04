/**
 * Reseed user_feedback with attachment data
 * Usage: npx tsx scripts/reseed-feedback.ts
 */
import { createClient } from '@clickhouse/client';
import { randomUUID } from 'crypto';

const PROJECT_ID = '01KN8GSHBJ10JTQ9D0HD60RKFV';
const TOTAL = 2500;

const ch = createClient({
  url: 'http://localhost:48123',
  database: 'argus',
  username: 'default',
  password: '',
  clickhouse_settings: {
    async_insert: 1,
    wait_for_async_insert: 1,
    date_time_input_format: 'best_effort',
  },
});

// Free images from picsum.photos and placehold.co
const IMAGE_POOL = [
  'https://picsum.photos/seed/bug1/800/600',
  'https://picsum.photos/seed/crash2/640/480',
  'https://picsum.photos/seed/glitch3/800/450',
  'https://picsum.photos/seed/error4/720/540',
  'https://picsum.photos/seed/freeze5/800/600',
  'https://picsum.photos/seed/lag6/640/360',
  'https://picsum.photos/seed/ui7/900/600',
  'https://picsum.photos/seed/screen8/800/500',
  'https://picsum.photos/seed/report9/640/480',
  'https://picsum.photos/seed/capture10/750/500',
  'https://picsum.photos/seed/debug11/800/600',
  'https://picsum.photos/seed/trace12/640/480',
  'https://picsum.photos/seed/snap13/700/525',
  'https://picsum.photos/seed/shot14/800/450',
  'https://picsum.photos/seed/render15/640/400',
  'https://picsum.photos/seed/texture16/800/600',
  'https://picsum.photos/seed/artifact17/720/480',
  'https://picsum.photos/seed/pixel18/600/450',
  'https://picsum.photos/seed/flicker19/800/600',
  'https://picsum.photos/seed/distort20/640/480',
  'https://picsum.photos/seed/overlay21/800/500',
  'https://picsum.photos/seed/shadow22/750/560',
  'https://picsum.photos/seed/bloom23/640/480',
  'https://picsum.photos/seed/tear24/800/600',
  'https://picsum.photos/seed/clip25/700/400',
  'https://picsum.photos/seed/popup26/640/480',
  'https://picsum.photos/seed/modal27/800/600',
  'https://picsum.photos/seed/tooltip28/720/540',
  'https://picsum.photos/seed/menu29/640/480',
  'https://picsum.photos/seed/sidebar30/800/600',
  'https://picsum.photos/seed/navbar31/900/500',
  'https://picsum.photos/seed/footer32/640/360',
  'https://picsum.photos/seed/card33/800/600',
  'https://picsum.photos/seed/table34/750/500',
  'https://picsum.photos/seed/chart35/640/480',
  'https://picsum.photos/seed/graph36/800/450',
  'https://picsum.photos/seed/icon37/600/600',
  'https://picsum.photos/seed/badge38/640/480',
  'https://picsum.photos/seed/avatar39/800/600',
  'https://picsum.photos/seed/banner40/900/400',
  'https://picsum.photos/seed/splash41/800/600',
  'https://picsum.photos/seed/loading42/640/480',
  'https://picsum.photos/seed/empty43/720/540',
  'https://picsum.photos/seed/broken44/800/600',
  'https://picsum.photos/seed/missing45/640/480',
  'https://picsum.photos/seed/corrupt46/800/500',
  'https://picsum.photos/seed/timeout47/750/560',
  'https://picsum.photos/seed/retry48/640/480',
  'https://picsum.photos/seed/rollback49/800/600',
  'https://picsum.photos/seed/hotfix50/700/525',
];

const NAMES = [
  'Pirate', 'Corsair', 'Captain', 'Sailor', 'Merchant',
  'Explorer', 'Trader', 'Navigator', 'Admiral', 'Privateer',
  'Buccaneer', 'Smuggler', 'Quartermaster', 'Lookout', 'Boatswain',
];

const MESSAGES_KO = [
  '캐릭터 장비 탭에서 크래시가 자꾸 발생합니다.',
  '세션이 계속 끊겨서 30분마다 재로그인해야 합니다.',
  '인벤토리의 아이템이 중복으로 표시됩니다.',
  '거래 중 강제 크래시가 납니다.',
  'NPC 다이얼로그에서 무한 로딩이 걸립니다.',
  '지도가 로딩되지 않습니다.',
  'PvP 매칭이 5분 이상 걸립니다.',
  '사운드가 갑자기 끊김니다.',
  '캐릭터가 맵 밖으로 빠집니다.',
  '파티 초대가 작동하지 않습니다.',
  '퀘스트 보상이 지급되지 않았습니다.',
  '채팅이 전송되지 않습니다.',
  '스킬 쿨다운이 표시되지 않습니다.',
  '로그인 시 화면이 깜빡입니다.',
  '미니맵이 사라집니다.',
];

const MESSAGES_EN = [
  'Character equipment tab causes crash every time.',
  'Session keeps expiring, have to re-login every 30 minutes.',
  'Inventory items showing duplicates after trade.',
  'Game crashes during PvP matches.',
  'NPC dialog system gets stuck in infinite loop.',
  'Map tiles not loading in northern region.',
  'Matchmaking takes forever.',
  'Audio cuts out randomly during gameplay.',
  'Character falls through the map.',
  'Party invite system is broken.',
  'Quest rewards not granted after completion.',
  'Chat messages fail to send.',
  'Skill cooldown timer not visible.',
  'Screen flickers on login.',
  'Minimap disappears during dungeon.',
];

const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
const OS_LIST = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'];
const ENVS = ['production', 'staging', 'development'];
const RELEASES = ['c.12.0', 'c.11.9', 'c.11.8', 'c.12.1', 'c.12.2'];
const SOURCES = ['dialog', 'crash_report', 'widget', 'api', 'email'];
const CATEGORIES = ['bug', 'feature', 'performance', 'ux', 'security', ''];
const SENTIMENTS = ['negative', 'neutral', 'positive', ''];
const STATUSES = ['unresolved', 'unresolved', 'unresolved', 'resolved', 'ignored']; // weighted

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomDate(daysAgo: number): string {
  const now = Date.now();
  const ts = now - Math.floor(Math.random() * daysAgo * 86400000);
  return new Date(ts).toISOString().replace('T', ' ').replace('Z', '');
}

function generateId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 32);
}

async function main() {
  console.log('🗑️  Truncating argus.user_feedback...');
  await ch.exec({ query: 'TRUNCATE TABLE argus.user_feedback' });
  console.log('✅ Truncated');

  const rows: any[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const nameBase = pick(NAMES);
    const userId = Math.floor(10000 + Math.random() * 90000);
    const useKo = Math.random() < 0.6;
    const message = useKo ? pick(MESSAGES_KO) : pick(MESSAGES_EN);
    const attachmentCount = Math.floor(Math.random() * 4); // 0-3
    const attachments = pickN(IMAGE_POOL, 0, attachmentCount);
    const ts = randomDate(60);

    rows.push({
      feedback_id: generateId(),
      project_id: PROJECT_ID,
      event_id: generateId(),
      timestamp: ts,
      name: `${nameBase}_${userId}`,
      email: `player${userId}@outlook.com`,
      message,
      contact_email: Math.random() < 0.3 ? `player${userId}@outlook.com` : '',
      url: pick(['/game/play', '/game/lobby', '/game/settings', '/game/inventory', '/game/pvp']),
      environment: pick(ENVS),
      release: pick(RELEASES),
      source: pick(SOURCES),
      tags: {},
      status: pick(STATUSES),
      assigned_to: Math.random() < 0.15 ? pick(['admin', 'dev1', 'qa_lead']) : '',
      is_spam: Math.random() < 0.02 ? 1 : 0,
      attachments,
      resolved_at: null,
      browser: pick(BROWSERS),
      browser_version: `${100 + Math.floor(Math.random() * 30)}.0.${Math.floor(Math.random() * 9999)}.${Math.floor(Math.random() * 99)}`,
      os: pick(OS_LIST),
      os_version: `${10 + Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`,
      device: pick(['Desktop', 'Mobile', 'Tablet', '']),
      user_id: `user_${userId}`,
      locale: pick(['ko', 'en', 'ja', 'zh']),
      is_read: Math.random() < 0.4 ? 1 : 0,
      category: pick(CATEGORIES),
      sentiment: pick(SENTIMENTS),
    });
  }

  // Batch insert
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await ch.insert({
      table: 'user_feedback',
      values: batch,
      format: 'JSONEachRow',
    });
    console.log(`  Inserted ${Math.min(i + BATCH, TOTAL)}/${TOTAL}`);
  }

  // Verify
  const result = await ch.query({ query: 'SELECT count() as c FROM argus.user_feedback' });
  const data = await result.json() as any;
  console.log(`✅ Done! Total rows: ${data.data[0].c}`);

  const attachResult = await ch.query({
    query: `SELECT count() as c FROM argus.user_feedback WHERE length(attachments) > 0`,
  });
  const attachData = await attachResult.json() as any;
  console.log(`📎 Rows with attachments: ${attachData.data[0].c}`);

  await ch.close();
}

main().catch(console.error);
