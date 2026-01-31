/**
 * Migration 031: Add default segments for online games
 * 
 * Creates commonly used segments for online game feature flag targeting.
 * All contextName values match the context fields from migration 030.
 * 
 * IMPORTANT: Operators must use lowercase format: str_eq, str_in, num_gt, etc.
 */

const { ulid } = require('ulid');

exports.name = 'add_default_segments';

exports.up = async function (connection) {
    console.log('Adding default segments for online games...');

    // Clear existing segments
    await connection.execute('DELETE FROM g_feature_flag_segments');
    await connection.execute('DELETE FROM g_feature_segments');
    console.log('  ✓ Cleared existing segments');

    const defaultSegments = [
        // ==================== User Role Segments ====================
        {
            segmentName: 'admins',
            displayName: 'Administrators',
            description: 'Users with admin role',
            constraints: [
                { contextName: 'role', operator: 'str_eq', value: 'admin' }
            ],
        },
        {
            segmentName: 'gm-staff',
            displayName: 'GM & Moderators',
            description: 'Game masters and moderators',
            constraints: [
                { contextName: 'role', operator: 'str_in', values: ['admin', 'gm', 'moderator'] }
            ],
        },
        {
            segmentName: 'internal-testers',
            displayName: 'Internal Testers',
            description: 'Internal QA and test accounts (beta + staff role)',
            constraints: [
                { contextName: 'isBeta', operator: 'bool_is', value: 'true' },
                { contextName: 'role', operator: 'str_in', values: ['admin', 'gm', 'tester'] }
            ],
        },

        // ==================== Beta & Early Access ====================
        {
            segmentName: 'beta-testers',
            displayName: 'Beta Testers',
            description: 'Users enrolled in beta testing program',
            constraints: [
                { contextName: 'isBeta', operator: 'bool_is', value: 'true' }
            ],
        },

        // ==================== VIP & Premium ====================
        {
            segmentName: 'vip-users',
            displayName: 'VIP Users',
            description: 'Users with VIP or premium role',
            constraints: [
                { contextName: 'role', operator: 'str_in', values: ['vip', 'premium'] }
            ],
        },
        {
            segmentName: 'premium-subscribers',
            displayName: 'Premium Subscribers',
            description: 'Active premium subscription holders',
            constraints: [
                { contextName: 'isPremium', operator: 'bool_is', value: 'true' }
            ],
        },
        {
            segmentName: 'high-vip-tier',
            displayName: 'High VIP Tier',
            description: 'VIP tier 5 or higher',
            constraints: [
                { contextName: 'vipTier', operator: 'num_gte', value: '5' }
            ],
        },

        // ==================== Payment Tiers ====================
        {
            segmentName: 'paying-users',
            displayName: 'Paying Users',
            description: 'Users who have made at least one purchase',
            constraints: [
                { contextName: 'purchaseCount', operator: 'num_gt', value: '0' }
            ],
        },
        {
            segmentName: 'whales',
            displayName: 'Whales',
            description: 'High-spending users (whale/kraken tier)',
            constraints: [
                { contextName: 'paymentTier', operator: 'str_in', values: ['whale', 'kraken'] }
            ],
        },
        {
            segmentName: 'free-users',
            displayName: 'Free Users',
            description: 'Users who have never made a purchase',
            constraints: [
                { contextName: 'purchaseCount', operator: 'num_eq', value: '0' }
            ],
        },

        // ==================== User Lifecycle ====================
        {
            segmentName: 'new-users',
            displayName: 'New Users',
            description: 'Users registered within last 7 days',
            constraints: [
                { contextName: 'accountAge', operator: 'num_lte', value: '7' }
            ],
        },
        {
            segmentName: 'established-users',
            displayName: 'Established Users',
            description: 'Users registered more than 30 days ago',
            constraints: [
                { contextName: 'accountAge', operator: 'num_gt', value: '30' }
            ],
        },
        {
            segmentName: 'veteran-users',
            displayName: 'Veteran Users',
            description: 'Users with over 100 hours of playtime',
            constraints: [
                { contextName: 'totalPlayTime', operator: 'num_gt', value: '100' }
            ],
        },

        // ==================== Platform Segments ====================
        {
            segmentName: 'pc-users',
            displayName: 'PC Users',
            description: 'Users on PC platform',
            constraints: [
                { contextName: 'platform', operator: 'str_eq', value: 'pc' }
            ],
        },
        {
            segmentName: 'mobile-users',
            displayName: 'Mobile Users',
            description: 'Users on mobile platform',
            constraints: [
                { contextName: 'platform', operator: 'str_eq', value: 'mobile' }
            ],
        },
        {
            segmentName: 'console-users',
            displayName: 'Console Users',
            description: 'Users on console platform',
            constraints: [
                { contextName: 'platform', operator: 'str_eq', value: 'console' }
            ],
        },

        // ==================== Store Segments ====================
        {
            segmentName: 'steam-users',
            displayName: 'Steam Users',
            description: 'Users from Steam store',
            constraints: [
                { contextName: 'store', operator: 'str_eq', value: 'steam' }
            ],
        },
        {
            segmentName: 'sdo-users',
            displayName: 'SDO Users',
            description: 'Users from SDO (China) store',
            constraints: [
                { contextName: 'store', operator: 'str_eq', value: 'sdo' }
            ],
        },
        {
            segmentName: 'appstore-users',
            displayName: 'App Store Users',
            description: 'Users from Apple App Store',
            constraints: [
                { contextName: 'store', operator: 'str_eq', value: 'appstore' }
            ],
        },
        {
            segmentName: 'playstore-users',
            displayName: 'Play Store Users',
            description: 'Users from Google Play Store',
            constraints: [
                { contextName: 'store', operator: 'str_eq', value: 'playstore' }
            ],
        },

        // ==================== Region Segments ====================
        {
            segmentName: 'korea-users',
            displayName: 'Korea Users',
            description: 'Users in Korean region',
            constraints: [
                { contextName: 'countryCode', operator: 'str_eq', value: 'KR' }
            ],
        },
        {
            segmentName: 'china-users',
            displayName: 'China Users',
            description: 'Users in Chinese region',
            constraints: [
                { contextName: 'countryCode', operator: 'str_in', values: ['CN', 'TW'] }
            ],
        },
        {
            segmentName: 'japan-users',
            displayName: 'Japan Users',
            description: 'Users in Japanese region',
            constraints: [
                { contextName: 'countryCode', operator: 'str_eq', value: 'JP' }
            ],
        },
        {
            segmentName: 'asia-users',
            displayName: 'Asia Users',
            description: 'Users in Asian server regions',
            constraints: [
                { contextName: 'serverRegion', operator: 'str_in', values: ['kr', 'jp', 'cn', 'tw', 'sea'] }
            ],
        },
        {
            segmentName: 'western-users',
            displayName: 'Western Users',
            description: 'Users in US/EU server regions',
            constraints: [
                { contextName: 'serverRegion', operator: 'str_in', values: ['us', 'eu', 'sa', 'oce'] }
            ],
        },

        // ==================== Environment Segments ====================
        {
            segmentName: 'development-env',
            displayName: 'Development Environment',
            description: 'Development environment only',
            constraints: [
                { contextName: 'environment', operator: 'str_eq', value: 'development' }
            ],
        },
        {
            segmentName: 'staging-env',
            displayName: 'Staging Environment',
            description: 'Staging environment only',
            constraints: [
                { contextName: 'environment', operator: 'str_eq', value: 'staging' }
            ],
        },
        {
            segmentName: 'production-env',
            displayName: 'Production Environment',
            description: 'Production environment only',
            constraints: [
                { contextName: 'environment', operator: 'str_eq', value: 'production' }
            ],
        },

        // ==================== A/B Test Groups ====================
        {
            segmentName: 'ab-control-group',
            displayName: 'A/B Control Group',
            description: 'Control group for A/B tests',
            constraints: [
                { contextName: 'abGroup', operator: 'str_eq', value: 'control' }
            ],
        },
        {
            segmentName: 'ab-experiment-group',
            displayName: 'A/B Experiment Group',
            description: 'Experiment groups for A/B tests (A-E)',
            constraints: [
                { contextName: 'abGroup', operator: 'str_in', values: ['A', 'B', 'C', 'D', 'E'] }
            ],
        },

        // ==================== Device Segments ====================
        {
            segmentName: 'windows-users',
            displayName: 'Windows Users',
            description: 'Users on Windows devices',
            constraints: [
                { contextName: 'deviceType', operator: 'str_eq', value: 'windows' }
            ],
        },
        {
            segmentName: 'ios-users',
            displayName: 'iOS Users',
            description: 'Users on iOS devices',
            constraints: [
                { contextName: 'deviceType', operator: 'str_eq', value: 'ios' }
            ],
        },
        {
            segmentName: 'android-users',
            displayName: 'Android Users',
            description: 'Users on Android devices',
            constraints: [
                { contextName: 'deviceType', operator: 'str_eq', value: 'android' }
            ],
        },
    ];

    for (const segment of defaultSegments) {
        const segmentId = ulid();
        // Add caseInsensitive: true to all string constraints by default
        const constraintsWithDefaults = segment.constraints.map(c => {
            if (c.operator.startsWith('str_')) {
                return { ...c, caseInsensitive: true };
            }
            return c;
        });
        await connection.execute(
            `INSERT INTO g_feature_segments (id, segmentName, displayName, description, constraints, isActive, tags, createdBy)
             VALUES (?, ?, ?, ?, ?, TRUE, '[]', 1)`,
            [
                segmentId,
                segment.segmentName,
                segment.displayName,
                segment.description,
                JSON.stringify(constraintsWithDefaults),
            ]
        );
    }

    console.log(`  ✓ Added ${defaultSegments.length} default segments`);
    console.log('Default segments added!');
};

exports.down = async function (connection) {
    console.log('Removing default segments...');

    // Just clear all segments added by this migration
    await connection.execute('DELETE FROM g_feature_segments WHERE segmentName IN (' +
        "'admins', 'gm-staff', 'internal-testers', 'beta-testers', " +
        "'vip-users', 'premium-subscribers', 'high-vip-tier', " +
        "'paying-users', 'whales', 'free-users', " +
        "'new-users', 'established-users', 'veteran-users', " +
        "'pc-users', 'mobile-users', 'console-users', " +
        "'steam-users', 'sdo-users', 'appstore-users', 'playstore-users', " +
        "'korea-users', 'china-users', 'japan-users', 'asia-users', 'western-users', " +
        "'development-env', 'staging-env', 'production-env', " +
        "'ab-control-group', 'ab-experiment-group', " +
        "'windows-users', 'ios-users', 'android-users'" +
        ')');

    console.log('Default segments removed.');
};
