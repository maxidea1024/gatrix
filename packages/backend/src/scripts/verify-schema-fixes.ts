
import db from '../config/knex';
import { RemoteConfigModel } from '../models/RemoteConfig';
import { RemoteConfigSegment } from '../models/RemoteConfigSegment';
import { ulid } from 'ulid';

async function verify() {
    console.log('Starting Schema Verification...');

    try {
        // 1. Service Notice (Test channels/subchannels)
        console.log('Testing ServiceNotice...');

        // Debug: Check columns
        const columns = await db('g_service_notices').columnInfo();
        console.log('g_service_notices columns:', Object.keys(columns));

        // ServiceNoticeService uses raw SQL, so we test schema via knex
        const [noticeId] = await db('g_service_notices').insert({
            environment: 'development',
            isActive: true,
            category: 'notice',
            platforms: JSON.stringify(['pc']),
            channels: JSON.stringify(['steam']),
            subchannels: JSON.stringify(['global']),
            title: 'Test Notice',
            content: 'Content'
        });
        console.log('✓ ServiceNotice created with channels:', noticeId);

        // 2. Coupon Settings (Test inverted flags and basic insert)
        console.log('Testing CouponSettings...');
        const couponId = ulid();
        // CouponService uses raw knex usually, but let's try direct knex insert to mimic service
        await db('g_coupon_settings').insert({
            id: couponId,
            environment: 'development',
            code: 'TEST-' + Date.now(),
            type: 'NORMAL',
            name: 'Test Coupon',
            perUserLimit: 1,
            usageLimitType: 'USER',
            expiresAt: new Date(Date.now() + 100000),
            status: 'ACTIVE',
            targetPlatformsInverted: true,
            targetChannelsInverted: true,
            targetWorldsInverted: true,
            targetUserIdsInverted: true,
            createdBy: 1
        });
        console.log('✓ CouponSetting created:', couponId);

        // 3. Remote Config (Test environment and rules)
        console.log('Testing RemoteConfig...');
        const config = await RemoteConfigModel.create({
            environment: 'development',
            keyName: 'test.config.' + Date.now(),
            valueType: 'string',
            defaultValue: 'value',
            isActive: true,
            createdBy: 1
        });
        console.log('✓ RemoteConfig created:', config.id);

        // Test Remote Config Rules (Segmentation)
        // Direct knex insert since Model might wrap it differently? 
        // Or verify table exists
        await db('g_remote_config_rules').insert({
            configId: config.id,
            ruleName: 'Test Rule',
            conditions: JSON.stringify([{ field: 'country', operator: 'equals', value: 'US' }]),
            value: 'us-value',
            priority: 10,
            isActive: true,
            createdBy: 1
        });
        console.log('✓ RemoteConfig Rule created');

        // 4. Remote Config Segment (Test structure)
        console.log('Testing RemoteConfigSegment...');
        await RemoteConfigSegment.createSegment({
            environment: 'development',
            segmentName: 'test_segment_' + Date.now(),
            displayName: 'Test Segment',
            segmentConditions: {
                operator: 'AND',
                conditions: [{ field: 'level', operator: 'greater_than', value: 10 }]
            },
            isActive: true,
            createdBy: 1
        });
        console.log('✓ RemoteConfigSegment created');

        // 5. Message Template
        console.log('Testing MessageTemplate...');
        const [templateId] = await db('g_message_templates').insert({
            environment: 'development',
            name: 'Test Template',
            type: 'maintenance', // default
            content: 'Template content',
            variables: JSON.stringify(['var1']),
            createdBy: 1
        });
        console.log('✓ MessageTemplate created:', templateId);

        // 6. Account Whitelist
        console.log('Testing AccountWhitelist...');
        await db('g_account_whitelist').insert({
            environment: 'development',
            accountId: 'acc-' + Date.now(),
            isEnabled: true,
            purpose: 'Testing',
            createdBy: 1
        });
        console.log('✓ AccountWhitelist created');

        // 7. Ingame Popup Notice (Test specific columns like showOnce, targetWorldsInverted)
        console.log('Testing IngamePopupNotice...');
        const [popupId] = await db('g_ingame_popup_notices').insert({
            environment: 'development',
            isActive: true,
            content: 'Popup Content',
            targetWorlds: JSON.stringify(['world1']),
            targetWorldsInverted: true,
            targetPlatforms: JSON.stringify(['ios']),
            showOnce: true,
            displayPriority: 50,
            useTemplate: false,
            createdBy: 1
        });
        console.log('✓ IngamePopupNotice created:', popupId);

        // 8. Remote Config Template (Test metadata)
        console.log('Testing RemoteConfigTemplate...');
        const [templateId2] = await db('g_remote_config_templates').insert({
            environment: 'development',
            templateName: 'tpl_key_' + Date.now(),
            displayName: 'Test Template',
            description: 'Template',
            templateType: 'server',
            status: 'draft',
            version: 1,
            templateData: JSON.stringify({ configs: {} }),
            metadata: JSON.stringify({ tag: 'meta' }), // Test metadata column
            createdBy: 1,
            etag: 'test-etag'
        });
        console.log('✓ RemoteConfigTemplate created:', templateId2);

        console.log('ALL CHECKS PASSED');
        process.exit(0);

    } catch (error) {
        console.error('VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

verify();
