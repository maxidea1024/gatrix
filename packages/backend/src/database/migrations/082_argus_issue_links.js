exports.up = async function (connection) {
  console.log('[082] Creating g_argus_issue_links table...');

  // Check if table already exists
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_issue_links'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_issue_links (
        id INT NOT NULL AUTO_INCREMENT,
        project_id VARCHAR(64) NOT NULL,
        issue_id BIGINT NOT NULL,
        tracker_id INT NOT NULL,
        external_url VARCHAR(512) NOT NULL,
        external_key VARCHAR(100) NOT NULL,
        created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
        PRIMARY KEY (id),
        UNIQUE KEY uk_issue_tracker (issue_id, tracker_id),
        KEY idx_project_issue (project_id, issue_id),
        KEY idx_tracker (tracker_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[082] ✓ g_argus_issue_links table created');
  } else {
    console.log('[082] ✓ g_argus_issue_links table already exists');
  }

  // Migrate existing external_url/external_key data from g_argus_issues
  console.log('[082] Migrating existing external links...');
  const [existingLinks] = await connection.execute(
    `SELECT i.id AS issue_id, i.project_id, i.external_url, i.external_key
     FROM g_argus_issues i
     WHERE i.external_url IS NOT NULL AND i.external_key IS NOT NULL`
  );

  let migrated = 0;
  for (const row of existingLinks) {
    // Determine provider from URL
    let provider = null;
    if (row.external_url.includes('github.com')) provider = 'github';
    else if (row.external_url.includes('atlassian.net') || row.external_url.includes('jira')) provider = 'jira';
    else if (row.external_url.includes('linear.app')) provider = 'linear';
    else if (row.external_url.includes('clickup.com')) provider = 'clickup';
    else if (row.external_url.includes('app.asana.com')) provider = 'asana';
    else if (row.external_url.includes('youtrack')) provider = 'youtrack';
    else if (row.external_url.includes('dev.azure.com')) provider = 'azure_devops';
    else if (row.external_url.includes('shortcut.com')) provider = 'shortcut';
    else if (row.external_url.includes('trello.com')) provider = 'trello';
    else if (row.external_url.includes('redmine')) provider = 'redmine';
    else if (row.external_url.includes('notion.so')) provider = 'notion';

    if (!provider) {
      console.log(`[082]   Skipping issue ${row.issue_id}: unknown provider for URL ${row.external_url}`);
      continue;
    }

    // Find matching tracker config
    const [trackers] = await connection.execute(
      `SELECT id FROM g_argus_issue_trackers
       WHERE project_id = ? AND provider = ? AND enabled = 1
       LIMIT 1`,
      [row.project_id, provider]
    );

    if (trackers.length === 0) {
      console.log(`[082]   Skipping issue ${row.issue_id}: no ${provider} tracker configured for project ${row.project_id}`);
      continue;
    }

    const trackerId = trackers[0].id;

    // Check if link already exists (idempotent)
    const [existing] = await connection.execute(
      `SELECT id FROM g_argus_issue_links WHERE issue_id = ? AND tracker_id = ?`,
      [row.issue_id, trackerId]
    );

    if (existing.length === 0) {
      await connection.execute(
        `INSERT INTO g_argus_issue_links (project_id, issue_id, tracker_id, external_url, external_key)
         VALUES (?, ?, ?, ?, ?)`,
        [row.project_id, row.issue_id, trackerId, row.external_url, row.external_key]
      );
      migrated++;
    }
  }

  console.log(`[082] ✓ Migrated ${migrated} existing links (${existingLinks.length} total found)`);
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_argus_issue_links`);
};
