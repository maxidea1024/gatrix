#!/usr/bin/env ts-node

import bcrypt from 'bcryptjs';
import { config } from '../config';
import logger from '../config/logger';
import database from '../config/database';
import { initializeSystemKV } from '../utils/system-kv';

const { ulid } = require('ulid');

// ==================== Default Organisation / Project / Environments ====================

async function createDefaultOrganisation(): Promise<string> {
  const existing = await database.query(
    'SELECT id FROM g_organisations WHERE orgName = ?',
    ['default']
  );
  if (existing.length > 0) {
    logger.info('Default organisation already exists, skipping creation');
    return existing[0].id;
  }

  const orgId = ulid();
  await database.query(
    `INSERT INTO g_organisations (id, orgName, displayName, description, isActive, createdAt, updatedAt)
     VALUES (?, 'default', 'Default Organisation', 'Auto-created default organisation', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [orgId]
  );
  logger.info(`Default organisation created: ${orgId}`);
  return orgId;
}

async function createDefaultProject(
  orgId: string,
  createdBy: string
): Promise<string> {
  const existing = await database.query(
    'SELECT id FROM g_projects WHERE orgId = ? AND projectName = ?',
    [orgId, 'default']
  );
  if (existing.length > 0) {
    logger.info('Default project already exists, skipping creation');
    return existing[0].id;
  }

  const projectId = ulid();
  await database.query(
    `INSERT INTO g_projects (id, orgId, projectName, displayName, isDefault, isActive, createdBy, createdAt, updatedAt)
     VALUES (?, ?, 'default', 'Default Project', TRUE, TRUE, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [projectId, orgId, createdBy]
  );
  logger.info(`Default project created: ${projectId}`);
  return projectId;
}

async function createDefaultEnvironments(projectId: string, createdBy: string) {
  const existing = await database.query(
    'SELECT id FROM g_environments WHERE projectId = ?',
    [projectId]
  );
  if (existing.length > 0) {
    logger.info('Default environments already exist, skipping creation');
    return;
  }

  const environments = [
    {
      env: 'development',
      displayName: 'Development',
      type: 'development',
      color: '#4CAF50',
      order: 0,
      isDefault: true,
    },
    {
      env: 'staging',
      displayName: 'Staging',
      type: 'staging',
      color: '#FF9800',
      order: 1,
      isDefault: false,
    },
    {
      env: 'production',
      displayName: 'Production',
      type: 'production',
      color: '#F44336',
      order: 2,
      isDefault: false,
      requiresApproval: true,
    },
  ];

  for (const e of environments) {
    await database.query(
      `INSERT INTO g_environments (id, name, displayName, environmentType, isSystemDefined, displayOrder, color, projectId, isDefault, requiresApproval, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, TRUE, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [
        ulid(),
        e.env,
        e.displayName,
        e.type,
        e.order,
        e.color,
        projectId,
        e.isDefault,
        e.requiresApproval || false,
        createdBy,
      ]
    );

    // Initialize system KV items ($platforms, $channels, etc.)
    const [envRow] = await database.query(
      'SELECT id FROM g_environments WHERE displayName = ? AND projectId = ? ORDER BY createdAt DESC LIMIT 1',
      [e.displayName, projectId]
    );
    if (envRow) {
      await initializeSystemKV(envRow.id);
    }

    logger.info(`  Environment created: ${e.displayName}`);
  }
}

// ==================== Internal Infrastructure (for Edge server) ====================

async function createInternalInfrastructure(adminUserId: string) {
  const orgName = '__internal__';

  // 1. Create internal organisation
  const existingOrg = await database.query(
    'SELECT id FROM g_organisations WHERE orgName = ?',
    [orgName]
  );
  let orgId: string;
  if (existingOrg.length > 0) {
    orgId = existingOrg[0].id;
    logger.info(
      'Internal infrastructure organisation already exists, skipping'
    );
  } else {
    orgId = ulid();
    await database.query(
      `INSERT INTO g_organisations (id, orgName, displayName, description, isActive, isInternal, isVisible, createdAt, updatedAt)
       VALUES (?, ?, 'Internal Infrastructure', 'System-internal organisation for Edge and infrastructure services', TRUE, TRUE, FALSE, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [orgId, orgName]
    );
    logger.info(`Internal infrastructure organisation created: ${orgId}`);
  }

  // 2. Create internal project
  const projectName = '__infrastructure__';
  const existingProject = await database.query(
    'SELECT id FROM g_projects WHERE orgId = ? AND projectName = ?',
    [orgId, projectName]
  );
  let projectId: string;
  if (existingProject.length > 0) {
    projectId = existingProject[0].id;
    logger.info('Internal infrastructure project already exists, skipping');
  } else {
    projectId = ulid();
    await database.query(
      `INSERT INTO g_projects (id, orgId, projectName, displayName, isDefault, isActive, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, 'Infrastructure', FALSE, TRUE, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [projectId, orgId, projectName, adminUserId]
    );
    logger.info(`Internal infrastructure project created: ${projectId}`);
  }

  // 3. Create internal environment (single)
  const envName = 'default';
  const existingEnv = await database.query(
    'SELECT id FROM g_environments WHERE projectId = ? AND name = ?',
    [projectId, envName]
  );
  let envId: string;
  if (existingEnv.length > 0) {
    envId = existingEnv[0].id;
    logger.info('Internal infrastructure environment already exists, skipping');
  } else {
    envId = ulid();
    await database.query(
      `INSERT INTO g_environments (id, name, displayName, environmentType, isSystemDefined, displayOrder, color, projectId, isDefault, createdBy, createdAt, updatedAt)
       VALUES (?, ?, 'Default', 'production', TRUE, 0, '#607D8B', ?, TRUE, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [envId, envName, projectId, adminUserId]
    );
    logger.info(`Internal infrastructure environment created: ${envId}`);
  }

  // 4. Create server API token bound to this environment
  const existingToken = await database.query(
    `SELECT id, tokenValue FROM g_api_access_tokens WHERE environmentId = ? AND tokenType = 'server' AND tokenName = 'Edge Infrastructure Token'`,
    [envId]
  );
  if (existingToken.length > 0) {
    logger.info(
      `Internal infrastructure token already exists: ${existingToken[0].tokenValue}`
    );
  } else {
    const crypto = require('crypto');
    const tokenValue = `gatrix_infra_${crypto.randomBytes(24).toString('hex')}`;
    await database.query(
      `INSERT INTO g_api_access_tokens (id, projectId, environmentId, tokenName, description, tokenValue, tokenType, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, 'Edge Infrastructure Token', 'Auto-generated token for Edge server SDK', ?, 'server', ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [ulid(), projectId, envId, tokenValue, adminUserId]
    );
    logger.info(`Internal infrastructure token created: ${tokenValue}`);
    logger.info(
      '>>> Set GATRIX_API_TOKEN in .env.local to this value for Edge server'
    );
  }
}

// ==================== Users & RBAC ====================

async function createAdminUser(orgId: string): Promise<string> {
  try {
    const existingAdmin = await database.query(
      'SELECT u.id FROM g_users u JOIN g_organisation_members om ON u.id = om.userId WHERE u.email = ?',
      [config.admin.email]
    );

    if (existingAdmin.length > 0) {
      logger.info('Admin user already exists, skipping creation');
      return existingAdmin[0].id;
    }

    const passwordHash = await bcrypt.hash(config.admin.password, 12);
    const userId = ulid();

    // Create user
    await database.query(
      `INSERT INTO g_users (id, email, passwordHash, name, status, emailVerified, emailVerifiedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'active', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [userId, config.admin.email, passwordHash, config.admin.name]
    );

    // Add as org member
    await database.query(
      `INSERT INTO g_organisation_members (id, orgId, userId, joinedAt)
       VALUES (?, ?, ?, UTC_TIMESTAMP())`,
      [ulid(), orgId, userId]
    );

    logger.info(`Admin user created: ${config.admin.email} (ID: ${userId})`);
    logger.warn('Please change the default admin password after first login!');

    // Audit log
    await database.query(
      `INSERT INTO g_audit_logs (id, userId, action, resourceType, resourceId, details, createdAt)
       VALUES (?, ?, 'create', 'user', ?, ?, UTC_TIMESTAMP())`,
      [
        ulid(),
        userId,
        userId,
        JSON.stringify({
          message: 'Admin user created during seeding',
          email: config.admin.email,
        }),
      ]
    );

    return userId;
  } catch (error) {
    logger.error('Failed to create admin user:', error);
    throw error;
  }
}

// ==================== Default Context Fields ====================

async function createDefaultContextFields(projectId: string) {
  const existing = await database.query(
    'SELECT id FROM g_feature_context_fields WHERE projectId = ? LIMIT 1',
    [projectId]
  );
  if (existing.length > 0) {
    logger.info('Default context fields already exist, skipping creation');
    return;
  }

  const defaultFields = [
    {
      fieldName: 'userId',
      fieldType: 'string',
      description: 'Unique user identifier',
      stickiness: true,
      sortOrder: 1,
    },
    {
      fieldName: 'sessionId',
      fieldType: 'string',
      description: 'Session identifier',
      stickiness: true,
      sortOrder: 2,
    },
    {
      fieldName: 'appName',
      fieldType: 'string',
      description: 'Application name',
      stickiness: false,
      sortOrder: 3,
    },
    {
      fieldName: 'appVersion',
      fieldType: 'semver',
      description: 'Application version',
      stickiness: false,
      sortOrder: 4,
    },
    {
      fieldName: 'remoteAddress',
      fieldType: 'string',
      description: 'Remote IP address',
      stickiness: false,
      sortOrder: 5,
    },
    {
      fieldName: 'country',
      fieldType: 'string',
      description: 'Country code',
      stickiness: false,
      sortOrder: 6,
    },
    {
      fieldName: 'city',
      fieldType: 'string',
      description: 'City name',
      stickiness: false,
      sortOrder: 7,
    },
    {
      fieldName: 'userAgent',
      fieldType: 'string',
      description: 'User agent string',
      stickiness: false,
      sortOrder: 8,
    },
    {
      fieldName: 'currentTime',
      fieldType: 'date',
      description: 'Current timestamp',
      stickiness: false,
      sortOrder: 9,
    },
  ];

  for (const f of defaultFields) {
    await database.query(
      `INSERT INTO g_feature_context_fields (id, projectId, fieldName, fieldType, description, stickiness, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [
        ulid(),
        projectId,
        f.fieldName,
        f.fieldType,
        f.description,
        f.stickiness,
        f.sortOrder,
      ]
    );
  }
  logger.info('Default context fields created');
}

// ==================== Default Environment Keys ====================

async function createDefaultEnvironmentKeys(
  projectId: string,
  createdBy: string
) {
  const existing = await database.query(
    `SELECT ek.id FROM g_environment_keys ek
     JOIN g_environments e ON ek.environmentId = e.id
     WHERE e.projectId = ? LIMIT 1`,
    [projectId]
  );
  if (existing.length > 0) {
    logger.info('Default environment keys already exist, skipping creation');
    return;
  }

  const environments = await database.query(
    'SELECT id, displayName FROM g_environments WHERE projectId = ?',
    [projectId]
  );

  const { nanoid } = require('nanoid');
  for (const env of environments) {
    // Create client key
    const clientKey = `gx_client_${nanoid()}`;
    await database.query(
      `INSERT INTO g_environment_keys (id, environmentId, keyType, keyValue, keyName, isActive, createdBy, createdAt)
       VALUES (?, ?, 'client', ?, ?, TRUE, ?, UTC_TIMESTAMP())`,
      [ulid(), env.id, clientKey, `${env.displayName} Client Key`, createdBy]
    );

    // Create server key
    const serverKey = `gx_server_${nanoid()}`;
    await database.query(
      `INSERT INTO g_environment_keys (id, environmentId, keyType, keyValue, keyName, isActive, createdBy, createdAt)
       VALUES (?, ?, 'server', ?, ?, TRUE, ?, UTC_TIMESTAMP())`,
      [ulid(), env.id, serverKey, `${env.displayName} Server Key`, createdBy]
    );

    logger.info(`  Environment keys created for: ${env.displayName}`);
  }
}

// ==================== Sample Release Flow Templates ====================

async function createSampleReleaseFlows(createdBy: string) {
  try {
    const existingFlows = await database.query(
      'SELECT COUNT(*) as count FROM g_release_flows WHERE discriminator = "template"'
    );

    if (existingFlows[0].count > 0) {
      logger.info('Sample release flows already exist, skipping creation');
      return;
    }

    // Standard Progressive Rollout Template
    const templateId = ulid();
    await database.query(
      `INSERT INTO g_release_flows (id, flowName, displayName, description, discriminator, isArchived, createdBy, createdAt, updatedAt)
       VALUES (?, 'standard-rollout', 'Standard Progressive Rollout', 'Gradual rollout: internal -> 10% -> 50% -> 100%', 'template', FALSE, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [templateId, createdBy]
    );

    const milestones = [
      {
        name: 'Internal Testing',
        sortOrder: 0,
        strategy: {
          name: 'flexibleRollout',
          params: { rollout: 0, stickiness: 'default', groupId: 'default' },
          constraints: [
            {
              contextName: 'appName',
              operator: 'IN',
              values: ['Gatrix-Admin'],
            },
          ],
        },
      },
      {
        name: 'Beta (10%)',
        sortOrder: 1,
        strategy: {
          name: 'flexibleRollout',
          params: { rollout: 10, stickiness: 'default', groupId: 'default' },
        },
      },
      {
        name: 'Limited (50%)',
        sortOrder: 2,
        strategy: {
          name: 'flexibleRollout',
          params: { rollout: 50, stickiness: 'default', groupId: 'default' },
        },
      },
      {
        name: 'Full Release (100%)',
        sortOrder: 3,
        strategy: {
          name: 'flexibleRollout',
          params: { rollout: 100, stickiness: 'default', groupId: 'default' },
        },
      },
    ];

    for (const m of milestones) {
      const milestoneId = ulid();
      await database.query(
        `INSERT INTO g_release_flow_milestones (id, flowId, name, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [milestoneId, templateId, m.name, m.sortOrder]
      );

      const strategyId = ulid();
      await database.query(
        `INSERT INTO g_release_flow_strategies (id, milestoneId, strategyName, parameters, constraints, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
        [
          strategyId,
          milestoneId,
          m.strategy.name,
          JSON.stringify(m.strategy.params),
          JSON.stringify(m.strategy.constraints || []),
          0,
        ]
      );
    }

    logger.info('Sample release flows created successfully');
  } catch (error) {
    logger.error('Failed to create sample release flows:', error);
    throw error;
  }
}

// ==================== Default RBAC Roles ====================

async function createDefaultRoles(orgId: string, adminUserId: string) {
  const existing = await database.query(
    'SELECT id FROM g_roles WHERE orgId = ? LIMIT 1',
    [orgId]
  );
  if (existing.length > 0) {
    logger.info('Default roles already exist, skipping creation');
    return;
  }

  // All org-level resources
  const orgResources = [
    'users',
    'groups',
    'roles',
    'invitations',
    'projects',
    'admin_tokens',
    'ip_whitelist',
    'account_whitelist',
    'integrations',
    'audit_logs',
    'monitoring',
    'realtime_events',
    'open_api',
    'console',
    'chat',
    'scheduler',
    'event_lens',
    'system_settings',
    'translation',
  ];
  // All project-level resources
  const projectResources = [
    'features',
    'segments',
    'context_fields',
    'release_flows',
    'unknown_flags',
    'crash_events',
    'tags',
    'impact_metrics',
    'service_accounts',
    'signal_endpoints',
    'actions',
    'data',
  ];
  // All env-level resources
  const envResources = [
    'environments',
    'env_features',
    'env_keys',
    'change_requests',
    'client_versions',
    'game_worlds',
    'maintenance',
    'maintenance_templates',
    'service_notices',
    'banners',
    'servers',
    'message_templates',
    'vars',
    'planning_data',
    'coupons',
    'coupon_settings',
    'surveys',
    'store_products',
    'reward_templates',
    'ingame_popups',
    'operation_events',
  ];
  const allResources = [...orgResources, ...projectResources, ...envResources];
  const crudActions = ['create', 'read', 'update', 'delete'];

  // 1. Create Super Admin role with wildcard permission
  const superAdminRoleId = ulid();
  await database.query(
    `INSERT INTO g_roles (id, orgId, roleName, description, createdAt, updatedAt)
     VALUES (?, ?, 'Super Admin', 'Full access to all resources (wildcard)', UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [superAdminRoleId, orgId]
  );
  await database.query(
    `INSERT INTO g_role_permissions (id, roleId, permission) VALUES (?, ?, '*:*')`,
    [ulid(), superAdminRoleId]
  );
  logger.info('  Role created: Super Admin (wildcard *:*)');

  // Bind Super Admin role to admin user at org scope
  await database.query(
    `INSERT INTO g_role_bindings (id, userId, roleId, scopeType, scopeId, assignedAt)
     VALUES (?, ?, ?, 'org', ?, UTC_TIMESTAMP())`,
    [ulid(), adminUserId, superAdminRoleId, orgId]
  );
  logger.info(`  Admin user bound to Super Admin role (orgId: ${orgId})`);

  // 2. Create standard roles (Viewer, Editor, Manager)
  const roles = [
    {
      name: 'Viewer',
      description: 'Read-only access to all resources',
      actions: ['read'],
    },
    {
      name: 'Editor',
      description: 'Read and update access to all resources',
      actions: ['read', 'update'],
    },
    {
      name: 'Manager',
      description: 'Full CRUD access to all resources',
      actions: crudActions,
    },
  ];

  for (const role of roles) {
    const roleId = ulid();
    await database.query(
      `INSERT INTO g_roles (id, orgId, roleName, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [roleId, orgId, role.name, role.description]
    );

    // Generate permissions: resource:action
    const perms: string[] = [];
    for (const resource of allResources) {
      for (const action of role.actions) {
        perms.push(`${resource}:${action}`);
      }
    }

    // Bulk insert permissions
    if (perms.length > 0) {
      const values = perms
        .map((p) => `('${ulid()}', '${roleId}', '${p}')`)
        .join(',');
      await database.query(
        `INSERT INTO g_role_permissions (id, roleId, permission) VALUES ${values}`
      );
    }

    logger.info(`  Role created: ${role.name} (${perms.length} permissions)`);
  }

  // 3. Create specialized roles (targeted resource access)
  const specializedRoles = [
    {
      name: 'System Monitoring',
      description:
        'Read-only access to server infrastructure, monitoring, and real-time events',
      resources: [
        'servers',
        'monitoring',
        'realtime_events',
        'event_lens',
        'scheduler',
      ],
      actions: ['read'],
    },
    {
      name: 'Operations Manager',
      description:
        'Full CRUD access to live operations: coupons, notices, banners, servers, and events',
      resources: [
        'coupons',
        'coupon_settings',
        'service_notices',
        'banners',
        'servers',
        'message_templates',
        'maintenance',
        'maintenance_templates',
        'ingame_popups',
        'operation_events',
        'surveys',
        'store_products',
        'reward_templates',
        'vars',
        'planning_data',
      ],
      actions: crudActions,
    },
    {
      name: 'Feature Manager',
      description:
        'Full CRUD access to feature flags, segments, release flows, and related resources',
      resources: [
        'features',
        'segments',
        'context_fields',
        'release_flows',
        'unknown_flags',
        'tags',
        'impact_metrics',
        'env_features',
        'env_keys',
        'change_requests',
        'environments',
      ],
      actions: crudActions,
    },
    {
      name: 'Security Admin',
      description:
        'Full CRUD access to roles, groups, users, tokens, and access control',
      resources: [
        'users',
        'groups',
        'roles',
        'invitations',
        'admin_tokens',
        'ip_whitelist',
        'account_whitelist',
        'service_accounts',
        'audit_logs',
      ],
      actions: crudActions,
    },
  ];

  for (const role of specializedRoles) {
    const roleId = ulid();
    await database.query(
      `INSERT INTO g_roles (id, orgId, roleName, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [roleId, orgId, role.name, role.description]
    );

    const perms: string[] = [];
    for (const resource of role.resources) {
      for (const action of role.actions) {
        perms.push(`${resource}:${action}`);
      }
    }

    if (perms.length > 0) {
      const values = perms
        .map((p) => `('${ulid()}', '${roleId}', '${p}')`)
        .join(',');
      await database.query(
        `INSERT INTO g_role_permissions (id, roleId, permission) VALUES ${values}`
      );
    }

    logger.info(`  Role created: ${role.name} (${perms.length} permissions)`);
  }
  logger.info('Default roles created');
}

// ==================== Main Seed / Clear Functions ====================

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // 1. Create default organisation
    const orgId = await createDefaultOrganisation();

    // 2. Create admin user with org membership
    const adminUserId = await createAdminUser(orgId);

    // 3. Create default project under the organisation
    const projectId = await createDefaultProject(orgId, adminUserId);

    // 4. Create default environments under the project
    await createDefaultEnvironments(projectId, adminUserId);

    // 5. Create default context fields for the project
    await createDefaultContextFields(projectId);

    // 6. Create default environment keys
    await createDefaultEnvironmentKeys(projectId, adminUserId);

    // 7. Create sample release flow templates
    await createSampleReleaseFlows(adminUserId);

    // 8. Create default RBAC roles (Super Admin, Viewer, Editor, Manager) + bind admin
    await createDefaultRoles(orgId, adminUserId);

    // 9. Create internal infrastructure for Edge server
    await createInternalInfrastructure(adminUserId);

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

async function clearDatabase() {
  try {
    logger.info('Clearing database...');

    // Disable FK checks for clean truncation
    await database.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'g_audit_logs',
      'g_oauth_accounts',
      'g_password_reset_tokens',
      'g_sessions',
      'g_mails',
      'g_invitations',
      'g_environment_keys',
      'g_admin_api_tokens',
      'g_release_flow_safeguards',
      'g_release_flow_strategy_segments',
      'g_release_flow_strategies',
      'g_release_flow_milestones',
      'g_release_flows',
      'g_feature_code_references',
      'g_impact_metric_configs',
      'g_feature_flag_segments',
      'g_feature_variant_metrics',
      'g_feature_metrics',
      'g_feature_variants',
      'g_feature_strategies',
      'g_feature_flag_environments',
      'g_feature_segments',
      'g_feature_context_fields',
      'g_feature_flags',
      'g_role_bindings',
      'g_role_permissions',
      'g_group_members',
      'g_groups',
      'g_roles',
      'g_environments',
      'g_projects',
      'g_project_members',
      'g_organisation_members',
      'g_sso_providers',
      'g_users',
      'g_organisations',
    ];

    for (const table of tables) {
      await database.query(`DELETE FROM ${table}`);
    }

    await database.query('SET FOREIGN_KEY_CHECKS = 1');

    logger.info('Database cleared successfully');
  } catch (error) {
    logger.error('Failed to clear database:', error);
    throw error;
  }
}

// Parse command line arguments
const command = process.argv[2];

async function main() {
  switch (command) {
    case 'run':
    case 'seed':
      await seedDatabase();
      break;
    case 'clear':
      await clearDatabase();
      break;
    case 'reset':
      await clearDatabase();
      await seedDatabase();
      break;
    default:
      console.log('Usage:');
      console.log('  npm run seed run|seed  - Seed the database');
      console.log('  npm run seed clear     - Clear all data');
      console.log('  npm run seed reset     - Clear and re-seed');
      process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Seed script failed:', error);
    process.exit(1);
  });
}
