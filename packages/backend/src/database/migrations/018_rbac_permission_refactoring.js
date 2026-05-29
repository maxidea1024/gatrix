/**
 * 018 - RBAC Permission Refactoring
 *
 * 1. Add g_role_inheritance table (role inheritance)
 * 2. Add isSystemDefined to g_roles
 * 3. Add permCondition to permission tables (ABAC)
 * 4. Convert permission values: scope.resource.action ??resource:action
 * 5. Split write ??create + update + delete
 * 6. Convert isAdmin ??*:* permission
 */

// Map old scope.resource.action ??new resource:action
const PERMISSION_MAP = {
    // Org level
    'org.users.read': ['users:read'],
    'org.users.write': ['users:create', 'users:update', 'users:delete'],
    'org.groups.write': ['groups:create', 'groups:update', 'groups:delete'],
    'org.group_membership.write': ['groups:update'],
    'org.roles.write': ['roles:create', 'roles:update', 'roles:delete'],
    'org.admin_tokens.write': ['admin_tokens:create', 'admin_tokens:delete'],
    'org.system_settings.read': ['system_settings:read'],
    'org.system_settings.write': ['system_settings:update'],
    'org.audit_logs.read': ['audit_logs:read'],
    'org.monitoring.read': ['monitoring:read'],
    'org.console.access': ['console:access'],
    'org.event_lens.read': ['event_lens:read'],
    'org.event_lens.write': ['event_lens:update'],
    'org.chat.access': ['chat:access'],
    'org.projects.write': ['projects:create', 'projects:update', 'projects:delete'],
    'org.crash_events.read': ['crash_events:read'],
    'org.realtime_events.read': ['realtime_events:read'],
    'org.scheduler.read': ['scheduler:read'],
    'org.scheduler.write': ['scheduler:create', 'scheduler:update', 'scheduler:delete'],
    'org.open_api.read': ['open_api:read'],
    'org.invitations.write': ['invitations:create', 'invitations:delete'],
    'org.ip_whitelist.read': ['ip_whitelist:read'],
    'org.ip_whitelist.write': ['ip_whitelist:create', 'ip_whitelist:update', 'ip_whitelist:delete'],
    'org.account_whitelist.read': ['account_whitelist:read'],
    'org.account_whitelist.write': ['account_whitelist:create', 'account_whitelist:update', 'account_whitelist:delete'],
    'org.integrations.read': ['integrations:read'],
    'org.integrations.write': ['integrations:update'],
    'org.translation.write': ['translation:update'],

    // Project level
    'project.read': ['features:read'],
    'project.features.write': ['features:create', 'features:update', 'features:delete'],
    'project.segments.write': ['segments:create', 'segments:update', 'segments:delete'],
    'project.context_fields.write': ['context_fields:create', 'context_fields:update', 'context_fields:delete'],
    'project.tags.read': ['tags:read'],
    'project.tags.write': ['tags:create', 'tags:update', 'tags:delete'],
    'project.planning_data.read': ['planning_data:read'],
    'project.planning_data.write': ['planning_data:create', 'planning_data:update', 'planning_data:delete'],
    'project.release_flows.write': ['release_flows:create', 'release_flows:update', 'release_flows:delete'],
    'project.service_accounts.read': ['service_accounts:read'],
    'project.service_accounts.write': ['service_accounts:create', 'service_accounts:update', 'service_accounts:delete'],
    'project.signal_endpoints.read': ['signal_endpoints:read'],
    'project.signal_endpoints.write': ['signal_endpoints:create', 'signal_endpoints:update', 'signal_endpoints:delete'],
    'project.actions.read': ['actions:read'],
    'project.actions.write': ['actions:create', 'actions:update', 'actions:delete'],
    'project.data.read': ['data:read'],
    'project.data.write': ['data:update'],
    'project.unknown_flags.read': ['unknown_flags:read'],
    'project.impact_metrics.read': ['impact_metrics:read'],
    'project.impact_metrics.write': ['impact_metrics:update'],

    // Env level
    'env.read': ['environments:read'],
    'env.settings.write': ['environments:update'],
    'env.features.write': ['env_features:update'],
    'env.change_requests.create': ['change_requests:create'],
    'env.change_requests.approve': ['change_requests:approve'],
    'env.env_keys.write': ['env_keys:create', 'env_keys:delete'],
    'env.client_versions.read': ['client_versions:read'],
    'env.client_versions.write': ['client_versions:create', 'client_versions:update', 'client_versions:delete'],
    'env.game_worlds.read': ['game_worlds:read'],
    'env.game_worlds.write': ['game_worlds:create', 'game_worlds:update', 'game_worlds:delete'],
    'env.maintenance.read': ['maintenance:read'],
    'env.maintenance.write': ['maintenance:update'],
    'env.maintenance_templates.read': ['maintenance_templates:read'],
    'env.maintenance_templates.write': ['maintenance_templates:create', 'maintenance_templates:update', 'maintenance_templates:delete'],
    'env.service_notices.read': ['service_notices:read'],
    'env.service_notices.write': ['service_notices:create', 'service_notices:update', 'service_notices:delete'],
    'env.banners.read': ['banners:read'],
    'env.banners.write': ['banners:create', 'banners:update', 'banners:delete'],
    'env.coupons.read': ['coupons:read'],
    'env.coupons.write': ['coupons:create', 'coupons:update', 'coupons:delete'],
    'env.surveys.read': ['surveys:read'],
    'env.surveys.write': ['surveys:create', 'surveys:update', 'surveys:delete'],
    'env.store_products.read': ['store_products:read'],
    'env.store_products.write': ['store_products:create', 'store_products:update', 'store_products:delete'],
    'env.reward_templates.read': ['reward_templates:read'],
    'env.reward_templates.write': ['reward_templates:create', 'reward_templates:update', 'reward_templates:delete'],
    'env.ingame_popups.read': ['ingame_popups:read'],
    'env.ingame_popups.write': ['ingame_popups:create', 'ingame_popups:update', 'ingame_popups:delete'],
    'env.operation_events.read': ['operation_events:read'],
    'env.operation_events.write': ['operation_events:create', 'operation_events:update', 'operation_events:delete'],
    'env.vars.read': ['vars:read'],
    'env.vars.write': ['vars:create', 'vars:update', 'vars:delete'],
    'env.servers.read': ['servers:read'],
    'env.servers.write': ['servers:create', 'servers:update', 'servers:delete'],
    'env.coupon_settings.read': ['coupon_settings:read'],
    'env.coupon_settings.write': ['coupon_settings:update'],
    'env.message_templates.read': ['message_templates:read'],
    'env.message_templates.write': ['message_templates:create', 'message_templates:update', 'message_templates:delete'],
    'env.platform_defaults.read': ['client_versions:read'],
    'env.platform_defaults.write': ['client_versions:update'],
    'env.cms_cash_shop.read': ['store_products:read'],
    'env.cms_cash_shop.write': ['store_products:update'],
};

