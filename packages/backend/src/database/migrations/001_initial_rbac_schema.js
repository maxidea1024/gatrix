/**
 * 001 - RBAC Core Tables
 * Organisation, User, Role, Group, Permission, Environment Key, Admin Token, SSO
 * All IDs use ULID (CHAR(26))
 */

exports.up = async function (connection) {
  console.log('[001] Creating RBAC core tables...');

  // 1. Organisations
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_organisations (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      orgName VARCHAR(100) NOT NULL UNIQUE,
      displayName VARCHAR(200) NOT NULL,
      description TEXT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_org_name (orgName)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. Users
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_users (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      passwordHash VARCHAR(255) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      authType VARCHAR(50) NOT NULL DEFAULT 'local',
      emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
      emailVerifiedAt TIMESTAMP NULL,
      lastLoginAt TIMESTAMP NULL,
      avatarUrl VARCHAR(500) NULL,
      preferredLanguage VARCHAR(10) NULL,
      isEditor BOOLEAN NOT NULL DEFAULT FALSE,
      forceToEditorMode BOOLEAN NOT NULL DEFAULT FALSE,
      ssoProviderId CHAR(26) NULL,
      ssoSubjectId VARCHAR(255) NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      tags JSON NULL,
      INDEX idx_email (email),
      INDEX idx_status (status),
      INDEX idx_authType (authType),
      INDEX idx_sso_subject (ssoSubjectId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 3. Organisation Members
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_organisation_members (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      orgId CHAR(26) NOT NULL,
      userId CHAR(26) NOT NULL,
      orgRole ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      joinedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      invitedBy CHAR(26) NULL,
      UNIQUE KEY uniq_org_user (orgId, userId),
      CONSTRAINT fk_orgmem_org FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE,
      CONSTRAINT fk_orgmem_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      INDEX idx_org_id (orgId),
      INDEX idx_user_id (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 4. Roles
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_roles (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      orgId CHAR(26) NOT NULL,
      roleName VARCHAR(100) NOT NULL,
      description TEXT NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_org_role (orgId, roleName),
      CONSTRAINT fk_roles_org FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE,
      INDEX idx_org_id (orgId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 5. Role Org Permissions
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_role_org_permissions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      roleId CHAR(26) NOT NULL,
      permission VARCHAR(100) NOT NULL,
      UNIQUE KEY uniq_role_org_perm (roleId, permission),
      CONSTRAINT fk_rop_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 6. Projects
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_projects (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      orgId CHAR(26) NOT NULL,
      projectName VARCHAR(100) NOT NULL,
      displayName VARCHAR(200) NOT NULL,
      description TEXT NULL,
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_org_project (orgId, projectName),
      CONSTRAINT fk_proj_org FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE,
      INDEX idx_project_name (projectName),
      INDEX idx_org_id (orgId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 7. Role Project Permissions
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_role_project_permissions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      roleId CHAR(26) NOT NULL,
      projectId CHAR(26) NOT NULL,
      permission VARCHAR(100) NOT NULL,
      isAdmin BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE KEY uniq_role_proj_perm (roleId, projectId, permission),
      CONSTRAINT fk_rpp_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      CONSTRAINT fk_rpp_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE CASCADE,
      INDEX idx_role_id (roleId),
      INDEX idx_project_id (projectId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 8. Environments
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_environments (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      name VARCHAR(100) NOT NULL,
      displayName VARCHAR(200) NOT NULL,
      description TEXT NULL,
      environmentType ENUM('development', 'staging', 'production') NOT NULL DEFAULT 'development',
      isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE,
      displayOrder INT NOT NULL DEFAULT 0,
      color VARCHAR(7) NOT NULL DEFAULT '#607D8B',
      projectId CHAR(26) NULL,
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,
      requiresApproval BOOLEAN NOT NULL DEFAULT FALSE,
      requiredApprovers INT NOT NULL DEFAULT 1,
      isHidden BOOLEAN NOT NULL DEFAULT FALSE,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_is_default (isDefault),
      INDEX idx_display_order (displayOrder),
      INDEX idx_is_hidden (isHidden),
      INDEX idx_project_id (projectId),
      UNIQUE KEY uniq_project_env (projectId, name),
      CONSTRAINT fk_env_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 9. Role Environment Permissions
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_role_environment_permissions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      roleId CHAR(26) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      permission VARCHAR(100) NOT NULL,
      isAdmin BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE KEY uniq_role_env_perm (roleId, environmentId, permission),
      CONSTRAINT fk_rep_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE CASCADE,
      CONSTRAINT fk_rep_env FOREIGN KEY (environmentId) REFERENCES g_environments(id) ON DELETE CASCADE,
      INDEX idx_role_id (roleId),
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 10. User Roles
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

  // 11. Groups
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_groups (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      orgId CHAR(26) NOT NULL,
      groupName VARCHAR(100) NOT NULL,
      description TEXT NULL,
      addNewUsersByDefault BOOLEAN NOT NULL DEFAULT FALSE,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_org_group (orgId, groupName),
      CONSTRAINT fk_groups_org FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE,
      INDEX idx_org_id (orgId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 12. Group Members
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_group_members (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      groupId CHAR(26) NOT NULL,
      userId CHAR(26) NOT NULL,
      isGroupAdmin BOOLEAN NOT NULL DEFAULT FALSE,
      addedBy CHAR(26) NULL,
      addedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_group_user (groupId, userId),
      CONSTRAINT fk_gm_group FOREIGN KEY (groupId) REFERENCES g_groups(id) ON DELETE CASCADE,
      CONSTRAINT fk_gm_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      INDEX idx_group_id (groupId),
      INDEX idx_user_id (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 13. Group Roles
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

  // 14. Environment Keys (SDK)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_environment_keys (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      keyType ENUM('client', 'server') NOT NULL,
      keyValue VARCHAR(255) NOT NULL UNIQUE,
      keyName VARCHAR(200) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      lastUsedAt TIMESTAMP NULL,
      usageCount BIGINT NOT NULL DEFAULT 0,
      createdBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_envkeys_env FOREIGN KEY (environmentId) REFERENCES g_environments(id) ON DELETE CASCADE,
      INDEX idx_environment_id (environmentId),
      INDEX idx_key_type (keyType),
      INDEX idx_is_active (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 15. Admin API Tokens
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_admin_api_tokens (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      orgId CHAR(26) NOT NULL,
      tokenName VARCHAR(200) NOT NULL,
      tokenValue VARCHAR(255) NOT NULL UNIQUE,
      description TEXT NULL,
      roleId CHAR(26) NULL,
      expiresAt TIMESTAMP NULL,
      lastUsedAt TIMESTAMP NULL,
      createdBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_aat_org FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE,
      CONSTRAINT fk_aat_role FOREIGN KEY (roleId) REFERENCES g_roles(id) ON DELETE SET NULL,
      INDEX idx_org_id (orgId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 16. SSO Providers
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_sso_providers (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      orgId CHAR(26) NOT NULL,
      providerName VARCHAR(100) NOT NULL,
      displayName VARCHAR(200) NOT NULL,
      protocol ENUM('oidc', 'saml') NOT NULL,
      clientId VARCHAR(255) NULL,
      clientSecret VARCHAR(500) NULL,
      issuerUrl VARCHAR(500) NULL,
      authorizationUrl VARCHAR(500) NULL,
      tokenUrl VARCHAR(500) NULL,
      userInfoUrl VARCHAR(500) NULL,
      entityId VARCHAR(500) NULL,
      ssoUrl VARCHAR(500) NULL,
      certificate TEXT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      autoCreateUsers BOOLEAN NOT NULL DEFAULT FALSE,
      defaultRoleId CHAR(26) NULL,
      defaultGroupIds JSON NULL,
      attributeMapping JSON NULL,
      createdBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_org_provider (orgId, providerName),
      CONSTRAINT fk_sso_org FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE,
      CONSTRAINT fk_sso_role FOREIGN KEY (defaultRoleId) REFERENCES g_roles(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Add FK from g_users.ssoProviderId
  try {
    await connection.execute(`
      ALTER TABLE g_users ADD CONSTRAINT fk_users_sso
      FOREIGN KEY (ssoProviderId) REFERENCES g_sso_providers(id) ON DELETE SET NULL
    `);
  } catch (err) {
    // 1022 = Duplicate key, 1826 = Duplicate foreign key constraint name
    if (err.errno !== 1022 && err.errno !== 1826) throw err;
  }

  // OAuth accounts
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_oauth_accounts (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      userId CHAR(26) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      providerId VARCHAR(255) NOT NULL,
      providerData JSON NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_oauth_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_provider_account (provider, providerId),
      INDEX idx_user_provider (userId, provider)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Password reset tokens
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_password_reset_tokens (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      userId CHAR(26) NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expiresAt TIMESTAMP NOT NULL,
      usedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_prt_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_expires (expiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Audit logs
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_audit_logs (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      userId CHAR(26) NULL,
      action VARCHAR(100) NOT NULL,
      entityType VARCHAR(100) NULL,
      entityId VARCHAR(127) NULL,
      oldValues JSON NULL,
      newValues JSON NULL,
      environmentId CHAR(26) NULL,
      resourceType VARCHAR(100) NULL,
      resourceId VARCHAR(127) NULL,
      details JSON NULL,
      description TEXT NULL,
      ipAddress VARCHAR(45) NULL,
      userAgent TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_environment (environmentId),
      INDEX idx_user_action (userId, action),
      INDEX idx_entity (entityType, entityId),
      INDEX idx_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Invitations
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_invitations (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      orgId CHAR(26) NOT NULL,
      token VARCHAR(36) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      expiresAt TIMESTAMP NOT NULL,
      usedAt TIMESTAMP NULL,
      usedBy CHAR(26) NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_inv_org FOREIGN KEY (orgId) REFERENCES g_organisations(id) ON DELETE CASCADE,
      INDEX idx_email (email),
      INDEX idx_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Mails
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_mails (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      senderId CHAR(26) NULL,
      senderName VARCHAR(255) NULL,
      recipientId CHAR(26) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      contentType VARCHAR(50) NOT NULL DEFAULT 'text',
      mailType VARCHAR(50) NOT NULL DEFAULT 'user',
      priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      category VARCHAR(100) NULL,
      isRead BOOLEAN NOT NULL DEFAULT FALSE,
      readAt TIMESTAMP NULL,
      isDeleted BOOLEAN NOT NULL DEFAULT FALSE,
      deletedAt TIMESTAMP NULL,
      isStarred BOOLEAN NOT NULL DEFAULT FALSE,
      mailData JSON NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_recipient (recipientId, isDeleted, createdAt),
      INDEX idx_sender (senderId, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[001] ??RBAC core tables completed');
};

exports.down = async function (connection) {
  const tables = [
    'g_mails', 'g_invitations',
    'g_audit_logs', 'g_password_reset_tokens', 'g_oauth_accounts',
    'g_sso_providers', 'g_admin_api_tokens', 'g_environment_keys',
    'g_group_roles', 'g_group_members', 'g_groups',
    'g_user_roles',
    'g_role_environment_permissions',
    'g_environments',
    'g_role_project_permissions',
    'g_projects', 'g_roles',
    'g_role_org_permissions',
    'g_organisation_members', 'g_users', 'g_organisations',
  ];
  for (const t of tables) {
    await connection.execute(`DROP TABLE IF EXISTS ${t}`);
  }
};
