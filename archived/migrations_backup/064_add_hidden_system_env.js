/**
 * Migration: Create hidden system environment 'gatrix-env'
 *
 * This migration creates a hidden system environment named 'gatrix-env'.
 * This environment is used for global configurations and is hidden from the UI environment list.
 */

// Simple ULID generator for migration
function generateUlid() {
    const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const ENCODING_LEN = ENCODING.length;
    const TIME_LEN = 10;
    const RANDOM_LEN = 16;

    function encodeTime(now, len) {
        let str = '';
        for (let i = len; i > 0; i--) {
            const mod = now % ENCODING_LEN;
            str = ENCODING[mod] + str;
            now = Math.floor(now / ENCODING_LEN);
        }
        return str;
    }

    function encodeRandom(len) {
        let str = '';
        for (let i = 0; i < len; i++) {
            str += ENCODING[Math.floor(Math.random() * ENCODING_LEN)];
        }
        return str;
    }

    return encodeTime(Date.now(), TIME_LEN) + encodeRandom(RANDOM_LEN);
}

// Generate environment ID in format: {environmentName}.{ulid}
function generateEnvironmentId(environmentName) {
    return `${environmentName}.${generateUlid()}`;
}

exports.up = async function (connection) {
    console.log('Creating hidden system environment "gatrix-env"...');

    try {
        // 1. Add isHidden column to g_environments if it doesn't exist
        const [columns] = await connection.execute(`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_environments' AND COLUMN_NAME = 'isHidden'
    `);

        if (columns[0].cnt === 0) {
            await connection.execute(`
        ALTER TABLE g_environments
        ADD COLUMN isHidden BOOLEAN NOT NULL DEFAULT FALSE
        AFTER isSystemDefined
      `);
            console.log('✓ Added isHidden column to g_environments');
        }

        // 2. Get default project ID
        const [defaultProject] = await connection.execute(`
      SELECT id FROM g_projects WHERE isDefault = TRUE LIMIT 1
    `);

        // If no default project exists, create a temporary ID just for this migration (fallback)
        // Ideally projects should exist, but safety check
        let projectId = defaultProject[0]?.id;
        if (!projectId) {
            console.log('⚠️ No default project found. Skipping projectId assignment.');
            projectId = null;
        }

        // 3. Insert 'gatrix-env' if not exists
        await connection.execute(`
      INSERT INTO g_environments
      (id, environmentName, displayName, description, environmentType, isSystemDefined, isHidden, isDefault, displayOrder, color, projectId, requiresApproval, requiredApprovers, createdBy)
      VALUES (?, 'gatrix-env', 'Gatrix System', 'Hidden environment for global configurations', 'production', TRUE, TRUE, FALSE, 999, '#9E9E9E', ?, FALSE, 1, 1)
      ON DUPLICATE KEY UPDATE 
        isHidden = TRUE,
        displayName = 'Gatrix System'
    `, [generateEnvironmentId('gatrix-env'), projectId]);

        console.log('✓ "gatrix-env" created/updated and set to hidden');

    } catch (error) {
        console.log('⚠️ Error creating gatrix-env:', error.message);
        throw error;
    }
};

exports.down = async function (connection) {
    console.log('Reverting gatrix-env migration...');

    try {
        // Delete gatrix-env (optional, often better to keep data safe, but strict rollback removes it)
        await connection.execute(`DELETE FROM g_environments WHERE environmentName = 'gatrix-env'`);

        // Drop isHidden column
        const [columns] = await connection.execute(`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_environments' AND COLUMN_NAME = 'isHidden'
    `);

        if (columns[0].cnt > 0) {
            await connection.execute(`ALTER TABLE g_environments DROP COLUMN isHidden`);
            console.log('✓ Dropped isHidden column');
        }
    } catch (error) {
        console.log('⚠️ Error reverting gatrix-env migration:', error.message);
        throw error;
    }
};
