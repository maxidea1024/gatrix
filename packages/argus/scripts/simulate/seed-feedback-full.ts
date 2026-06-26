/**
 * Simulate Data — Feedback Enrichment & Links
 *
 * Enriches feedback with status, attachments, device context, sentiment.
 * Creates feedback-issue links and feedback activity records.
 */
import { PROJECT_ID, DAYS_BACK, CHUNK_SIZE } from './config';
import { randomInt, randomPick, randomFloat, uuid, randomDateWeighted, formatDate } from './helpers';
import { USERS } from './user-pool';
import { FEEDBACK_MESSAGES } from './feedback';
import { SERVER_RELEASES } from './releases';

const CATEGORIES = ['bug', 'feature', 'performance', 'ux', 'crash', 'payment', 'content'];
const SENTIMENTS = ['negative', 'negative', 'neutral', 'neutral', 'positive', 'mixed'];
const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'GameClient'];
const OSES = ['Windows', 'macOS', 'Android', 'iOS', 'Linux'];
const DEVICES = ['PC', 'PC', 'PC', 'iPhone 15', 'Galaxy S24', 'iPad Pro', 'Steam Deck', ''];
const SERVICES = ['game-client', 'web-dashboard', 'mobile-app', ''];
const STATUSES = ['unresolved', 'unresolved', 'unresolved', 'resolved', 'ignored'];
const ADMIN_NAMES = ['admin', 'dev_alice', 'qa_bob', 'support_carol'];

const COMMENTS = [
  '확인했습니다. 다음 패치에 반영 예정입니다.',
  'This is a known issue. Working on a fix.',
  '재현 확인 완료. 이슈 등록합니다.',
  'Can you provide more details about your device?',
  '임시 해결 방법을 안내드렸습니다.',
  'Duplicate of existing issue, merging.',
  'Fixed in latest build. Please verify.',
  '감사합니다. 피드백 반영하겠습니다.',
  'Escalated to the dev team.',
  '이슈 연결 완료했습니다.',
  'Closing as resolved. Please reopen if issue persists.',
  '재현 불가. 추가 정보 부탁드립니다.',
];

/**
 * Generate feedback with all enriched columns.
 */
export async function generateAndInsertEnrichedFeedback(
  ch: any,
  chDatabase: string,
  totalFeedback: number,
  activeDsnKeys: number[],
  allEvents: any[],
): Promise<{ feedbackIds: string[]; count: number }> {
  console.log('\n💬 Generating enriched feedback...');
  const feedbackIds: string[] = [];
  let inserted = 0;

  for (let offset = 0; offset < totalFeedback; offset += CHUNK_SIZE) {
    const batch: any[] = [];
    const batchSize = Math.min(CHUNK_SIZE, totalFeedback - offset);

    for (let i = 0; i < batchSize; i++) {
      const user = randomPick(USERS);
      const ts = randomDateWeighted(DAYS_BACK);
      const dsnKeyId = randomPick(activeDsnKeys);
      const fid = uuid();
      feedbackIds.push(fid);

      const status = randomPick(STATUSES);
      const isSpam = Math.random() < 0.03 ? 1 : 0;
      const hasAttachments = Math.random() < 0.3;
      const attachments: string[] = [];
      if (hasAttachments) {
        const count = randomInt(1, 3);
        for (let a = 0; a < count; a++) {
          const w = randomPick([800, 1024, 1280, 1920]);
          const h = randomPick([600, 768, 720, 1080]);
          attachments.push(`https://picsum.photos/seed/${uuid().substring(0, 8)}/${w}/${h}`);
        }
      }

      batch.push({
        feedback_id: fid,
        project_id: PROJECT_ID,
        event_id: randomPick(allEvents).event_id,
        timestamp: formatDate(ts),
        name: user.name,
        email: user.email,
        message: randomPick(FEEDBACK_MESSAGES),
        contact_email: user.email,
        url: randomPick(['/game/play', '/game/port', '/game/battle', '/settings', '/inventory', '/guild', '/market']),
        environment: randomPick(['production', 'production', 'production', 'staging']),
        release: randomPick(SERVER_RELEASES),
        source: randomPick(['widget', 'dialog', 'api', 'sdk']),
        tags: { category: randomPick(CATEGORIES) },
        // Enriched columns
        status,
        assigned_to: status === 'resolved' ? randomPick(ADMIN_NAMES) : (Math.random() < 0.2 ? randomPick(ADMIN_NAMES) : ''),
        is_spam: isSpam,
        attachments,
        resolved_at: status === 'resolved' ? formatDate(new Date(ts.getTime() + randomInt(3600000, 7 * 86400000))) : null,
        // Device context
        browser: randomPick(BROWSERS),
        browser_version: `${randomInt(90, 130)}.0.${randomInt(1000, 9999)}.${randomInt(10, 99)}`,
        os: randomPick(OSES),
        os_version: randomPick(['10', '11', '14.5', '17.2', '6.8', '15.1']),
        device: randomPick(DEVICES),
        user_id: user.id,
        locale: randomPick(['ko-KR', 'en-US', 'ja-JP', 'zh-CN', 'de-DE', '']),
        is_read: Math.random() < 0.6 ? 1 : 0,
        category: randomPick(CATEGORIES),
        sentiment: randomPick(SENTIMENTS),
        service: randomPick(SERVICES),
        dsn_key_id: dsnKeyId,
      });
    }

    await ch.insert({
      table: `${chDatabase}.user_feedback`,
      values: batch,
      format: 'JSONEachRow',
    });
    inserted += batch.length;
    process.stdout.write(`\r   ⏳ ${inserted.toLocaleString()} feedback...`);
  }

  console.log(`\n   ✓ ${inserted.toLocaleString()} enriched feedback entries inserted`);
  return { feedbackIds, count: inserted };
}

