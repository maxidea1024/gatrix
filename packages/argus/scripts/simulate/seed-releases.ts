/**
 * Simulate Data — Releases & Commits
 *
 * Generates release entries in MySQL g_argus_releases and g_argus_releaseCommits.
 */
import { PROJECT_ID, DAYS_BACK } from './config';
import { randomInt, randomPick, uuid } from './helpers';
import { SERVER_RELEASES, CLIENT_RELEASES, LUA_RELEASES } from './releases';

const COMMIT_AUTHORS = [
  { name: '김민준', email: 'minjun@studio.dev' },
  { name: 'Alice Park', email: 'alice@studio.dev' },
  { name: 'Bob Lee', email: 'bob@studio.dev' },
  { name: 'Carol Choi', email: 'carol@studio.dev' },
  { name: 'David Kim', email: 'david@studio.dev' },
  { name: 'Eve Jung', email: 'eve@studio.dev' },
];

const COMMIT_MESSAGES = [
  'fix: resolve crash on character equipment tab',
  'feat: add guild bank transfer validation',
  'perf: optimize sea battle rendering pipeline',
  'fix: session token refresh race condition',
  'chore: bump dependencies',
  'fix: NPC dialog freeze on quest completion',
  'feat: add trade history pagination',
  'fix: matchmaking timeout handling',
  'refactor: extract combat damage calculation',
  'fix: duplicate inventory item after trade',
  'feat: implement fleet battle formation system',
  'fix: memory leak in world map renderer',
  'perf: cache guild rankings query',
  'fix: payment receipt verification timeout',
  'docs: update API documentation',
  'test: add integration tests for auction system',
  'fix: port town lag spike from excessive NPC spawns',
  'feat: add real-time market price notifications',
];

const FILE_CHANGE_POOLS = [
  ['src/game/combat/damage.ts', 'src/game/combat/skills.ts'],
  ['src/server/auth/session.ts', 'src/server/auth/token.ts'],
  ['src/game/trade/handler.ts', 'src/game/inventory/sync.ts'],
  ['src/game/guild/bank.ts', 'src/game/guild/permissions.ts'],
  ['src/game/npc/dialog.ts', 'src/game/quest/tracker.ts'],
  ['src/render/battle/fleet.ts', 'src/render/particles.ts'],
  ['src/server/matchmaking/queue.ts', 'src/server/matchmaking/timeout.ts'],
  ['src/server/payment/verify.ts', 'src/server/payment/receipt.ts'],
];

export async function generateAndInsertReleases(
  pool: any,
  internalProjectId: number
): Promise<number> {
  console.log('\n📦 Generating releases & commits...');

  const allVersions = [...SERVER_RELEASES, ...CLIENT_RELEASES, ...LUA_RELEASES];
  const now = Date.now();
  let releaseCount = 0;

  for (let i = 0; i < allVersions.length; i++) {
    const version = allVersions[i];
    // Space releases over the last DAYS_BACK days
    const daysAgo = Math.floor(
      (DAYS_BACK / allVersions.length) * (allVersions.length - i)
    );
    const dateReleased = new Date(now - daysAgo * 86400000);

    const totalErrors = randomInt(50, 5000);
    const newIssues = randomInt(2, Math.min(totalErrors, 50));
    const totalSessions = randomInt(10000, 200000);
    const totalUsers = randomInt(5000, 80000);
    const crashFreeSessions = 95 + Math.random() * 5; // 95-100%
    const crashFreeUsers = 94 + Math.random() * 6;

    try {
      const [result] = await pool.query(
        `INSERT INTO g_argus_releases
         (project_id, version, short_version, total_errors, new_issues,
          crash_free_sessions, crash_free_users, total_sessions, total_users,
          commit_count, deploy_count, date_released, date_deployed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE total_errors = VALUES(total_errors)`,
        [
          PROJECT_ID,
          version,
          version.split('-')[0],
          totalErrors,
          newIssues,
          crashFreeSessions.toFixed(4),
          crashFreeUsers.toFixed(4),
          totalSessions,
          totalUsers,
          randomInt(3, 25),
          randomInt(1, 5),
          dateReleased,
          dateReleased,
        ]
      );

      const releaseId = result.insertId || result.affectedRows;

      // Insert 3-15 commits per release
      if (releaseId > 0) {
        const commitCount = randomInt(3, 15);
        const commitValues: any[] = [];
        for (let c = 0; c < commitCount; c++) {
          const author = randomPick(COMMIT_AUTHORS);
          const filesChanged = randomPick(FILE_CHANGE_POOLS);
          commitValues.push([
            releaseId,
            uuid().replace(/-/g, '').substring(0, 40),
            author.name,
            author.email,
            randomPick(COMMIT_MESSAGES),
            new Date(dateReleased.getTime() - randomInt(0, 7 * 86400000)),
            JSON.stringify(filesChanged),
          ]);
        }
        if (commitValues.length > 0) {
          await pool.query(
            `INSERT INTO g_argus_releaseCommits
             (release_id, commit_hash, author_name, author_email, message, date_added, files_changed)
             VALUES ?`,
            [commitValues]
          );
        }
      }
      releaseCount++;
    } catch (err: any) {
      if (!err.message?.includes('Duplicate')) {
        console.log(`   ⚠ Release ${version}: ${err.message}`);
      }
    }
  }

  console.log(`   ✓ ${releaseCount} releases with commits inserted`);
  return releaseCount;
}
