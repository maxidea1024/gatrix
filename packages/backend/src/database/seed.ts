#!/usr/bin/env ts-node

import bcrypt from 'bcryptjs';
import { config } from '../config';
import logger from '../config/logger';
import database from '../config/database';

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await database.query(
      'SELECT id FROM g_users WHERE email = ? OR role = "admin"',
      [config.admin.email]
    );

    if (existingAdmin.length > 0) {
      logger.info('Admin user already exists, skipping creation');
      return;
    }

    // Hash the admin password
    const passwordHash = await bcrypt.hash(config.admin.password, 12);

    // Create admin user
    const result = await database.query(
      `INSERT INTO g_users (email, passwordHash, name, role, status, emailVerified, emailVerifiedAt)
       VALUES (?, ?, ?, 'admin', 'active', TRUE, UTC_TIMESTAMP())`,
      [config.admin.email, passwordHash, config.admin.name]
    );

    logger.info(`Admin user created successfully with ID: ${result.insertId}`);
    logger.info(`Admin credentials:`);
    logger.info(`  Email: ${config.admin.email}`);
    logger.info(`  Password: ${config.admin.password}`);
    logger.warn('Please change the default admin password after first login!');

    // Log the admin creation
    await database.query(
      `INSERT INTO g_audit_logs (userId, action, resourceType, resourceId, details)
       VALUES (?, 'create', 'user', ?, ?)`,
      [
        result.insertId,
        result.insertId.toString(),
        JSON.stringify({
          message: 'Admin user created during seeding',
          email: config.admin.email,
          role: 'admin',
        }),
      ]
    );
  } catch (error) {
    logger.error('Failed to create admin user:', error);
    throw error;
  }
}

async function createSampleUsers() {
  try {
    // Check if sample users already exist
    const existingUsers = await database.query(
      'SELECT COUNT(*) as count FROM g_users WHERE role = "user"'
    );

    if (existingUsers[0].count > 0) {
      logger.info('Sample users already exist, skipping creation');
      return;
    }

    const sampleUsers = [
      {
        email: 'user1@example.com',
        name: 'John Doe',
        status: 'active',
      },
      {
        email: 'user2@example.com',
        name: 'Jane Smith',
        status: 'pending',
      },
      {
        email: 'user3@example.com',
        name: 'Bob Johnson',
        status: 'suspended',
      },
    ];

    for (const user of sampleUsers) {
      const passwordHash = await bcrypt.hash('password123', 12);

      const result = await database.query(
        `INSERT INTO g_users (email, passwordHash, name, role, status, emailVerified, emailVerifiedAt)
         VALUES (?, ?, ?, 'user', ?, TRUE, UTC_TIMESTAMP())`,
        [user.email, passwordHash, user.name, user.status]
      );

      logger.info(`Sample user created: ${user.email} (${user.status})`);

      // Log the user creation
      await database.query(
        `INSERT INTO g_audit_logs (userId, action, resourceType, resourceId, details)
         VALUES (?, 'create', 'user', ?, ?)`,
        [
          result.insertId,
          result.insertId.toString(),
          JSON.stringify({
            message: 'Sample user created during seeding',
            email: user.email,
            role: 'user',
            status: user.status,
          }),
        ]
      );
    }

    logger.info('Sample users created successfully');
  } catch (error) {
    logger.error('Failed to create sample users:', error);
    throw error;
  }
}

const { ulid } = require('ulid');

async function createSampleReleaseFlows() {
  try {
    const existingFlows = await database.query(
      'SELECT COUNT(*) as count FROM g_release_flows WHERE discriminator = "template"'
    );

    if (existingFlows[0].count > 0) {
      logger.info('Sample release flows already exist, skipping creation');
      return;
    }

    // 1. Standard Progressive Rollout Template
    const templateId = ulid();
    await database.query(
      `INSERT INTO g_release_flows (id, flowName, displayName, description, discriminator, isArchived, createdBy, createdAt, updatedAt)
       VALUES (?, 'standard-rollout', 'Standard Progressive Rollout', 'Gradual rollout: internal -> 10% -> 50% -> 100%', 'template', FALSE, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [templateId]
    );

    const milestones = [
      { name: 'Internal Testing', sortOrder: 0, strategy: { name: 'flexibleRollout', params: { rollout: 0, stickiness: 'default', groupId: 'default' }, constraints: [{ contextName: 'appName', operator: 'IN', values: ['Gatrix-Admin'] }] } },
      { name: 'Beta (10%)', sortOrder: 1, strategy: { name: 'flexibleRollout', params: { rollout: 10, stickiness: 'default', groupId: 'default' } } },
      { name: 'Limited (50%)', sortOrder: 2, strategy: { name: 'flexibleRollout', params: { rollout: 50, stickiness: 'default', groupId: 'default' } } },
      { name: 'Full Release (100%)', sortOrder: 3, strategy: { name: 'flexibleRollout', params: { rollout: 100, stickiness: 'default', groupId: 'default' } } },
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
          0
        ]
      );
    }

    logger.info('Sample release flows created successfully');
  } catch (error) {
    logger.error('Failed to create sample release flows:', error);
    throw error;
  }
}

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    await createAdminUser();
    await createSampleUsers();
    await createSampleReleaseFlows();

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

async function clearDatabase() {
  try {
    logger.info('Clearing database...');

    // Clear tables in reverse order of dependencies
    await database.query('DELETE FROM g_audit_logs');
    await database.query('DELETE FROM g_oauth_accounts');
    await database.query('DELETE FROM g_sessions');
    await database.query('DELETE FROM g_users');

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