/**
 * Seed feedback-issue links and feedback activity records.
 */
export async function seedFeedbackLinksAndActivity(
  pool: any,
  ch: any,
  feedbackIds: string[],
  _internalProjectId: number,
): Promise<void> {
  console.log('\n🔗 Seeding feedback-issue links & activity...');

  // Get existing issue IDs
  let issueIds: number[] = [];
  try {
    const [rows] = await pool.query(
      'SELECT id FROM g_argus_issues WHERE project_id = ? ORDER BY id LIMIT 200',
      [PROJECT_ID]
    );
    issueIds = (rows as any[]).map((r: any) => r.id);
  } catch {
    console.log('   ⚠ No issues found, skipping links');
  }

  if (issueIds.length === 0 || feedbackIds.length === 0) {
    console.log('   ⚠ Skipping feedback links (no issues or feedback)');
    return;
  }

  // Ensure tables exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS g_argus_feedback_issue_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      feedback_id VARCHAR(64) NOT NULL,
      issue_id INT NOT NULL,
      created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
      updated_at DATETIME DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_feedback (project_id, feedback_id),
      INDEX idx_issue (issue_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS g_argus_feedback_activity (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      feedback_id VARCHAR(64) NOT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      action ENUM('status_change','assign','comment','mark_spam','unmark_spam') NOT NULL,
      data JSON DEFAULT NULL,
      created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_feedback (project_id, feedback_id),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Clear existing
  try {
    await pool.query('DELETE FROM g_argus_feedback_issue_links WHERE project_id = ?', [PROJECT_ID]);
    await pool.query('DELETE FROM g_argus_feedback_activity WHERE project_id = ?', [PROJECT_ID]);
  } catch { /* tables might not exist yet */ }

  // Link ~20% of feedbacks to issues
  const shuffled = [...feedbackIds].sort(() => Math.random() - 0.5);
  const toLink = shuffled.slice(0, Math.floor(feedbackIds.length * 0.2));

  const BATCH = 100;
  for (let i = 0; i < toLink.length; i += BATCH) {
    const batch = toLink.slice(i, i + BATCH);
    const values = batch.map(fid =>
      `('${PROJECT_ID}', '${fid}', ${randomPick(issueIds)}, UTC_TIMESTAMP())`
    );
    try {
      await pool.query(
        `INSERT IGNORE INTO g_argus_feedback_issue_links
         (project_id, feedback_id, issue_id, created_at) VALUES ${values.join(',')}`
      );
    } catch { /* ignore duplicates */ }
  }
  console.log(`   ✓ ${toLink.length} feedback-issue links created`);

  // Seed activity for ~30% of feedbacks
  const forActivity = shuffled.slice(0, Math.floor(feedbackIds.length * 0.3));
  let totalActivities = 0;

  for (let i = 0; i < forActivity.length; i += BATCH) {
    const batch = forActivity.slice(i, i + BATCH);
    const values: string[] = [];

    for (const fid of batch) {
      const entryCount = randomInt(1, 3);
      for (let j = 0; j < entryCount; j++) {
        const userName = randomPick([...ADMIN_NAMES, null as any]);
        const userNameSql = userName ? `'${userName}'` : 'NULL';
        const rand = Math.random();

        if (rand < 0.5) {
          const comment = randomPick(COMMENTS).replace(/'/g, "\\'");
          values.push(
            `('${PROJECT_ID}', '${fid}', ${userNameSql}, 'comment', '${JSON.stringify({ text: comment }).replace(/'/g, "\\'")}', UTC_TIMESTAMP() - INTERVAL ${randomInt(1, 168)} HOUR)`
          );
        } else if (rand < 0.8) {
          const to = randomPick(['resolved', 'ignored', 'unresolved']);
          values.push(
            `('${PROJECT_ID}', '${fid}', ${userNameSql}, 'status_change', '${JSON.stringify({ from: 'unresolved', to })}', UTC_TIMESTAMP() - INTERVAL ${randomInt(1, 168)} HOUR)`
          );
        } else {
          const assignee = randomPick(ADMIN_NAMES);
          values.push(
            `('${PROJECT_ID}', '${fid}', ${userNameSql}, 'assign', '${JSON.stringify({ assigned_to: assignee })}', UTC_TIMESTAMP() - INTERVAL ${randomInt(1, 168)} HOUR)`
          );
        }
        totalActivities++;
      }
    }

    if (values.length > 0) {
      try {
        await pool.query(
          `INSERT INTO g_argus_feedback_activity
           (project_id, feedback_id, user_name, action, data, created_at) VALUES ${values.join(',')}`
        );
      } catch (e: any) {
        console.log(`   ⚠ Activity batch error: ${e.message?.substring(0, 80)}`);
      }
    }
  }
  console.log(`   ✓ ${totalActivities} feedback activity records created`);
}