// Simple ULID-like generator for migration
function generateId() {
    const t = Date.now().toString(36).padStart(10, '0');
    const r = Math.random().toString(36).substring(2, 16).padStart(14, '0');
    return (t + r).substring(0, 26).toUpperCase();
}

exports.up = async function (connection) {
    console.log('[018] Starting RBAC permission refactoring...');

    // 1. Create g_role_inheritance table
    await connection.execute(`
    CREATE TABLE g_role_inheritance (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      roleId CHAR(26) NOT NULL,
      parentRoleId CHAR(26) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_role_parent (roleId, parentRoleId),
      CONSTRAINT fk_ri_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      CONSTRAINT fk_ri_parent FOREIGN KEY (parentRoleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      INDEX idx_role_id (roleId),
      INDEX idx_parent_role_id (parentRoleId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('[018] ??g_role_inheritance table created');

    // 2. Add isSystemDefined to g_roles
    const [rolesCols] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_roles' AND COLUMN_NAME = 'isSystemDefined'`
    );
    if (rolesCols.length === 0) {
        await connection.execute(`
      ALTER TABLE g_roles
      ADD COLUMN isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE AFTER description
    `);
        console.log('[018] ??isSystemDefined column added to g_roles');
    }

    // 3. Add permCondition to permission tables
    const permTables = ['g_role_org_permissions', 'g_role_project_permissions', 'g_role_environment_permissions'];
    for (const table of permTables) {
        const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'permCondition'`,
            [table]
        );
        if (cols.length === 0) {
            await connection.execute(`ALTER TABLE ${table} ADD COLUMN permCondition TEXT NULL COMMENT 'JEXL condition expression'`);
            console.log(`[018] ??permCondition column added to ${table}`);
        }
    }

    // 4. Convert permission values in g_role_org_permissions
    await migratePermissions(connection, 'g_role_org_permissions', ['roleId']);
    console.log('[018] ??g_role_org_permissions migrated');

    // 5. Convert permission values in g_role_project_permissions
    // Also convert isAdmin=true ??*:* permission
    await migratePermissions(connection, 'g_role_project_permissions', ['roleId', 'projectId']);
    await migrateAdminFlag(connection, 'g_role_project_permissions', 'projectId');
    console.log('[018] ??g_role_project_permissions migrated');

    // 6. Convert permission values in g_role_environment_permissions
    await migratePermissions(connection, 'g_role_environment_permissions', ['roleId', 'environmentId']);
    await migrateAdminFlag(connection, 'g_role_environment_permissions', 'environmentId');
    console.log('[018] ??g_role_environment_permissions migrated');

    // 7. Seed default role presets for each org
    await seedDefaultRolePresets(connection);
    console.log('[018] ??Default role presets seeded');

    console.log('[018] ??RBAC permission refactoring completed');
};

async function migratePermissions(connection, tableName, groupCols) {
    const [rows] = await connection.execute(`SELECT * FROM ${tableName}`);

    for (const row of rows) {
        const oldPerm = row.permission;
        const newPerms = PERMISSION_MAP[oldPerm];

        if (!newPerms) {
            // Already in new format or unknown ??check if it contains ':'
            if (oldPerm.includes(':')) continue;
            console.warn(`[018] Unknown permission in ${tableName}: ${oldPerm} (skipping)`);
            continue;
        }

        // Delete old row
        await connection.execute(`DELETE FROM ${tableName} WHERE id = ?`, [row.id]);

        // Insert new rows
        for (const newPerm of newPerms) {
            // Check for duplicate
            const colChecks = groupCols.map(c => `${c} = ?`).join(' AND ');
            const colValues = groupCols.map(c => row[c]);
            const [existing] = await connection.execute(
                `SELECT id FROM ${tableName} WHERE ${colChecks} AND permission = ?`,
                [...colValues, newPerm]
            );
            if (existing.length > 0) continue;

            const newId = generateId();
            const insertCols = ['id', ...groupCols, 'permission'];
            const insertValues = [newId, ...colValues, newPerm];

            // Include optional columns if they exist
            if ('isAdmin' in row) {
                insertCols.push('isAdmin');
                insertValues.push(row.isAdmin);
            }
            if ('permCondition' in row && row.permCondition !== null && row.permCondition !== undefined) {
                insertCols.push('permCondition');
                insertValues.push(row.permCondition);
            }

            const placeholders = insertCols.map(() => '?').join(', ');
            await connection.execute(
                `INSERT INTO ${tableName} (${insertCols.join(', ')}) VALUES (${placeholders})`,
                insertValues
            );
        }
    }
}

async function migrateAdminFlag(connection, tableName, scopeCol) {
    // Find rows where isAdmin = true and add *:* permission
    const [adminRows] = await connection.execute(
        `SELECT DISTINCT roleId, ${scopeCol} FROM ${tableName} WHERE isAdmin = TRUE`
    );

    for (const row of adminRows) {
        // Check if *:* already exists
        const [existing] = await connection.execute(
            `SELECT id FROM ${tableName} WHERE roleId = ? AND ${scopeCol} = ? AND permission = '*:*'`,
            [row.roleId, row[scopeCol]]
        );
        if (existing.length > 0) continue;

        const newId = generateId();
        await connection.execute(
            `INSERT INTO ${tableName} (id, roleId, ${scopeCol}, permission, isAdmin) VALUES (?, ?, ?, '*:*', FALSE)`,
            [newId, row.roleId, row[scopeCol]]
        );
    }
}

/**
 * Seed default role presets for each organisation.
 * Creates: Viewer (read-only), Editor (read+update), Manager (full CRUD)
 */
async function seedDefaultRolePresets(connection) {
    // Role preset definitions
    const ORG_READ_PERMS = [
        'users:read', 'audit_logs:read', 'monitoring:read', 'open_api:read',
        'crash_events:read', 'realtime_events:read', 'scheduler:read',
        'system_settings:read', 'ip_whitelist:read', 'account_whitelist:read',
        'integrations:read', 'event_lens:read',
    ];
    const ORG_WRITE_PERMS = [
        'users:create', 'users:update', 'users:delete',
        'groups:create', 'groups:update', 'groups:delete',
        'roles:create', 'roles:update', 'roles:delete',
        'admin_tokens:create', 'admin_tokens:delete',
        'system_settings:update', 'console:access', 'chat:access',
        'projects:create', 'projects:update', 'projects:delete',
        'scheduler:create', 'scheduler:update', 'scheduler:delete',
        'invitations:create', 'invitations:delete',
        'ip_whitelist:create', 'ip_whitelist:update', 'ip_whitelist:delete',
        'account_whitelist:create', 'account_whitelist:update', 'account_whitelist:delete',
        'integrations:update', 'event_lens:update', 'translation:update',
    ];

    const PROJECT_READ_PERMS = [
        'features:read', 'tags:read', 'planning_data:read',
        'service_accounts:read', 'signal_endpoints:read', 'actions:read',
        'data:read', 'unknown_flags:read', 'impact_metrics:read',
    ];
    const PROJECT_WRITE_PERMS = [
        'features:create', 'features:update', 'features:delete',
        'segments:create', 'segments:update', 'segments:delete',
        'context_fields:create', 'context_fields:update', 'context_fields:delete',
        'tags:create', 'tags:update', 'tags:delete',
        'planning_data:create', 'planning_data:update', 'planning_data:delete',
        'release_flows:create', 'release_flows:update', 'release_flows:delete',
        'service_accounts:create', 'service_accounts:update', 'service_accounts:delete',
        'signal_endpoints:create', 'signal_endpoints:update', 'signal_endpoints:delete',
        'actions:create', 'actions:update', 'actions:delete',
        'data:update', 'impact_metrics:update',
    ];

    const ENV_READ_PERMS = [
        'environments:read', 'client_versions:read', 'game_worlds:read',
        'maintenance:read', 'maintenance_templates:read', 'service_notices:read',
        'banners:read', 'coupons:read', 'surveys:read', 'store_products:read',
        'reward_templates:read', 'ingame_popups:read', 'operation_events:read',
        'vars:read', 'servers:read', 'coupon_settings:read', 'message_templates:read',
    ];
    const ENV_WRITE_PERMS = [
        'environments:update', 'environments:delete',
        'env_features:update', 'change_requests:create', 'change_requests:approve',
        'env_keys:create', 'env_keys:delete',
        'client_versions:create', 'client_versions:update', 'client_versions:delete',
        'game_worlds:create', 'game_worlds:update', 'game_worlds:delete',
        'maintenance:update',
        'maintenance_templates:create', 'maintenance_templates:update', 'maintenance_templates:delete',
        'service_notices:create', 'service_notices:update', 'service_notices:delete',
        'banners:create', 'banners:update', 'banners:delete',
        'coupons:create', 'coupons:update', 'coupons:delete',
        'surveys:create', 'surveys:update', 'surveys:delete',
        'store_products:create', 'store_products:update', 'store_products:delete',
        'reward_templates:create', 'reward_templates:update', 'reward_templates:delete',
        'ingame_popups:create', 'ingame_popups:update', 'ingame_popups:delete',
        'operation_events:create', 'operation_events:update', 'operation_events:delete',
        'vars:create', 'vars:update', 'vars:delete',
        'servers:create', 'servers:update', 'servers:delete',
        'coupon_settings:update',
        'message_templates:create', 'message_templates:update', 'message_templates:delete',
    ];

    const PRESETS = [
        {
            name: 'Viewer',
            description: 'Read-only access to all resources',
            orgPerms: ORG_READ_PERMS,
            projectPerms: PROJECT_READ_PERMS,
            envPerms: ENV_READ_PERMS,
        },
        {
            name: 'Editor',
            description: 'Read and update access to all resources',
            orgPerms: [...ORG_READ_PERMS, ...ORG_WRITE_PERMS.filter(p => p.endsWith(':update'))],
            projectPerms: [...PROJECT_READ_PERMS, ...PROJECT_WRITE_PERMS.filter(p => p.endsWith(':update'))],
            envPerms: [...ENV_READ_PERMS, ...ENV_WRITE_PERMS.filter(p => p.endsWith(':update'))],
        },
        {
            name: 'Manager',
            description: 'Full CRUD access to all resources',
            orgPerms: [...ORG_READ_PERMS, ...ORG_WRITE_PERMS],
            projectPerms: [...PROJECT_READ_PERMS, ...PROJECT_WRITE_PERMS],
            envPerms: [...ENV_READ_PERMS, ...ENV_WRITE_PERMS],
        },
    ];

    // Get all organisations
    const [orgs] = await connection.execute(`SELECT id FROM g_organisations`);

    for (const org of orgs) {
        for (const preset of PRESETS) {
            // Check if preset role already exists for this org
            const [existingRole] = await connection.execute(
                `SELECT id FROM g_roles WHERE orgId = ? AND roleName = ? AND isSystemDefined = TRUE`,
                [org.id, preset.name]
            );
            if (existingRole.length > 0) {
                console.log(`[018] Preset ${preset.name} already exists for org ${org.id}, skipping`);
                continue;
            }

            // Create role
            const roleId = generateId();
            await connection.execute(
                `INSERT INTO g_roles (id, orgId, roleName, description, isSystemDefined, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
                [roleId, org.id, preset.name, preset.description]
            );

            // Insert org permissions
            for (const perm of preset.orgPerms) {
                const permId = generateId();
                await connection.execute(
                    `INSERT INTO g_role_org_permissions (id, roleId, permission) VALUES (?, ?, ?)`,
                    [permId, roleId, perm]
                );
            }

            // Insert project permissions for all projects in this org
            const [projects] = await connection.execute(
                `SELECT id FROM g_projects WHERE orgId = ?`,
                [org.id]
            );
            for (const project of projects) {
                for (const perm of preset.projectPerms) {
                    const permId = generateId();
                    await connection.execute(
                        `INSERT INTO g_role_project_permissions (id, roleId, projectId, permission) VALUES (?, ?, ?, ?)`,
                        [permId, roleId, project.id, perm]
                    );
                }

                // Insert env permissions for all environments in this project
                const [envs] = await connection.execute(
                    `SELECT id FROM g_environments WHERE projectId = ?`,
                    [project.id]
                );
                for (const env of envs) {
                    for (const perm of preset.envPerms) {
                        const permId = generateId();
                        await connection.execute(
                            `INSERT INTO g_role_environment_permissions (id, roleId, environmentId, permission) VALUES (?, ?, ?, ?)`,
                            [permId, roleId, env.id, perm]
                        );
                    }
                }
            }

            console.log(`[018] Preset ${preset.name} created for org ${org.id}`);
        }
    }
}

exports.down = async function (connection) {
    console.log('[018] Reverting RBAC permission refactoring...');

    // Note: This is a best-effort rollback. Converted permissions cannot be
    // perfectly rolled back since write?’CRUD split is lossy.

    // Drop g_role_inheritance
    await connection.execute(`DROP TABLE IF EXISTS g_role_inheritance`);

    // Drop added columns
    const [sysDefCols] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_roles' AND COLUMN_NAME = 'isSystemDefined'`
    );
    if (sysDefCols.length > 0) {
        await connection.execute(`ALTER TABLE g_roles DROP COLUMN isSystemDefined`);
    }

    const permTables = ['g_role_org_permissions', 'g_role_project_permissions', 'g_role_environment_permissions'];
    for (const table of permTables) {
        const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'permCondition'`,
            [table]
        );
        if (cols.length > 0) {
            await connection.execute(`ALTER TABLE ${table} DROP COLUMN permCondition`);
        }
    }

    console.log('[018] ??RBAC permission refactoring reverted (permission values NOT reverted)');
};
