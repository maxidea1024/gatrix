/**
 * 055 - Unique Coupon Codes
 * Adds a UNIQUE INDEX to g_coupons(environmentId, code) safely by resolving any existing duplicates.
 */
exports.up = async function (connection) {
    console.log('[055] Adding unique index to g_coupons(environmentId, code) safely...');

    // 1. Identify existing duplicates (same environmentId and code)
    const [duplicates] = await connection.execute(`
        SELECT environmentId, code, COUNT(*) as cnt
        FROM g_coupons
        GROUP BY environmentId, code
        HAVING cnt > 1
    `);

    if (duplicates.length > 0) {
        console.log(`[055] Found ${duplicates.length} duplicate coupon codes. Resolving...`);

        for (const dup of duplicates) {
            // Find all rows for this duplicate pair, ordered by status (USED first) and createdAt (oldest first)
            const [rows] = await connection.execute(`
                SELECT id, status
                FROM g_coupons
                WHERE environmentId = ? AND code = ?
                ORDER BY 
                    CASE status
                        WHEN 'USED' THEN 1
                        WHEN 'ISSUED' THEN 2
                        WHEN 'REVOKED' THEN 3
                        ELSE 4
                    END,
                    createdAt ASC
            `, [dup.environmentId, dup.code]);

            // Keep the first one (most important, e.g. USED), revoke and rename the rest
            const keepRow = rows[0];
            const duplicateRows = rows.slice(1);

            for (const row of duplicateRows) {
                const newCode = `${dup.code}_DUP_${row.id.substring(0, 6)}`;
                await connection.execute(`
                    UPDATE g_coupons
                    SET code = ?, status = 'REVOKED'
                    WHERE id = ?
                `, [newCode, row.id]);
                console.log(`[055] Resolved duplicate code ${dup.code} -> ${newCode} (revoked)`);
            }
        }
    }

    // 2. Add the unique index safely
    await connection.execute(`
        ALTER TABLE g_coupons
        ADD UNIQUE INDEX uniq_env_code (environmentId, code)
    `);

    console.log('[055] Successfully added unique index to g_coupons.');
};

exports.down = async function (connection) {
    console.log('[055] Removing unique index from g_coupons...');
    await connection.execute(`
        ALTER TABLE g_coupons
        DROP INDEX uniq_env_code
    `);
};
