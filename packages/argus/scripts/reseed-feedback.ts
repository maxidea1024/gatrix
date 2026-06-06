/**
 * Quick script to re-seed only the user_feedback table with attachments.
 * Usage: npx ts-node --transpile-only scripts/reseed-feedback.ts
 */
import { createClient } from '@clickhouse/client';
import { v4 as uuid } from 'uuid';

const CH_CONFIG = {
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
};

const PROJECT_ID = '01KN8GSHBJ10JTQ9D0HD60RKFV';
const TOTAL_FEEDBACK = 5000;
const DAYS_BACK = 14;

const randomPick = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const FEEDBACK_MESSAGES = [
  '해전 중에 자꾸 튕겨요. 교역품 날아갔어요.',
  '결제했는데 아이템 안 왔어요. 주문번호 확인 좀요.',
  '지난 패치 이후로 랙 심해졌어요, 항구 근처에서 특히.',
  '길드 은행 이체가 계속 실패합니다.',
  '매칭이 너무 오래 걸려요 그러다 타임아웃.',
  '캐릭터 장비탭 열면 크래시 나요.',
  '함대전에서 FPS 10 이하로 떨어져요.',
  '교역 후 인벤토리에 아이템이 중복으로 생겼어요.',
  'NPC 대화가 중간에 멈춰서 퀘스트 진행 불가.',
  '세션 만료가 너무 잦아요, 30분마다 재로그인해야 됨.',
  'Game crashes during sea battles. Lost valuable cargo.',
  'Payment went through but items not received.',
  'Lag spikes since last patch, especially in port towns.',
  'Guild bank transfers keep failing with error.',
  'Matchmaking takes forever and then times out.',
];

const NAMES = [
  '김민준',
  '이서연',
  '박지호',
  '최유진',
  '정하은',
  '강도현',
  'Player_Alpha',
  'Player_Beta',
  'TestUser01',
  'CaptainJack',
];
const EMAILS = NAMES.map(
  (n) => `${n.replace(/\s/g, '').toLowerCase()}@test.com`
);
const RELEASES = ['3.13.0-rc.1', '3.12.5', '3.12.4', '3.11.0'];

async function main() {
  const ch = createClient({
    url: CH_CONFIG.url,
    database: CH_CONFIG.database,
    username: CH_CONFIG.username,
    password: CH_CONFIG.password,
    clickhouse_settings: { date_time_input_format: 'best_effort' },
  });

  console.log('🗑️  Truncating user_feedback...');
  await ch.exec({
    query: `TRUNCATE TABLE IF EXISTS ${CH_CONFIG.database}.user_feedback`,
  });

  console.log(`💬 Generating ${TOTAL_FEEDBACK} feedback entries...`);
  const batch: any[] = [];

  for (let i = 0; i < TOTAL_FEEDBACK; i++) {
    const ts = new Date(Date.now() - randomInt(0, DAYS_BACK * 86400000));
    const nameIdx = randomInt(0, NAMES.length - 1);

    // ~30% of feedback has screenshot attachments
    const attachments: string[] = [];
    if (Math.random() < 0.3) {
      const numAttachments = randomInt(1, 3);
      for (let a = 0; a < numAttachments; a++) {
        const w = randomPick([800, 1024, 1280, 1920]);
        const h = randomPick([600, 768, 720, 1080]);
        attachments.push(
          `https://picsum.photos/seed/${uuid().substring(0, 8)}/${w}/${h}`
        );
      }
    }

    batch.push({
      feedback_id: uuid().replace(/-/g, ''),
      project_id: PROJECT_ID,
      event_id: uuid().replace(/-/g, ''),
      timestamp: ts.toISOString(),
      name: NAMES[nameIdx],
      email: EMAILS[nameIdx],
      message: randomPick(FEEDBACK_MESSAGES),
      contact_email: EMAILS[nameIdx],
      url: randomPick([
        '/game/play',
        '/game/port',
        '/game/battle',
        '/settings',
        '/inventory',
        '/guild',
      ]),
      environment: randomPick(['production', 'production', 'staging']),
      release: randomPick(RELEASES),
      source: randomPick(['widget', 'dialog', 'api']),
      tags: {},
      attachments,
    });
  }

  await ch.insert({
    table: `${CH_CONFIG.database}.user_feedback`,
    values: batch,
    format: 'JSONEachRow',
  });

  const withAtt = batch.filter((b) => b.attachments.length > 0).length;
  console.log(
    `✅ Inserted ${batch.length} feedback entries (${withAtt} with attachments)`
  );

  await ch.close();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
