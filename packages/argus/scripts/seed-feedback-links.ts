/**
 * Seed feedback-issue links
 * Links ~20% of existing feedback to random existing issues, simulating SDK CaptureFeedback(..., issueId)
 * Also seeds some activity records (comments, status changes) on feedback
 *
 * Usage: npx tsx scripts/seed-feedback-links.ts
 */
import { createClient } from '@clickhouse/client';
import mysql from 'mysql2/promise';

const PROJECT_ID = '01KN8GSHBJ10JTQ9D0HD60RKFV';
const INTERNAL_PROJECT_ID = 1; // MySQL project_id (numeric)
const LINK_RATIO = 0.20; // 20% of feedbacks get linked

const ch = createClient({
  url: 'http://localhost:48123',
  database: 'argus',
  username: 'default',
  password: '',
});

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '43306', 10),
  database: 'gatrix',
  user: process.env.MYSQL_USER || 'gatrix_user',
  password: process.env.MYSQL_PASSWORD || 'gatrix_password',
  timezone: '+00:00',
});

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  // 1. Get existing issues from MySQL
  console.log('📋 Fetching existing issues from MySQL...');
  const [issueRows] = await pool.query(
    'SELECT id, title, status FROM g_argus_issues WHERE project_id = ? ORDER BY id LIMIT 200',
    [INTERNAL_PROJECT_ID]
  );
  const issues = issueRows as { id: number; title: string; status: string }[];
  console.log(`   Found ${issues.length} issues`);

  if (issues.length === 0) {
    console.log('❌ No issues found. Aborting.');
    await cleanup();
    return;
  }

  // 2. Get existing feedback IDs from ClickHouse
  console.log('📋 Fetching feedback IDs from ClickHouse...');
  const fbResult = await ch.query({
    query: `SELECT feedback_id FROM argus.user_feedback WHERE project_id = {pid:String} ORDER BY rand() LIMIT 2500`,
    query_params: { pid: PROJECT_ID },
  });
  const fbData = await fbResult.json<{ data: { feedback_id: string }[] }>();
  const feedbackIds = fbData.data.map(r => r.feedback_id);
  console.log(`   Found ${feedbackIds.length} feedbacks`);

  // 3. Ensure tables exist
  console.log('🔧 Ensuring tables exist...');
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

  // 4. Clear existing links and activities
  console.log('🗑️  Clearing existing links and activities...');
  await pool.query('DELETE FROM g_argus_feedback_issue_links WHERE project_id = ?', [PROJECT_ID]);
  await pool.query('DELETE FROM g_argus_feedback_activity WHERE project_id = ?', [PROJECT_ID]);

  // 5. Create links for ~20% of feedbacks
  const linkCount = Math.floor(feedbackIds.length * LINK_RATIO);
  const shuffled = [...feedbackIds].sort(() => Math.random() - 0.5);
  const toLink = shuffled.slice(0, linkCount);

  console.log(`🔗 Linking ${toLink.length} feedbacks to issues...`);

  const BATCH = 100;
  for (let i = 0; i < toLink.length; i += BATCH) {
    const batch = toLink.slice(i, i + BATCH);
    const values = batch.map(fid => {
      const issue = pick(issues);
      return `('${PROJECT_ID}', '${fid}', ${issue.id}, UTC_TIMESTAMP())`;
    });
    await pool.query(
      `INSERT IGNORE INTO g_argus_feedback_issue_links (project_id, feedback_id, issue_id, created_at) VALUES ${values.join(',')}`
    );
    console.log(`   Linked ${Math.min(i + BATCH, toLink.length)}/${toLink.length}`);
  }

  // 6. Seed some activity records (comments + status_change)
  const ADMIN_NAMES = ['admin', 'dev_alice', 'qa_bob', 'support_carol', null];
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
  ];

  // ~30% of feedbacks get 1-3 activity entries
  const activityCount = Math.floor(feedbackIds.length * 0.30);
  const forActivity = shuffled.slice(0, activityCount);

  console.log(`💬 Seeding activities for ${forActivity.length} feedbacks...`);

  let totalActivities = 0;
  for (let i = 0; i < forActivity.length; i += BATCH) {
    const batch = forActivity.slice(i, i + BATCH);
    const values: string[] = [];

    for (const fid of batch) {
      const entryCount = 1 + Math.floor(Math.random() * 3); // 1-3 activities
      for (let j = 0; j < entryCount; j++) {
        const userName = pick(ADMIN_NAMES);
        const userNameSql = userName ? `'${userName}'` : 'NULL';
        const rand = Math.random();

        if (rand < 0.5) {
          // Comment
          const comment = pick(COMMENTS);
          values.push(
            `('${PROJECT_ID}', '${fid}', ${userNameSql}, 'comment', '${JSON.stringify({ text: comment }).replace(/'/g, "\\'")}', UTC_TIMESTAMP() - INTERVAL ${Math.floor(Math.random() * 168)} HOUR)`
          );
        } else if (rand < 0.8) {
          // Status change
          const to = pick(['resolved', 'ignored', 'unresolved']);
          values.push(
            `('${PROJECT_ID}', '${fid}', ${userNameSql}, 'status_change', '${JSON.stringify({ from: 'unresolved', to })}', UTC_TIMESTAMP() - INTERVAL ${Math.floor(Math.random() * 168)} HOUR)`
          );
        } else {
          // Assign
          const assignee = pick(['admin', 'dev_alice', 'qa_bob']);
          values.push(
            `('${PROJECT_ID}', '${fid}', ${userNameSql}, 'assign', '${JSON.stringify({ assigned_to: assignee })}', UTC_TIMESTAMP() - INTERVAL ${Math.floor(Math.random() * 168)} HOUR)`
          );
        }
        totalActivities++;
      }
    }

    if (values.length > 0) {
      await pool.query(
        `INSERT INTO g_argus_feedback_activity (project_id, feedback_id, user_name, action, data, created_at) VALUES ${values.join(',')}`
      );
    }
    console.log(`   Activities: ${Math.min(i + BATCH, forActivity.length)}/${forActivity.length} feedbacks processed`);
  }

  // 7. Verify
  const [linkResult] = await pool.query(
    'SELECT COUNT(*) as c FROM g_argus_feedback_issue_links WHERE project_id = ?',
    [PROJECT_ID]
  );
  const [actResult] = await pool.query(
    'SELECT COUNT(*) as c FROM g_argus_feedback_activity WHERE project_id = ?',
    [PROJECT_ID]
  );

  console.log(`\n✅ Done!`);
  console.log(`   🔗 Issue links: ${(linkResult as any[])[0].c}`);
  console.log(`   💬 Activity records: ${(actResult as any[])[0].c} (${totalActivities} expected)`);

  await cleanup();
}

async function cleanup() {
  await ch.close();
  await pool.end();
}

main().catch(async (err) => {
  console.error('❌ Error:', err);
  await cleanup();
  process.exit(1);
});
