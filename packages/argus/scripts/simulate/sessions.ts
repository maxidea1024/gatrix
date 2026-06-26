import { PROJECT_ID, CHUNK_SIZE, DAYS_BACK } from './config';
import { randomInt, randomPick, weightedPick, randomDateWeighted, formatDate, uuid } from './helpers';
import { USERS, BROWSERS, OS_LIST } from './user-pool';
import { SERVER_RELEASES, CLIENT_RELEASES } from './releases';

export async function generateAndInsertSessions(
  ch: any,
  chDatabase: string,
  totalSessions: number,
  activeDsnKeys: number[]
): Promise<number> {
  console.log('\n👥 Generating sessions...');
  let sessCount = 0;
  for (let i = 0; i < totalSessions; i += CHUNK_SIZE) {
    const sessBatch: any[] = [];
    const batchSize = Math.min(CHUNK_SIZE, totalSessions - i);
    for (let j = 0; j < batchSize; j++) {
      const user = randomPick(USERS);
      const ts = randomDateWeighted(DAYS_BACK);
      const dur = randomInt(60, 7200);
      const browser = weightedPick(BROWSERS, BROWSERS.map((b) => b.w));
      const os = weightedPick(OS_LIST, OS_LIST.map((o) => o.w));
      const dsnKeyId = randomPick(activeDsnKeys);

      const hasUtm = Math.random() < 0.65;
      const utmSource = hasUtm ? randomPick(['google', 'facebook', 'unity', 'naver', 'youtube']) : null;
      const utmMedium = hasUtm ? randomPick(['cpc', 'cpa', 'social', 'display', 'organic']) : null;
      const utmCampaign = hasUtm ? randomPick(['summer_sale_2026', 'brand_awareness', 'pre_registration', 're_engagement']) : null;
      const utmTerm = hasUtm && Math.random() < 0.5 ? randomPick(['best_rpg_game', 'free_to_play', 'strategy_rpg']) : null;
      const utmContent = hasUtm && Math.random() < 0.5 ? randomPick(['banner_a', 'video_ad_30s', 'text_ad_v2', 'main_banner']) : null;

      sessBatch.push({
        session_id: uuid(),
        project_id: PROJECT_ID,
        user_id: user.id,
        started: formatDate(ts),
        duration: dur,
        status: randomPick(['exited', 'exited', 'exited', 'crashed', 'abnormal']),
        errors: Math.random() < 0.15 ? randomInt(1, 5) : 0,
        environment: randomPick(['production', 'staging']),
        release: randomPick([...SERVER_RELEASES, ...CLIENT_RELEASES]),
        user_agent: `${browser.name}/${browser.version}`,
        os_name: os.name,
        os_version: os.version,
        ip_address: user.ip,
        country_code: user.country,
        dsn_key_id: dsnKeyId,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_term: utmTerm,
        utm_content: utmContent,
      });
    }
    await ch.insert({ table: `${chDatabase}.sessions`, values: sessBatch, format: 'JSONEachRow' });
    sessCount += sessBatch.length;
    process.stdout.write(`\r   ⏳ ${sessCount.toLocaleString()} sessions...`);
  }
  console.log(`\n   ✓ ${sessCount.toLocaleString()} sessions inserted`);
  return sessCount;
}
