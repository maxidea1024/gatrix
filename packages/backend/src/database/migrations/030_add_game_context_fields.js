/**
 * Migration 030: Reset and add comprehensive context fields
 * 
 * Clears all existing context fields and creates a well-organized set
 * with proper legalValues for online game feature flag targeting.
 */

const { ulid } = require('ulid');

exports.name = 'reset_context_fields';

exports.up = async function (connection) {
    console.log('Resetting context fields to a clean state...');

    // Clear all existing context fields
    await connection.execute('DELETE FROM g_feature_context_fields');
    console.log('  ✓ Cleared existing context fields');

    const contextFields = [
        // ==================== Core Identity Fields ====================
        {
            fieldName: 'userId',
            fieldType: 'string',
            description: 'Unique user identifier (accountId, memberId)',
            legalValues: null,
            stickiness: true,
            sortOrder: 1
        },
        {
            fieldName: 'sessionId',
            fieldType: 'string',
            description: 'Session identifier',
            legalValues: null,
            stickiness: true,
            sortOrder: 2
        },
        {
            fieldName: 'deviceId',
            fieldType: 'string',
            description: 'Device unique identifier',
            legalValues: null,
            stickiness: true,
            sortOrder: 3
        },

        // ==================== Environment & Region ====================
        {
            fieldName: 'environment',
            fieldType: 'string',
            description: 'Deployment environment',
            legalValues: ['development', 'staging', 'production', 'test', 'local'],
            stickiness: false,
            sortOrder: 10
        },
        {
            fieldName: 'serverRegion',
            fieldType: 'string',
            description: 'Server region',
            legalValues: ['kr', 'us', 'eu', 'jp', 'cn', 'tw', 'sea', 'sa', 'oce', 'global'],
            stickiness: false,
            sortOrder: 11
        },
        {
            fieldName: 'worldId',
            fieldType: 'string',
            description: 'Game world/server ID',
            legalValues: null,
            stickiness: false,
            sortOrder: 12
        },
        {
            fieldName: 'countryCode',
            fieldType: 'string',
            description: 'Country code (ISO 3166-1 alpha-2)',
            legalValues: ['KR', 'US', 'JP', 'CN', 'TW', 'DE', 'FR', 'GB', 'ES', 'BR', 'RU', 'VN', 'TH', 'ID', 'PH', 'MY', 'SG', 'AU', 'NZ', 'CA'],
            stickiness: false,
            sortOrder: 13
        },
        {
            fieldName: 'locale',
            fieldType: 'string',
            description: 'User locale (BCP 47)',
            legalValues: ['ko-KR', 'en-US', 'ja-JP', 'zh-CN', 'zh-TW', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR', 'ru-RU', 'vi-VN', 'th-TH'],
            stickiness: false,
            sortOrder: 14
        },

        // ==================== User Role & Status ====================
        {
            fieldName: 'role',
            fieldType: 'string',
            description: 'User role',
            legalValues: ['admin', 'gm', 'moderator', 'vip', 'premium', 'user', 'guest', 'tester'],
            stickiness: false,
            sortOrder: 20
        },
        {
            fieldName: 'accountStatus',
            fieldType: 'string',
            description: 'Account status',
            legalValues: ['active', 'inactive', 'suspended', 'banned', 'pending', 'deleted'],
            stickiness: false,
            sortOrder: 21
        },
        {
            fieldName: 'isBeta',
            fieldType: 'boolean',
            description: 'Beta tester flag',
            legalValues: null,
            stickiness: false,
            sortOrder: 22
        },
        {
            fieldName: 'isPremium',
            fieldType: 'boolean',
            description: 'Premium/subscription status',
            legalValues: null,
            stickiness: false,
            sortOrder: 23
        },

        // ==================== Platform & Device ====================
        {
            fieldName: 'platform',
            fieldType: 'string',
            description: 'Platform type',
            legalValues: ['pc', 'mobile', 'console', 'web'],
            stickiness: false,
            sortOrder: 30
        },
        {
            fieldName: 'deviceType',
            fieldType: 'string',
            description: 'Device/OS type',
            legalValues: ['windows', 'mac', 'linux', 'ios', 'android', 'ps5', 'ps4', 'xbox', 'switch'],
            stickiness: false,
            sortOrder: 31
        },
        {
            fieldName: 'osVersion',
            fieldType: 'string',
            description: 'OS version string',
            legalValues: null,
            stickiness: false,
            sortOrder: 32
        },
        {
            fieldName: 'gpuVendor',
            fieldType: 'string',
            description: 'GPU vendor',
            legalValues: ['nvidia', 'amd', 'intel', 'apple', 'qualcomm', 'arm', 'unknown'],
            stickiness: false,
            sortOrder: 33
        },

        // ==================== Store & Distribution ====================
        {
            fieldName: 'store',
            fieldType: 'string',
            description: 'Store/distribution platform',
            legalValues: ['steam', 'epic', 'gog', 'appstore', 'playstore', 'sdo', 'kakao', 'dmm', 'microsoft', 'direct', 'huawei'],
            stickiness: false,
            sortOrder: 40
        },
        {
            fieldName: 'channelId',
            fieldType: 'string',
            description: 'Distribution channel ID',
            legalValues: null,
            stickiness: false,
            sortOrder: 41
        },

        // ==================== Version Info ====================
        {
            fieldName: 'appVersion',
            fieldType: 'semver',
            description: 'Application/client version',
            legalValues: null,
            stickiness: false,
            sortOrder: 50
        },
        {
            fieldName: 'gameVersion',
            fieldType: 'semver',
            description: 'Game content version',
            legalValues: null,
            stickiness: false,
            sortOrder: 51
        },

        // ==================== Game Progress ====================
        {
            fieldName: 'accountLevel',
            fieldType: 'number',
            description: 'Account level or tier',
            legalValues: null,
            stickiness: false,
            sortOrder: 60
        },
        {
            fieldName: 'characterLevel',
            fieldType: 'number',
            description: 'Character level',
            legalValues: null,
            stickiness: false,
            sortOrder: 61
        },
        {
            fieldName: 'totalPlayTime',
            fieldType: 'number',
            description: 'Total play time in hours',
            legalValues: null,
            stickiness: false,
            sortOrder: 62
        },
        {
            fieldName: 'accountAge',
            fieldType: 'number',
            description: 'Account age in days',
            legalValues: null,
            stickiness: false,
            sortOrder: 63
        },
        {
            fieldName: 'guildId',
            fieldType: 'string',
            description: 'Guild/clan ID',
            legalValues: null,
            stickiness: true,
            sortOrder: 64
        },

        // ==================== Payment & VIP ====================
        {
            fieldName: 'vipTier',
            fieldType: 'number',
            description: 'VIP tier level (0-10)',
            legalValues: null,
            stickiness: false,
            sortOrder: 70
        },
        {
            fieldName: 'purchaseCount',
            fieldType: 'number',
            description: 'Total purchase count',
            legalValues: null,
            stickiness: false,
            sortOrder: 71
        },
        {
            fieldName: 'paymentTier',
            fieldType: 'string',
            description: 'Payment tier based on spending',
            legalValues: ['none', 'minnow', 'dolphin', 'whale', 'kraken'],
            stickiness: false,
            sortOrder: 72
        },

        // ==================== Testing & Experiments ====================
        {
            fieldName: 'abGroup',
            fieldType: 'string',
            description: 'A/B test group assignment',
            legalValues: ['control', 'A', 'B', 'C', 'D', 'E'],
            stickiness: true,
            sortOrder: 80
        },
        {
            fieldName: 'referralCode',
            fieldType: 'string',
            description: 'Referral/invite code',
            legalValues: null,
            stickiness: false,
            sortOrder: 81
        },

        // ==================== Time & Network ====================
        {
            fieldName: 'currentTime',
            fieldType: 'datetime',
            description: 'Current timestamp (ISO 8601)',
            legalValues: null,
            stickiness: false,
            sortOrder: 90
        },
        {
            fieldName: 'lastLoginAt',
            fieldType: 'datetime',
            description: 'Last login timestamp',
            legalValues: null,
            stickiness: false,
            sortOrder: 91
        },
        {
            fieldName: 'ip',
            fieldType: 'string',
            description: 'IP address',
            legalValues: null,
            stickiness: false,
            sortOrder: 92
        },
        {
            fieldName: 'userAgent',
            fieldType: 'string',
            description: 'User agent string',
            legalValues: null,
            stickiness: false,
            sortOrder: 93
        },
    ];

    for (const field of contextFields) {
        await connection.execute(
            `INSERT INTO g_feature_context_fields (id, fieldName, fieldType, description, legalValues, stickiness, sortOrder, isEnabled)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [
                ulid(),
                field.fieldName,
                field.fieldType,
                field.description,
                field.legalValues ? JSON.stringify(field.legalValues) : null,
                field.stickiness,
                field.sortOrder
            ]
        );
    }

    console.log(`  ✓ Added ${contextFields.length} context fields`);
    console.log('Context fields reset complete!');
};

exports.down = async function (connection) {
    console.log('Rolling back: restoring original context fields...');

    // This would restore the original fields from migration 021
    // For simplicity, we just clear and let the original migration handle it
    await connection.execute('DELETE FROM g_feature_context_fields');

    console.log('Rollback complete. Run migration 021 to restore original fields.');
};
