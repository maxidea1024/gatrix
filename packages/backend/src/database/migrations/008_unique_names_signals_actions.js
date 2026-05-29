/**
 * 008 - Add unique constraints for signal endpoint and action set names
 *
 * g_signal_endpoints:
 *   + UNIQUE INDEX on (projectId, name)
 *
 * g_action_sets:
 *   + UNIQUE INDEX on (projectId, name)
 */

exports.up = async function (connection) {
    console.log('[008] Adding unique name constraints for signal endpoints and action sets...');

    // Helper: check if index exists
    async function hasIndex(table, indexName) {
        const [rows] = await connection.execute(
            `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
            [table, indexName]
        );
        return rows.length > 0;
    }

    // Helper: deduplicate names within the same project
    async function deduplicateNames(table) {
        const [dupes] = await connection.execute(
            `SELECT projectId, name, COUNT(*) as cnt FROM ${table}
       GROUP BY projectId, name HAVING cnt > 1`
        );
        for (const dupe of dupes) {
            const [rows] = await connection.execute(
                `SELECT id FROM ${table} WHERE projectId = ? AND name = ? ORDER BY createdAt ASC`,
                [dupe.projectId, dupe.name]
            );
            // Keep the first one, rename the rest
            for (let i = 1; i < rows.length; i++) {
                const newName = `${dupe.name}_${i + 1}`;
                await connection.execute(
                    `UPDATE ${table} SET name = ? WHERE id = ?`,
                    [newName, rows[i].id]
                );
                console.log(`  ??${table}: renamed duplicate "${dupe.name}" -> "${newName}" (id: ${rows[i].id})`);
            }
        }
    }

    // ?€?€ Deduplicate before adding unique constraints ?€?€
    await deduplicateNames('g_signal_endpoints');
    await deduplicateNames('g_action_sets');

    // ?€?€ g_signal_endpoints: unique (projectId, name) ?€?€
    if (!(await hasIndex('g_signal_endpoints', 'uq_signal_endpoints_project_name'))) {
        await connection.execute(`
      ALTER TABLE g_signal_endpoints
        ADD UNIQUE INDEX uq_signal_endpoints_project_name (projectId, name)
    `);
        console.log('  ??g_signal_endpoints: added unique index on (projectId, name)');
    }

    // ?€?€ g_action_sets: unique (projectId, name) ?€?€
    if (!(await hasIndex('g_action_sets', 'uq_action_sets_project_name'))) {
        await connection.execute(`
      ALTER TABLE g_action_sets
        ADD UNIQUE INDEX uq_action_sets_project_name (projectId, name)
    `);
        console.log('  ??g_action_sets: added unique index on (projectId, name)');
    }

    console.log('[008] ??Unique name constraints added');
};

exports.down = async function (connection) {
    async function hasIndex(table, indexName) {
        const [rows] = await connection.execute(
            `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
            [table, indexName]
        );
        return rows.length > 0;
    }

    if (await hasIndex('g_signal_endpoints', 'uq_signal_endpoints_project_name')) {
        await connection.execute(`ALTER TABLE g_signal_endpoints DROP INDEX uq_signal_endpoints_project_name`);
    }

    if (await hasIndex('g_action_sets', 'uq_action_sets_project_name')) {
        await connection.execute(`ALTER TABLE g_action_sets DROP INDEX uq_action_sets_project_name`);
    }
};
