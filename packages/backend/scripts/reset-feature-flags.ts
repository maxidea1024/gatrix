/**
 * Reset feature flag tables and reseed context fields
 */

import db from '../src/config/knex';
import { ulid } from 'ulid';

async function main() {
  console.log('Resetting feature flag tables...');

  // Delete in order due to foreign key constraints
  const tablesToClear = [
    'g_feature_metrics',
    'g_feature_variant_metrics',
    'g_feature_strategy_segments',
    'g_feature_constraints',
    'g_feature_strategies',
    'g_feature_variants',
    'g_feature_flag_environments',
    'g_feature_flags',
    'g_feature_segments',
    'g_feature_context_fields',
  ];

  for (const table of tablesToClear) {
    try {
      await db(table).del();
      console.log(`  ✓ Cleared ${table}`);
    } catch (err: any) {
      if (err.errno === 1146) {
        console.log(`  - Skipped ${table} (table doesn't exist)`);
      } else {
        throw err;
      }
    }
  }

  console.log('✓ All feature flag tables cleared');

  // Seed context fields
  console.log('Seeding context fields...');

  const contextFields = [
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
      fieldName: 'deviceId',
      fieldType: 'string',
      description: 'Device unique identifier',
      stickiness: true,
      sortOrder: 3,
    },
    {
      fieldName: 'serverRegion',
      fieldType: 'string',
      description: 'Server region',
      legalValues: ['kr', 'us', 'eu', 'jp', 'cn'],
      sortOrder: 11,
    },
    {
      fieldName: 'worldId',
      fieldType: 'string',
      description: 'Game world/server ID',
      sortOrder: 12,
    },
    {
      fieldName: 'role',
      fieldType: 'string',
      description: 'User role',
      legalValues: ['admin', 'gm', 'vip', 'user', 'guest'],
      sortOrder: 20,
    },
    { fieldName: 'isBeta', fieldType: 'boolean', description: 'Beta tester flag', sortOrder: 22 },
    { fieldName: 'isPremium', fieldType: 'boolean', description: 'Premium status', sortOrder: 23 },
    {
      fieldName: 'platform',
      fieldType: 'string',
      description: 'Platform type',
      legalValues: ['pc', 'mobile', 'console'],
      sortOrder: 30,
    },
    {
      fieldName: 'deviceType',
      fieldType: 'string',
      description: 'Device/OS type',
      legalValues: ['windows', 'mac', 'ios', 'android'],
      sortOrder: 31,
    },
    {
      fieldName: 'store',
      fieldType: 'string',
      description: 'Store platform',
      legalValues: ['steam', 'epic', 'appstore', 'playstore', 'sdo'],
      sortOrder: 40,
    },
    { fieldName: 'appName', fieldType: 'string', description: 'Application name', sortOrder: 49 },
    {
      fieldName: 'appVersion',
      fieldType: 'semver',
      description: 'Application version',
      sortOrder: 50,
    },
    { fieldName: 'accountLevel', fieldType: 'number', description: 'Account level', sortOrder: 60 },
    {
      fieldName: 'characterLevel',
      fieldType: 'number',
      description: 'Character level',
      sortOrder: 61,
    },
    { fieldName: 'vipTier', fieldType: 'number', description: 'VIP tier (0-10)', sortOrder: 70 },
    {
      fieldName: 'abGroup',
      fieldType: 'string',
      description: 'A/B test group',
      legalValues: ['control', 'A', 'B', 'C'],
      stickiness: true,
      sortOrder: 80,
    },
    {
      fieldName: 'currentTime',
      fieldType: 'datetime',
      description: 'Current timestamp',
      sortOrder: 90,
    },
    {
      fieldName: 'remoteAddress',
      fieldType: 'string',
      description: 'Remote IP address',
      sortOrder: 92,
    },
  ];

  for (const field of contextFields) {
    await db('g_feature_context_fields').insert({
      id: ulid(),
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      description: field.description,
      legalValues: field.legalValues ? JSON.stringify(field.legalValues) : null,
      stickiness: field.stickiness || false,
      sortOrder: field.sortOrder,
      isEnabled: true,
      createdBy: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  console.log(`✓ Added ${contextFields.length} context fields`);
  await db.destroy();
  console.log('Done!');
}

main().catch(console.error);
