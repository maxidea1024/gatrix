/**
 * 020 - RBAC v3: Role Binding Pattern
 *
 * Core change: Separate "what you can do" (role permissions) from "where you can do it" (role bindings).
 *
 * 1. Create g_role_permissions table (unified, no scope references)
 * 2. Create g_role_bindings table (scopeType: system/org/project/environment)
 * 3. Migrate existing data:
 *    - g_role_org_permissions ??g_role_permissions
 *    - g_role_project_permissions ??g_role_permissions + g_role_bindings
 *    - g_role_environment_permissions ??g_role_permissions + g_role_bindings
 *    - g_user_roles ??g_role_bindings (scopeType=org)
 *    - g_group_roles ??g_role_bindings (scopeType=org)
 * 4. Drop old tables
 */

// Simple ULID-like generator for migration
function generateId() {
  const t = Date.now().toString(36).padStart(10, '0');
  const r = Math.random().toString(36).substring(2, 16).padStart(14, '0');
  return (t + r).substring(0, 26).toUpperCase();
}

exports.name = 'rbac_v3_role_binding';

exports.up = async function (connection) {
  console.log('[020] Starting RBAC v3 Role Binding migration...');

  // ========== 1. Create g_role_permissions ==========
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_role_permissions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      roleId CHAR(26) NOT NULL,
      permission VARCHAR(100) NOT NULL,
      permCondition TEXT NULL COMMENT 'ABAC condition expression (future use)',
      UNIQUE KEY uniq_role_perm (roleId, permission),
      CONSTRAINT fk_rp_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      INDEX idx_role_id (roleId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[020] ??g_role_permissions table created');

  // ========== 2. Create g_role_bindings ==========
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_role_bindings (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      userId CHAR(26) NULL,
      groupId CHAR(26) NULL,
      roleId CHAR(26) NOT NULL,
      scopeType ENUM('system', 'org', 'project', 'environment') NOT NULL,
      scopeId CHAR(26) NOT NULL COMMENT 'SYSTEM | orgId | projectId | environmentId',
      assignedBy CHAR(26) NULL,
      assignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_binding (userId, groupId, roleId, scopeType, scopeId),
      CONSTRAINT fk_rb_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      CONSTRAINT fk_rb_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_rb_group FOREIGN KEY (groupId) REFERENCES g_groups(id) ON DELETE CASCADE,
      INDEX idx_user_scope (userId, scopeType, scopeId),
      INDEX idx_group_scope (groupId, scopeType, scopeId),
      INDEX idx_role_id (roleId),
      INDEX idx_scope (scopeType, scopeId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[020] ??g_role_bindings table created');

  // ========== 3. Migrate data ==========

  // 3a. g_role_org_permissions ??g_role_permissions
  // These are simple: just copy permission values (no scope info)
  const [orgPerms] = await connection.execute(
    'SELECT roleId, permission, permCondition FROM g_role_org_permissions'
  );
  let orgPermCount = 0;
  for (const row of orgPerms) {
    const [existing] = await connection.execute(
      'SELECT id FROM g_role_permissions WHERE roleId = ? AND permission = ?',
      [row.roleId, row.permission]
    );
    if (existing.length === 0) {
      await connection.execute(
        'INSERT INTO g_role_permissions (id, roleId, permission, permCondition) VALUES (?, ?, ?, ?)',
        [generateId(), row.roleId, row.permission, row.permCondition || null]
      );
      orgPermCount++;
    }
  }
  console.log(`[020] ??Migrated ${orgPermCount} org permissions ??g_role_permissions`);

  // 3b. g_role_project_permissions ??g_role_permissions + g_role_bindings
  // Permission goes to g_role_permissions (deduplicated)
  // The role<->project relationship becomes a binding
  const [projPerms] = await connection.execute(
    'SELECT roleId, projectId, permission, permCondition FROM g_role_project_permissions'
  );

  // Collect unique role-project pairs for bindings
  const projBindingPairs = new Set();
  let projPermCount = 0;

  for (const row of projPerms) {
    // Add permission (deduplicated)
    const [existing] = await connection.execute(
      'SELECT id FROM g_role_permissions WHERE roleId = ? AND permission = ?',
      [row.roleId, row.permission]
    );
    if (existing.length === 0) {
      await connection.execute(
        'INSERT INTO g_role_permissions (id, roleId, permission, permCondition) VALUES (?, ?, ?, ?)',
        [generateId(), row.roleId, row.permission, row.permCondition || null]
      );
      projPermCount++;
    }
    projBindingPairs.add(`${row.roleId}|${row.projectId}`);
  }
  console.log(`[020] ??Migrated ${projPermCount} project permissions ??g_role_permissions`);

  // 3c. g_role_environment_permissions ??g_role_permissions + g_role_bindings
  const [envPerms] = await connection.execute(
    'SELECT roleId, environmentId, permission, permCondition FROM g_role_environment_permissions'
  );

  const envBindingPairs = new Set();
  let envPermCount = 0;

  for (const row of envPerms) {
    const [existing] = await connection.execute(
      'SELECT id FROM g_role_permissions WHERE roleId = ? AND permission = ?',
      [row.roleId, row.permission]
    );
    if (existing.length === 0) {
      await connection.execute(
        'INSERT INTO g_role_permissions (id, roleId, permission, permCondition) VALUES (?, ?, ?, ?)',
        [generateId(), row.roleId, row.permission, row.permCondition || null]
      );
      envPermCount++;
    }
    envBindingPairs.add(`${row.roleId}|${row.environmentId}`);
  }
  console.log(`[020] ??Migrated ${envPermCount} env permissions ??g_role_permissions`);

  // 3d. g_user_roles ??g_role_bindings (scopeType=org)
  // Need to find orgId for each role
  const [userRoles] = await connection.execute(
    `SELECT ur.userId, ur.roleId, ur.assignedBy, ur.assignedAt, r.orgId
     FROM g_user_roles ur
     JOIN g_roles r ON ur.roleId = r.id`
  );

  let userBindingCount = 0;
  for (const row of userRoles) {
    // Create org-level binding
    const [existing] = await connection.execute(
      'SELECT id FROM g_role_bindings WHERE userId = ? AND roleId = ? AND scopeType = ? AND scopeId = ?',
      [row.userId, row.roleId, 'org', row.orgId]
    );
    if (existing.length === 0) {
      await connection.execute(
        'INSERT INTO g_role_bindings (id, userId, groupId, roleId, scopeType, scopeId, assignedBy, assignedAt) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
        [generateId(), row.userId, row.roleId, 'org', row.orgId, row.assignedBy, row.assignedAt]
      );
      userBindingCount++;
    }

    // Also create project-level bindings for this user+role if project permissions existed
    for (const pair of projBindingPairs) {
      const [roleId, projectId] = pair.split('|');
      if (roleId === row.roleId) {
        const [existingProj] = await connection.execute(
          'SELECT id FROM g_role_bindings WHERE userId = ? AND roleId = ? AND scopeType = ? AND scopeId = ?',
          [row.userId, roleId, 'project', projectId]
        );
        if (existingProj.length === 0) {
          await connection.execute(
            'INSERT INTO g_role_bindings (id, userId, groupId, roleId, scopeType, scopeId, assignedBy, assignedAt) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
            [generateId(), row.userId, roleId, 'project', projectId, row.assignedBy, row.assignedAt]
          );
          userBindingCount++;
        }
      }
    }

    // Create env-level bindings
    for (const pair of envBindingPairs) {
      const [roleId, environmentId] = pair.split('|');
      if (roleId === row.roleId) {
        const [existingEnv] = await connection.execute(
          'SELECT id FROM g_role_bindings WHERE userId = ? AND roleId = ? AND scopeType = ? AND scopeId = ?',
          [row.userId, roleId, 'environment', environmentId]
        );
        if (existingEnv.length === 0) {
          await connection.execute(
            'INSERT INTO g_role_bindings (id, userId, groupId, roleId, scopeType, scopeId, assignedBy, assignedAt) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
            [generateId(), row.userId, roleId, 'environment', environmentId, row.assignedBy, row.assignedAt]
          );
          userBindingCount++;
        }
      }
    }
  }
  console.log(`[020] ??Migrated ${userBindingCount} user role assignments ??g_role_bindings`);

  // 3e. g_group_roles ??g_role_bindings (scopeType=org)
  const [groupRoles] = await connection.execute(
    `SELECT gr.groupId, gr.roleId, gr.assignedBy, gr.assignedAt, r.orgId
     FROM g_group_roles gr
     JOIN g_roles r ON gr.roleId = r.id`
  );

  let groupBindingCount = 0;
  for (const row of groupRoles) {
    const [existing] = await connection.execute(
      'SELECT id FROM g_role_bindings WHERE groupId = ? AND roleId = ? AND scopeType = ? AND scopeId = ?',
      [row.groupId, row.roleId, 'org', row.orgId]
    );
    if (existing.length === 0) {
      await connection.execute(
        'INSERT INTO g_role_bindings (id, userId, groupId, roleId, scopeType, scopeId, assignedBy, assignedAt) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)',
        [generateId(), row.groupId, row.roleId, 'org', row.orgId, row.assignedBy, row.assignedAt]
      );
      groupBindingCount++;
    }

    // Also create project/env bindings for groups
    for (const pair of projBindingPairs) {
      const [roleId, projectId] = pair.split('|');
      if (roleId === row.roleId) {
        const [existingProj] = await connection.execute(
          'SELECT id FROM g_role_bindings WHERE groupId = ? AND roleId = ? AND scopeType = ? AND scopeId = ?',
          [row.groupId, roleId, 'project', projectId]
        );
        if (existingProj.length === 0) {
          await connection.execute(
            'INSERT INTO g_role_bindings (id, userId, groupId, roleId, scopeType, scopeId, assignedBy, assignedAt) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)',
            [generateId(), row.groupId, roleId, 'project', projectId, row.assignedBy, row.assignedAt]
          );
          groupBindingCount++;
        }
      }
    }

    for (const pair of envBindingPairs) {
      const [roleId, environmentId] = pair.split('|');
      if (roleId === row.roleId) {
        const [existingEnv] = await connection.execute(
          'SELECT id FROM g_role_bindings WHERE groupId = ? AND roleId = ? AND scopeType = ? AND scopeId = ?',
          [row.groupId, roleId, 'environment', environmentId]
        );
        if (existingEnv.length === 0) {
          await connection.execute(
            'INSERT INTO g_role_bindings (id, userId, groupId, roleId, scopeType, scopeId, assignedBy, assignedAt) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)',
            [generateId(), row.groupId, roleId, 'environment', environmentId, row.assignedBy, row.assignedAt]
          );
          groupBindingCount++;
        }
      }
    }
  }
  console.log(`[020] ??Migrated ${groupBindingCount} group role assignments ??g_role_bindings`);

  // ========== 4. Drop old tables ==========
  // Order matters due to FK constraints
  await connection.execute('DROP TABLE IF EXISTS g_user_roles');
  console.log('[020] ??Dropped g_user_roles');

  await connection.execute('DROP TABLE IF EXISTS g_group_roles');
  console.log('[020] ??Dropped g_group_roles');

  await connection.execute('DROP TABLE IF EXISTS g_role_environment_permissions');
  console.log('[020] ??Dropped g_role_environment_permissions');

  await connection.execute('DROP TABLE IF EXISTS g_role_project_permissions');
  console.log('[020] ??Dropped g_role_project_permissions');

  await connection.execute('DROP TABLE IF EXISTS g_role_org_permissions');
  console.log('[020] ??Dropped g_role_org_permissions');

  console.log('[020] ??RBAC v3 Role Binding migration completed');
};

exports.down = async function (connection) {
  console.log('[020] Reverting RBAC v3 Role Binding migration...');

  // 1. Recreate old tables
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_role_org_permissions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      roleId CHAR(26) NOT NULL,
      permission VARCHAR(100) NOT NULL,
      permCondition TEXT NULL,
      UNIQUE KEY uniq_role_org_perm (roleId, permission),
      CONSTRAINT fk_rop_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_role_project_permissions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      roleId CHAR(26) NOT NULL,
      projectId CHAR(26) NOT NULL,
      permission VARCHAR(100) NOT NULL,
      isAdmin BOOLEAN NOT NULL DEFAULT FALSE,
      permCondition TEXT NULL,
      UNIQUE KEY uniq_role_proj_perm (roleId, projectId, permission),
      CONSTRAINT fk_rpp_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      CONSTRAINT fk_rpp_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE CASCADE,
      INDEX idx_role_id (roleId),
      INDEX idx_project_id (projectId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_role_environment_permissions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      roleId CHAR(26) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      permission VARCHAR(100) NOT NULL,
      isAdmin BOOLEAN NOT NULL DEFAULT FALSE,
      permCondition TEXT NULL,
      UNIQUE KEY uniq_role_env_perm (roleId, environmentId, permission),
      CONSTRAINT fk_rep_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      CONSTRAINT fk_rep_env FOREIGN KEY (environmentId) REFERENCES g_environments(id) ON DELETE CASCADE,
      INDEX idx_role_id (roleId),
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_user_roles (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      userId CHAR(26) NOT NULL,
      roleId CHAR(26) NOT NULL,
      assignedBy CHAR(26) NULL,
      assignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_role (userId, roleId),
      CONSTRAINT fk_ur_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_ur_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      INDEX idx_user_id (userId),
      INDEX idx_role_id (roleId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_group_roles (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      groupId CHAR(26) NOT NULL,
      roleId CHAR(26) NOT NULL,
      assignedBy CHAR(26) NULL,
      assignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_group_role (groupId, roleId),
      CONSTRAINT fk_gr_group FOREIGN KEY (groupId) REFERENCES g_groups(id) ON DELETE CASCADE,
      CONSTRAINT fk_gr_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      INDEX idx_group_id (groupId),
      INDEX idx_role_id (roleId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. Drop new tables
  await connection.execute('DROP TABLE IF EXISTS g_role_bindings');
  await connection.execute('DROP TABLE IF EXISTS g_role_permissions');

  console.log('[020] ??RBAC v3 Role Binding migration reverted (data NOT migrated back)');
};
