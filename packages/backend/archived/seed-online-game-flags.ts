import { ulid } from 'ulid';
import database from '../src/config/database';
import logger from '../src/config/logger';

async function seedGameFlags() {
    try {
        logger.info('Starting game feature flags seeding...');

        // Get admin user ID
        const admins = await database.query('SELECT id FROM g_users WHERE role = "admin" LIMIT 1');
        if (admins.length === 0) {
            logger.error('No admin user found. Please run main seed first.');
            process.exit(1);
        }
        const adminId = admins[0].id;

        const environments = ['development', 'staging', 'production'];

        const flags = [
            { name: 'auto_battle_enabled', desc: 'Enable auto-battle feature for mobile players', type: 'release' },
            { name: 'new_world_boss_raid', desc: 'Active world boss raid event in the main plaza', type: 'release' },
            { name: 'mount_system_v2', desc: 'Upgraded mount system with better physics and animations', type: 'release' },
            { name: 'guild_war_season_1', desc: 'First season of competitive guild vs guild combat', type: 'release' },
            { name: 'stamina_recharge_buff', desc: 'Temporary 50% increase in stamina recovery speed', type: 'operational' },
            { name: 'double_exp_event', desc: 'System-wide 2x experience gain for all players', type: 'operational' },
            { name: 'new_player_welcome_gift', desc: 'Special welcome package for accounts less than 7 days old', type: 'release' },
            { name: 'inventory_expansion_slot_5', desc: 'Additional inventory slots available via questing', type: 'release' },
            { name: 'rare_item_drop_rate_boost', desc: 'Increase drop rate of Epic and Legendary items by 5%', type: 'operational' },
            { name: 'pvp_arena_ranking_system', desc: 'Competitive ranking system for 3v3 arena matches', type: 'release' },
            { name: 'marketplace_tax_reduction', desc: 'Weekend event: 0% tax on player-to-player market trades', type: 'operational' },
            { name: 'crafting_success_rate_up', desc: 'Temporary boost to high-tier crafting success rates', type: 'operational' },
            { name: 'pet_evolution_system', desc: 'Allow tier-3 pets to evolve into celestial forms', type: 'release' },
            { name: 'seasonal_battle_pass', desc: 'Winter season battle pass rewards and progression', type: 'release' },
            { name: 'daily_login_milestone', desc: 'Special bonus every 30 consecutive login days', type: 'release' },
            { name: 'referral_program_active', desc: 'Invite friends to earn unique titles and currency', type: 'release' },
            { name: 'chat_filter_v3', desc: 'Advanced AI-powered chat filtering for toxicity', type: 'operational' },
            { name: 'voice_chat_proximity', desc: 'Experimental 3D proximity-based voice chat', type: 'experiment' },
            { name: 'low_latency_server_mesh', desc: 'Optimized server-to-server communication for better latency', type: 'operational' },
            { name: 'cross_platform_play_v1', desc: 'Allow PC and Mobile players to play together', type: 'release' },
            { name: 'flash_sale_notifier', desc: 'Push notifications for limited-time shop deals', type: 'release' },
            { name: 'gacha_pity_counter_visible', desc: 'Show exact pulls remaining until guaranteed SSR', type: 'release' },
            { name: 'mythic_gear_reforge', desc: 'Advanced reforging system for end-game gear', type: 'release' },
            { name: 'sky_island_expansion', desc: 'Open access to the floating sky island continent', type: 'release' },
            { name: 'undersea_temple_dungeon', desc: 'New 10-player raid dungeon: Undersea Temple', type: 'release' },
            { name: 'emotes_pack_limited', desc: 'Special edition animated emotes in the shop', type: 'release' },
            { name: 'housing_system_preview', desc: 'Preview mode for upcoming player housing feature', type: 'experiment' },
            { name: 'wedding_system_renew', desc: 'Revamped wedding ceremonies with better cinematics', type: 'release' },
            { name: 'mentor_mentee_rewards', desc: 'Special rewards for high-level players helping newbies', type: 'release' },
            { name: 'achievement_title_colors', desc: 'Allow choosing colors for prestiged achievement titles', type: 'release' },
            { name: 'minimap_fog_of_war_fix', desc: 'New optimized rendering for fog of war', type: 'operational' },
            { name: 'optimized_asset_loading', desc: 'Background streaming for UI assets to reduce load times', type: 'operational' },
            { name: 'secure_trade_v2', desc: 'Enhanced security layers for player item trading', type: 'operational' },
            { name: 'anti_cheat_v5_active', desc: 'Latest heuristics for detecting speedhacks and bots', type: 'permission' },
            { name: 'maintenance_compensation_active', desc: 'Automatically grant items when servers are down longer than scheduled', type: 'operational' },
            { name: 'localized_voiceovers_ja', desc: 'Full Japanese voice acting for the main storyline', type: 'release' },
            { name: 'skill_tree_reset_event', desc: 'Free skill resets for one week after balance patch', type: 'operational' },
            { name: 'infinite_tower_floor_200', desc: 'Unlock new challenge floors up to 200', type: 'release' },
            { name: 'party_finder_auto_match', desc: 'One-click matchmaking for small dungeons', type: 'release' },
            { name: 'spectator_mode_enabled', desc: 'Allow watching public high-rank PVP matches', type: 'release' },
            { name: 'replay_system_beta', desc: 'Record and playback past matches for analysis', type: 'experiment' },
            { name: 'streaming_mode_privacy', desc: 'Hide names and UIDs for content creators', type: 'release' },
            { name: 'haptic_feedback_mobile', desc: 'HD vibration support for iOS/Android controllers', type: 'release' },
            { name: 'dynamic_weather_effects', desc: 'Rain and snow affecting movement speed in open world', type: 'experiment' },
            { name: 'npc_affinity_system', desc: 'Deep reputation system with town NPCs', type: 'release' },
            { name: 'costume_dyeing_advanced', desc: 'RGB color picker for specific costume parts', type: 'release' },
            { name: 'bank_interest_weekly', desc: 'Passive gold generation for high-tier guild banks', type: 'release' },
            { name: 'auction_house_web_preview', desc: 'Allow browsing auction house via web dashboard', type: 'release' },
            { name: 'sdk_analytics_v2', desc: 'More detailed tracking for player retention events', type: 'operational' },
            { name: 'cdn_edge_caching_images', desc: 'Use edge caching for all world map tile textures', type: 'operational' },
        ];

        for (const flag of flags) {
            // Check if flag already exists
            const existing = await database.query('SELECT id FROM g_feature_flags WHERE flagName = ?', [flag.name]);

            let flagId: string;
            if (existing.length > 0) {
                flagId = existing[0].id;
                logger.info(`Flag ${flag.name} already exists, updating environments...`);
            } else {
                flagId = ulid();
                await database.query(
                    `INSERT INTO g_feature_flags (id, flagName, displayName, description, flagType, createdBy)
           VALUES (?, ?, ?, ?, ?, ?)`,
                    [flagId, flag.name, flag.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), flag.desc, flag.type, adminId]
                );
                logger.info(`Created flag: ${flag.name}`);
            }

            // Add to environments
            for (const env of environments) {
                const envExisting = await database.query(
                    'SELECT id FROM g_feature_flag_environments WHERE flagId = ? AND environment = ?',
                    [flagId, env]
                );

                if (envExisting.length === 0) {
                    // Default: enabled in dev/staging, disabled in production
                    const isEnabled = env !== 'production';
                    await database.query(
                        `INSERT INTO g_feature_flag_environments (id, flagId, environment, isEnabled, createdBy)
             VALUES (?, ?, ?, ?, ?)`,
                        [ulid(), flagId, env, isEnabled, adminId]
                    );
                }
            }
        }

        logger.info('Game feature flags seeding completed successfully!');
    } catch (error) {
        logger.error('Failed to seed game flags:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

seedGameFlags();
