/**
 * Re-seed segments with caseInsensitive: true
 */
import db from '../packages/backend/src/config/knex';
import { ulid } from 'ulid';

async function main() {
  console.log('Reseeding segments with caseInsensitive...');

  // Clear existing segments
  await db('g_feature_segments').delete();
  console.log('  ✓ Cleared existing segments');

  const defaultSegments = [
    // User Role Segments
    {
      segmentName: 'admins',
      displayName: 'Administrators',
      description: 'Users with admin role',
      constraints: [
        { contextName: 'role', operator: 'str_eq', value: 'admin', caseInsensitive: true },
      ],
    },
    {
      segmentName: 'gm-staff',
      displayName: 'GM & Moderators',
      description: 'Game masters and moderators',
      constraints: [
        {
          contextName: 'role',
          operator: 'str_in',
          values: ['admin', 'gm', 'moderator'],
          caseInsensitive: true,
        },
      ],
    },
    {
      segmentName: 'internal-testers',
      displayName: 'Internal Testers',
      description: 'Internal QA and test accounts',
      constraints: [
        { contextName: 'isBeta', operator: 'bool_is', value: 'true' },
        {
          contextName: 'role',
          operator: 'str_in',
          values: ['admin', 'gm', 'tester'],
          caseInsensitive: true,
        },
      ],
    },
    // Beta & VIP
    {
      segmentName: 'beta-testers',
      displayName: 'Beta Testers',
      description: 'Users enrolled in beta testing',
      constraints: [{ contextName: 'isBeta', operator: 'bool_is', value: 'true' }],
    },
    {
      segmentName: 'vip-users',
      displayName: 'VIP Users',
      description: 'VIP or premium role users',
      constraints: [
        {
          contextName: 'role',
          operator: 'str_in',
          values: ['vip', 'premium'],
          caseInsensitive: true,
        },
      ],
    },
    // Payment Tiers
    {
      segmentName: 'paying-users',
      displayName: 'Paying Users',
      description: 'Users who have made purchases',
      constraints: [{ contextName: 'purchaseCount', operator: 'num_gt', value: '0' }],
    },
    {
      segmentName: 'whales',
      displayName: 'Whales',
      description: 'High-spending users',
      constraints: [
        {
          contextName: 'paymentTier',
          operator: 'str_in',
          values: ['whale', 'kraken'],
          caseInsensitive: true,
        },
      ],
    },
    // Platform
    {
      segmentName: 'pc-users',
      displayName: 'PC Users',
      description: 'Users on PC',
      constraints: [
        { contextName: 'platform', operator: 'str_eq', value: 'pc', caseInsensitive: true },
      ],
    },
    {
      segmentName: 'mobile-users',
      displayName: 'Mobile Users',
      description: 'Users on mobile',
      constraints: [
        { contextName: 'platform', operator: 'str_eq', value: 'mobile', caseInsensitive: true },
      ],
    },
    // Region
    {
      segmentName: 'korea-users',
      displayName: 'Korea Users',
      description: 'Users in Korea',
      constraints: [
        { contextName: 'countryCode', operator: 'str_eq', value: 'KR', caseInsensitive: true },
      ],
    },
    {
      segmentName: 'china-users',
      displayName: 'China Users',
      description: 'Users in China region',
      constraints: [
        {
          contextName: 'countryCode',
          operator: 'str_in',
          values: ['CN', 'TW'],
          caseInsensitive: true,
        },
      ],
    },
    // Environment
    {
      segmentName: 'development-env',
      displayName: 'Development Environment',
      description: 'Dev only',
      constraints: [
        {
          contextName: 'environment',
          operator: 'str_eq',
          value: 'development',
          caseInsensitive: true,
        },
      ],
    },
    {
      segmentName: 'production-env',
      displayName: 'Production Environment',
      description: 'Prod only',
      constraints: [
        {
          contextName: 'environment',
          operator: 'str_eq',
          value: 'production',
          caseInsensitive: true,
        },
      ],
    },
  ];

  for (const segment of defaultSegments) {
    await db('g_feature_segments').insert({
      id: ulid(),
      segmentName: segment.segmentName,
      displayName: segment.displayName,
      description: segment.description,
      constraints: JSON.stringify(segment.constraints),
      isActive: true,
      tags: '[]',
      createdBy: 1,
    });
  }

  console.log(`  ✓ Added ${defaultSegments.length} segments`);
  await db.destroy();
  console.log('Done!');
}

main().catch(console.error);
