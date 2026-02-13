/**
 * Context Field Seed Script
 * Run with: yarn ts-node scripts/seed-context-fields.ts
 */

import db from '../src/config/knex';
import { ulid } from 'ulid';

interface ContextFieldSeed {
  fieldName: string;
  fieldType: string;
  displayName?: string;
  description: string;
  legalValues?: string[];
  stickiness?: boolean;
  sortOrder: number;
  tags?: string[];
  validationRules?: Record<string, any>;
}

async function main() {
  console.log('Seeding context fields...');

  const contextFields: ContextFieldSeed[] = [
    {
      fieldName: 'userId',
      fieldType: 'string',
      displayName: 'User ID',
      description: 'Unique user identifier',
      stickiness: true,
      sortOrder: 1,
      tags: ['identity'],
      validationRules: { trimWhitespace: 'trim', allowEmpty: false },
    },
    {
      fieldName: 'sessionId',
      fieldType: 'string',
      displayName: 'Session ID',
      description: 'Session identifier',
      stickiness: true,
      sortOrder: 2,
      tags: ['identity'],
      validationRules: { trimWhitespace: 'trim' },
    },
    {
      fieldName: 'deviceId',
      fieldType: 'string',
      displayName: 'Device ID',
      description: 'Device unique identifier',
      stickiness: true,
      sortOrder: 3,
      tags: ['identity'],
      validationRules: { trimWhitespace: 'trim' },
    },
    {
      fieldName: 'environment',
      fieldType: 'string',
      displayName: 'Environment',
      description: 'Deployment environment',
      legalValues: ['development', 'staging', 'production'],
      sortOrder: 10,
      tags: ['system'],
      validationRules: { enabled: true, trimWhitespace: 'trim', allowEmpty: false },
    },
    {
      fieldName: 'serverRegion',
      fieldType: 'string',
      displayName: 'Server Region',
      description: 'Server region',
      legalValues: ['kr', 'us', 'eu', 'jp', 'cn'],
      sortOrder: 11,
      tags: ['system'],
      validationRules: { enabled: true, trimWhitespace: 'trim' },
    },
    {
      fieldName: 'worldId',
      fieldType: 'string',
      displayName: 'World ID',
      description: 'Game world/server ID',
      sortOrder: 12,
      tags: ['game'],
      validationRules: { trimWhitespace: 'trim' },
    },
    {
      fieldName: 'countryCode',
      fieldType: 'string',
      displayName: 'Country Code',
      description: 'Country code',
      legalValues: ['KR', 'US', 'JP', 'CN'],
      sortOrder: 13,
      tags: ['geo'],
      validationRules: { enabled: true, trimWhitespace: 'trim', allowEmpty: false },
    },
    {
      fieldName: 'role',
      fieldType: 'string',
      displayName: 'Role',
      description: 'User role',
      legalValues: ['admin', 'gm', 'vip', 'user', 'guest'],
      sortOrder: 20,
      tags: ['identity'],
      validationRules: { enabled: true, trimWhitespace: 'trim', allowEmpty: false },
    },
    {
      fieldName: 'isBeta',
      fieldType: 'boolean',
      displayName: 'Is Beta',
      description: 'Beta tester flag',
      sortOrder: 22,
      tags: ['identity'],
    },
    {
      fieldName: 'isPremium',
      fieldType: 'boolean',
      displayName: 'Is Premium',
      description: 'Premium status',
      sortOrder: 23,
      tags: ['identity'],
    },
    {
      fieldName: 'platform',
      fieldType: 'string',
      displayName: 'Platform',
      description: 'Platform type',
      legalValues: ['pc', 'mobile', 'console'],
      sortOrder: 30,
      tags: ['device'],
      validationRules: { enabled: true, trimWhitespace: 'trim', allowEmpty: false },
    },
    {
      fieldName: 'deviceType',
      fieldType: 'string',
      displayName: 'Device Type',
      description: 'Device/OS type',
      legalValues: ['windows', 'mac', 'ios', 'android'],
      sortOrder: 31,
      tags: ['device'],
      validationRules: { enabled: true, trimWhitespace: 'trim' },
    },
    {
      fieldName: 'store',
      fieldType: 'string',
      displayName: 'Store',
      description: 'Store platform',
      legalValues: ['steam', 'epic', 'appstore', 'playstore', 'sdo'],
      sortOrder: 40,
      tags: ['distribution'],
      validationRules: { enabled: true, trimWhitespace: 'trim' },
    },
    {
      fieldName: 'appVersion',
      fieldType: 'semver',
      displayName: 'App Version',
      description: 'Application version',
      sortOrder: 50,
      tags: ['system'],
      validationRules: { trimWhitespace: 'trim', allowEmpty: false },
    },
    {
      fieldName: 'accountLevel',
      fieldType: 'number',
      displayName: 'Account Level',
      description: 'Account level',
      sortOrder: 60,
      tags: ['game'],
      validationRules: { enabled: true, min: 0, integerOnly: true },
    },
    {
      fieldName: 'characterLevel',
      fieldType: 'number',
      displayName: 'Character Level',
      description: 'Character level',
      sortOrder: 61,
      tags: ['game'],
      validationRules: { enabled: true, min: 1, integerOnly: true },
    },
    {
      fieldName: 'vipTier',
      fieldType: 'number',
      displayName: 'VIP Tier',
      description: 'VIP tier (0-10)',
      sortOrder: 70,
      tags: ['identity'],
      validationRules: { enabled: true, min: 0, max: 10, integerOnly: true },
    },
    {
      fieldName: 'abGroup',
      fieldType: 'string',
      displayName: 'A/B Group',
      description: 'A/B test group',
      legalValues: ['control', 'A', 'B', 'C'],
      stickiness: true,
      sortOrder: 80,
      tags: ['experiment'],
      validationRules: { enabled: true, trimWhitespace: 'trim', allowEmpty: false },
    },
    {
      fieldName: 'currentTime',
      fieldType: 'date',
      displayName: 'Current Time',
      description: 'Current timestamp',
      sortOrder: 90,
      tags: ['system'],
    },
    {
      fieldName: 'remoteAddress',
      fieldType: 'string',
      displayName: 'Remote Address',
      description: 'Remote IP address',
      sortOrder: 92,
      tags: ['system'],
      validationRules: { trimWhitespace: 'trim' },
    },
  ];

  for (const field of contextFields) {
    await db('g_feature_context_fields').insert({
      id: ulid(),
      fieldName: field.fieldName,
      displayName: field.displayName || null,
      fieldType: field.fieldType,
      description: field.description,
      legalValues: field.legalValues ? JSON.stringify(field.legalValues) : null,
      validationRules: field.validationRules ? JSON.stringify(field.validationRules) : null,
      tags: field.tags ? JSON.stringify(field.tags) : null,
      stickiness: field.stickiness || false,
      sortOrder: field.sortOrder,
      isEnabled: true,
      createdBy: 1,
      createdAt: db.raw('UTC_TIMESTAMP()'),
      updatedAt: db.raw('UTC_TIMESTAMP()'),
    });
  }

  console.log(`  ✓ Added ${contextFields.length} context fields`);
  await db.destroy();
}

main();
