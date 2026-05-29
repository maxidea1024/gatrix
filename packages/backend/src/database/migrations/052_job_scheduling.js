/**
 * 052 - Job Scheduling
 * Adds scheduling columns (cronExpression, triggerAt, retryPolicy, etc) to g_jobs table.
 */

exports.up = async function (connection) {
    console.log('[052] Adding job scheduling columns...');

    await connection.execute(`
        ALTER TABLE g_jobs
        ADD COLUMN cronExpression VARCHAR(100) NULL AFTER isEnabled,
        ADD COLUMN triggerAt DATETIME NULL AFTER cronExpression,
        ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul' AFTER triggerAt,
        ADD COLUMN retryPolicy JSON NULL AFTER timezone,
        ADD COLUMN nextExecutionAt DATETIME NULL AFTER retryPolicy,
        ADD COLUMN lastExecutedAt DATETIME NULL AFTER nextExecutionAt
    `);
};

exports.down = async function (connection) {
    console.log('[052] Removing job scheduling columns...');

    await connection.execute(`
        ALTER TABLE g_jobs
        DROP COLUMN cronExpression,
        DROP COLUMN triggerAt,
        DROP COLUMN timezone,
        DROP COLUMN retryPolicy,
        DROP COLUMN nextExecutionAt,
        DROP COLUMN lastExecutedAt
    `);
};
