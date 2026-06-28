/**
 * Quick script to re-seed only the user_feedback table with enriched data.
 * Usage: npx tsx scripts/reseed-feedback.ts
 */
import { createClient } from '@clickhouse/client';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CH_CONFIG = {
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
};

const PROJECT_ID = '01KVVVJEGKQ10X59AZW7P0ASCH';
const TOTAL_FEEDBACK = 5000;
const DAYS_BACK = 14;
const CHUNK_SIZE = 500;

const randomPick = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// ─── Data Pools ───────────────────────────────────────────────────────────────

const FEEDBACK_MESSAGES_KO = [
  '항해 중 갑자기 튕겼어요. 전투 중이라 손해가 커요.',
  '결제했는데 아이템이 안 들어왔어요. 주문번호 확인 부탁드립니다.',
  '최근 패치 이후 렉이 심해졌어요. 특히 리스본 항구에서요.',
  '길드 은행에서 아이템 이동이 안 됩니다.',
  '매칭이 2분 넘게 걸리다 실패해요. 시간대 상관없이 그래요.',
  '캐릭터 장비 탭 열면 크래시 납니다.',
  '해전 중 프레임 드랍이 심해요. 10fps 이하로 떨어져요.',
  '인벤토리에 아이템이 중복으로 들어가 있어요.',
  'NPC 대화가 도중에 끊겨요. 퀘스트 진행이 안 됩니다.',
  '로그인이 자꾸 만료돼서 다시 로그인해야 해요.',
  '이번 업데이트 정말 좋아요! 새 퀘스트 시스템 최고!',
  '성능 개선 체감돼요, 훨씬 부드러워졌어요.',
  '길드 기능 추가 정말 필요했는데 감사합니다!',
  'UI가 깔끔해져서 좋아요.',
  '다크 모드 추가해주세요.',
  '캐릭터 커스터마이징 좀 더 다양했으면 좋겠어요.',
  '다음 확장팩은 언제 나오나요?',
  '튜토리얼이 좀 더 자세했으면 좋겠어요.',
];

const FEEDBACK_MESSAGES_EN = [
  'Game crashes during sea battles. Lost valuable cargo.',
  'Payment went through but items not received. Please check order.',
  'Lag spikes since last patch, especially in port towns.',
  'Guild bank transfers keep failing with error.',
  'Matchmaking takes forever and then times out.',
  'Character equipment tab causes crash every time.',
  'FPS drops below 10 during fleet battles.',
  'Duplicate items appeared in my inventory after trade.',
  'NPC dialog freezes mid-conversation, cannot complete quest.',
  'Session keeps expiring, have to re-login every 30 minutes.',
  'Great update! The new quest system is amazing.',
  'Love the performance improvements, much smoother now.',
];

const FEEDBACK_MESSAGES = [...FEEDBACK_MESSAGES_KO, ...FEEDBACK_MESSAGES_EN];

const NAMES = [
  '김민준', '이서연', '박지호', '최유진', '정하은', '강도현', '송민서', '한지우',
  '윤서준', '임하린', 'CaptainJack', 'Player_Alpha', 'Player_Beta', 'TestUser01',
  'StarNavigator', 'GuildMaster99',
];
const EMAILS = NAMES.map(
  (n) => `${n.replace(/\s/g, '').toLowerCase()}@test.com`
);
const RELEASES = ['3.13.0-rc.1', '3.12.5', '3.12.4', '3.11.0'];
const CATEGORIES = ['bug', 'feature_request', 'performance', 'ux', 'crash', 'payment', 'content', 'other'];
const SENTIMENTS = ['negative', 'negative', 'neutral', 'neutral', 'positive', 'mixed'];
const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'GameClient'];
const OSES = ['Windows', 'macOS', 'Android', 'iOS', 'Linux'];
const DEVICES = ['PC', 'PC', 'PC', 'iPhone 15', 'Galaxy S24', 'iPad Pro', 'Steam Deck', ''];
const STATUSES = ['unresolved', 'unresolved', 'unresolved', 'resolved', 'ignored'];
const ADMIN_NAMES = ['admin', 'dev_alice', 'qa_bob', 'support_carol'];

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

  console.log(`💬 Generating ${TOTAL_FEEDBACK} enriched feedback entries...`);
  let inserted = 0;

  for (let offset = 0; offset < TOTAL_FEEDBACK; offset += CHUNK_SIZE) {
    const batch: any[] = [];
    const batchSize = Math.min(CHUNK_SIZE, TOTAL_FEEDBACK - offset);

    for (let i = 0; i < batchSize; i++) {
      const ts = new Date(Date.now() - randomInt(0, DAYS_BACK * 86400000));
      const nameIdx = randomInt(0, NAMES.length - 1);
      const status = randomPick(STATUSES);
      const isSpam = Math.random() < 0.03 ? 1 : 0;

      // ~30% have screenshot attachments
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
          '/game/play', '/game/port', '/game/battle',
          '/settings', '/inventory', '/guild', '/market',
        ]),
        environment: randomPick(['production', 'production', 'production', 'staging']),
        release: randomPick(RELEASES),
        source: randomPick(['widget', 'dialog', 'api', 'sdk']),
        tags: {},
        // Enriched columns
        status,
        assigned_to:
          status === 'resolved'
            ? randomPick(ADMIN_NAMES)
            : Math.random() < 0.2
              ? randomPick(ADMIN_NAMES)
              : '',
        is_spam: isSpam,
        attachments,
        resolved_at:
          status === 'resolved'
            ? new Date(ts.getTime() + randomInt(3600000, 7 * 86400000)).toISOString()
            : null,
        // Device context
        browser: randomPick(BROWSERS),
        browser_version: `${randomInt(90, 130)}.0.${randomInt(1000, 9999)}.${randomInt(10, 99)}`,
        os: randomPick(OSES),
        os_version: randomPick(['10', '11', '14.5', '17.2', '6.8', '15.1']),
        device: randomPick(DEVICES),
        user_id: `user_${randomInt(1, 10000)}`,
        locale: randomPick(['ko-KR', 'en-US', 'ja-JP', 'zh-CN', 'de-DE', '']),
        is_read: Math.random() < 0.6 ? 1 : 0,
        category: randomPick(CATEGORIES),
        sentiment: randomPick(SENTIMENTS),
        avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(NAMES[nameIdx])}`,
      });
    }

    await ch.insert({
      table: `${CH_CONFIG.database}.user_feedback`,
      values: batch,
      format: 'JSONEachRow',
    });
    inserted += batch.length;
    process.stdout.write(`\r   ⏳ ${inserted.toLocaleString()} / ${TOTAL_FEEDBACK.toLocaleString()} feedback...`);
  }

  const withAtt = inserted; // approximate
  console.log(
    `\n✅ Inserted ${inserted.toLocaleString()} enriched feedback entries (~30% with attachments)`
  );

  await ch.close();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
