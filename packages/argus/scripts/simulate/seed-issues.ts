/**
 * Simulate Data — Issue Enrichment
 *
 * Distributes issues across statuses, assigns owners, and creates issue activity records.
 */
import { PROJECT_ID } from './config';
import { randomInt, randomPick } from './helpers';

const ADMIN_NAMES = ['admin', 'dev_alice', 'qa_bob', 'carol', 'david', null];
const PRIORITIES = [
  'critical',
  'high',
  'medium',
  'medium',
  'medium',
  'low',
  'low',
];

const ACTIVITY_TEMPLATES = [
  {
    action: 'status_change',
    dataFn: () => ({
      from: 'unresolved',
      to: randomPick(['resolved', 'ignored']),
    }),
  },
  {
    action: 'assign',
    dataFn: () => ({
      assigned_to: randomPick(['admin', 'dev_alice', 'qa_bob', 'carol']),
    }),
  },
  {
    action: 'priority_change',
    dataFn: () => ({
      from: 'medium',
      to: randomPick(['critical', 'high', 'low']),
    }),
  },
  {
    action: 'comment',
    dataFn: () => ({
      text: randomPick([
        'Investigating this issue',
        'Confirmed on staging',
        'Fix deployed in v3.13.1',
        'Duplicate of #42',
        'Cannot reproduce',
        'Root cause identified in combat module',
        'Adding regression test',
        'Monitoring after hotfix',
        'Reverting to previous behavior',
        '재현 확인. 다음 패치에 수정 예정.',
        'QA verified fix',
      ]),
    }),
  },
];

export async function enrichIssues(
  pool: any,
  _internalProjectId: number
): Promise<void> {
  console.log('\n🐛 Enriching issues (status, assignee, priority)...');

  // Get all issue IDs
  let issueIds: number[] = [];
  try {
    const [rows] = await pool.query(
      'SELECT id FROM g_argus_issues WHERE project_id = ? ORDER BY id',
      [PROJECT_ID]
    );
    issueIds = (rows as any[]).map((r: any) => r.id);
  } catch {
    console.log('   ⚠ No issues found');
    return;
  }

  if (issueIds.length === 0) return;

  // Distribute: ~40% unresolved, ~35% resolved, ~15% ignored, ~10% regressed
  const statusDist = [
    { status: 'unresolved', ratio: 0.4 },
    { status: 'resolved', ratio: 0.35 },
    { status: 'ignored', ratio: 0.15 },
    { status: 'regressed', ratio: 0.1 },
  ];

  let idx = 0;
  for (const { status, ratio } of statusDist) {
    const count = Math.floor(issueIds.length * ratio);
    const subset = issueIds.slice(idx, idx + count);
    idx += count;

    if (subset.length === 0) continue;

    const assignee =
      status === 'unresolved'
        ? Math.random() < 0.3
          ? randomPick(['admin', 'dev_alice', 'qa_bob'])
          : null
        : randomPick(['admin', 'dev_alice', 'qa_bob', 'carol', null]);

    const priority = randomPick(PRIORITIES);

    try {
      await pool.query(
        `UPDATE g_argus_issues
         SET status = ?,
             assigned_to = ?,
             priority = ?,
             resolved_at = ${status === 'resolved' ? 'NOW() - INTERVAL ? DAY' : 'NULL'},
             resolved_by = ${status === 'resolved' ? '1' : 'NULL'}
         WHERE id IN (${subset.join(',')})`,
        status === 'resolved'
          ? [status, assignee, priority, randomInt(1, 30)]
          : [status, assignee, priority]
      );
    } catch (e: any) {
      console.log(`   ⚠ Status update error: ${e.message?.substring(0, 80)}`);
    }
  }
  console.log(`   ✓ ${issueIds.length} issues distributed across statuses`);

  // Generate issue activity
  console.log('   📝 Generating issue activity...');

  // Ensure table exists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS g_argus_issue_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        issue_id BIGINT NOT NULL,
        user_name VARCHAR(255) DEFAULT NULL,
        action VARCHAR(50) NOT NULL,
        data JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_project_issue (project_id, issue_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch {}

  // Clear existing
  try {
    await pool.query(
      'DELETE FROM g_argus_issue_activity WHERE project_id = ?',
      [PROJECT_ID]
    );
  } catch {}

  // ~50% of issues get 1-5 activity entries
  const forActivity = issueIds.filter(() => Math.random() < 0.5);
  let totalActivities = 0;

  const BATCH = 100;
  for (let i = 0; i < forActivity.length; i += BATCH) {
    const batch = forActivity.slice(i, i + BATCH);
    const values: string[] = [];

    for (const issueId of batch) {
      const entryCount = randomInt(1, 5);
      for (let j = 0; j < entryCount; j++) {
        const tpl = randomPick(ACTIVITY_TEMPLATES);
        const userName = randomPick(ADMIN_NAMES);
        const userNameSql = userName ? `'${userName}'` : 'NULL';
        const data = JSON.stringify(tpl.dataFn()).replace(/'/g, "\\'");

        values.push(
          `('${PROJECT_ID}', ${issueId}, ${userNameSql}, '${tpl.action}', '${data}', UTC_TIMESTAMP() - INTERVAL ${randomInt(1, 720)} HOUR)`
        );
        totalActivities++;
      }
    }

    if (values.length > 0) {
      try {
        await pool.query(
          `INSERT INTO g_argus_issue_activity
           (project_id, issue_id, user_name, action, data, created_at) VALUES ${values.join(',')}`
        );
      } catch (e: any) {
        console.log(
          `   ⚠ Issue activity error: ${e.message?.substring(0, 80)}`
        );
      }
    }
  }
  console.log(`   ✓ ${totalActivities} issue activity records created`);
}
