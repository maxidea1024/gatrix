/**
 * Simulate Data — Feedback Message Templates
 */
import { PROJECT_ID, CHUNK_SIZE, DAYS_BACK } from './config';
import { randomDateWeighted, formatDate, uuid, randomPick } from './helpers';
import { USERS } from './user-pool';

export const FEEDBACK_MESSAGES_KO = [
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
];
export const FEEDBACK_MESSAGES_EN = [
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
];

export const FEEDBACK_MESSAGES = [...FEEDBACK_MESSAGES_KO, ...FEEDBACK_MESSAGES_EN];

export async function generateAndInsertFeedback(
  ch: any,
  chDatabase: string,
  totalFeedback: number,
  activeDsnKeys: number[],
  allEvents: any[]
): Promise<number> {
  console.log('\n💬 Generating feedback...');
  const feedbackBatch: any[] = [];
  for (let i = 0; i < totalFeedback; i++) {
    const user = randomPick(USERS);
    const ts = randomDateWeighted(DAYS_BACK);
    const dsnKeyId = randomPick(activeDsnKeys);
    feedbackBatch.push({
      feedback_id: uuid(),
      project_id: PROJECT_ID,
      event_id: randomPick(allEvents).event_id,
      timestamp: formatDate(ts),
      name: user.name,
      email: user.email,
      comments: randomPick(FEEDBACK_MESSAGES),
      url: randomPick(['/game/play', '/game/port', '/settings', '/guild', '/market']),
      tags: { category: randomPick(['bug', 'feature', 'performance', 'ux', 'crash']) },
      dsn_key_id: dsnKeyId,
    });
  }
  for (let offset = 0; offset < feedbackBatch.length; offset += CHUNK_SIZE) {
    const chunk = feedbackBatch.slice(offset, offset + CHUNK_SIZE);
    await ch.insert({ table: `${chDatabase}.user_feedback`, values: chunk, format: 'JSONEachRow' });
  }
  console.log(`   ✓ ${feedbackBatch.length.toLocaleString()} feedback entries inserted`);
  return feedbackBatch.length;
}
