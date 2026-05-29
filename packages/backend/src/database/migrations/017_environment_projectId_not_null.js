/**
 * 017 - Make g_environments.projectId NOT NULL
 *
 * Every environment must belong to a project.
 * The existing FK constraint uses ON DELETE SET NULL which prevents NOT NULL.
 * We drop the old FK, make column NOT NULL, then re-add FK with ON DELETE CASCADE.
 */

exports.up = async function (connection) {
    console.log('[017] Making g_environments.projectId NOT NULL...');

    // Check for any environments with NULL projectId
    const [nullRows] = await connection.execute(
        `SELECT id, displayName FROM g_environments WHERE projectId IS NULL`
    );

    if (nullRows.length > 0) {
        const [projects] = await connection.execute(
            `SELECT id FROM g_projects ORDER BY createdAt ASC LIMIT 1`
        );

        if (projects.length > 0) {
            const defaultProjectId = projects[0].id;

            // Find which displayNames already exist for this project
            const [existing] = await connection.execute(
                `SELECT displayName FROM g_environments WHERE projectId = ?`,
                [defaultProjectId]
            );
            const existingNames = new Set(existing.map(r => r.displayName));

            // Delete orphaned environments that would cause duplicates
            const duplicateIds = nullRows
                .filter(r => existingNames.has(r.displayName))
                .map(r => r.id);

            if (duplicateIds.length > 0) {
                console.log(`[017] Deleting ${duplicateIds.length} duplicate orphaned environments`);
                const placeholders = duplicateIds.map(() => '?').join(',');
                await connection.execute(
                    `DELETE FROM g_environments WHERE id IN (${placeholders})`,
                    duplicateIds
                );
            }

            // Assign remaining orphans
            const [remaining] = await connection.execute(
                `SELECT id FROM g_environments WHERE projectId IS NULL`
            );
            if (remaining.length > 0) {
                console.log(`[017] Assigning ${remaining.length} orphaned environments to project ${defaultProjectId}`);
                await connection.execute(
                    `UPDATE g_environments SET projectId = ? WHERE projectId IS NULL`,
                    [defaultProjectId]
                );
            }
        } else {
            console.log(`[017] No projects exist, deleting ${nullRows.length} orphaned environments`);
            await connection.execute(`DELETE FROM g_environments WHERE projectId IS NULL`);
        }
    }

    // Drop old FK constraint (SET NULL) so we can make column NOT NULL
    await connection.execute(`ALTER TABLE g_environments DROP FOREIGN KEY fk_env_project`);

    // Make projectId NOT NULL
    await connection.execute(`
        ALTER TABLE g_environments
        MODIFY COLUMN projectId CHAR(26) NOT NULL
    `);

    // Re-add FK with CASCADE (delete project = delete its environments)
    await connection.execute(`
        ALTER TABLE g_environments
        ADD CONSTRAINT fk_env_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE CASCADE
    `);

    console.log('[017] Done');
};

exports.down = async function (connection) {
    await connection.execute(`ALTER TABLE g_environments DROP FOREIGN KEY fk_env_project`);
    await connection.execute(`
        ALTER TABLE g_environments
        MODIFY COLUMN projectId CHAR(26) NULL
    `);
    await connection.execute(`
        ALTER TABLE g_environments
        ADD CONSTRAINT fk_env_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE SET NULL
    `);
};
