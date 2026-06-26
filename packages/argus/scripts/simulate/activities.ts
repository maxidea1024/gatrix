/**
 * Simulate Data — Product Analytics Activities Generator
 *
 * Generates realistic user activity events for Argus Product Analytics pages:
 * - Revenue page: 'purchase' events with amount
 * - Impact page: cause/effect event pairs
 * - Lifecycle page: session/retention patterns
 * - Realtime page: recent events stream
 * - Cohorts page: behavioral segmentation
 */
import { PROJECT_ID, DAYS_BACK, NOW, CH_CONFIG, CHUNK_SIZE } from './config';
import { uuid, randomInt, randomPick, weightedPick, formatDate } from './helpers';
import { USERS, BROWSERS } from './user-pool';

const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  KRW: 0.00077,
  EUR: 1.08,
  JPY: 0.0064,
};

function convertToUsd(amount: number, currency: string): number {
  return amount * (EXCHANGE_RATES_TO_USD[currency.toUpperCase()] || 1.0);
}

// ═══════════════════ ACTIVITY EVENT DEFINITIONS ═══════════════════

export const ACTIVITY_EVENT_DEFS = {
  $session_start: {
    weight: 10,
    props: () => ({
      properties: {
        source: randomPick(['direct', 'launcher', 'shortcut', 'deeplink']),
      },
    }),
  },
  $session_end: {
    weight: 5,
    props: () => ({
      properties: { reason: randomPick(['manual', 'timeout', 'maintenance']) },
      numeric_properties: { session_duration_minutes: randomInt(5, 180) },
    }),
  },
  $page_view: {
    weight: 12,
    props: () => ({
      properties: {
        url: randomPick([
          '/game/play', '/game/port', '/game/battle',
          '/settings', '/inventory', '/guild',
        ]),
      },
    }),
  },
  $click: {
    weight: 15,
    props: () => ({
      properties: {
        target: randomPick([
          'button#play', 'button#shop', 'tab#inventory', 'button#settings',
        ]),
      },
    }),
  },
  $error: {
    weight: 2,
    props: () => ({
      properties: {
        error_type: randomPick(['TypeError', 'ReferenceError', 'NetworkError']),
        message: randomPick([
          'Cannot read properties of undefined',
          'Connection lost',
        ]),
      },
    }),
  },
  $feedback: {
    weight: 1,
    props: () => ({
      properties: {
        satisfaction: randomPick(['5', '4', '3', '2', '1']),
      },
    }),
  },
  user_login: {
    weight: 8,
    props: () => ({
      properties: {
        method: randomPick(['password', 'social', 'sso', 'steam', 'epic']),
      },
    }),
  },
  character_created: {
    weight: 2,
    props: () => ({
      properties: {
        class: randomPick(['warrior', 'mage', 'archer', 'priest', 'assassin']),
        race: randomPick(['human', 'elf', 'dwarf', 'orc']),
      },
      numeric_properties: { creation_time_seconds: randomInt(30, 300) },
    }),
  },
  tutorial_completed: {
    weight: 1,
    props: () => ({
      properties: { tutorial_id: `tut_${randomInt(1, 5)}` },
      numeric_properties: { duration_seconds: randomInt(120, 600) },
    }),
  },
  battle_started: {
    weight: 6,
    props: () => ({
      properties: {
        mode: randomPick(['pve', 'pvp', 'raid', 'dungeon']),
        difficulty: randomPick(['normal', 'hard', 'hell']),
      },
      numeric_properties: { party_size: randomInt(1, 6) },
    }),
  },
  battle_won: {
    weight: 5,
    props: () => ({
      properties: { reward_type: randomPick(['gold', 'item', 'exp']) },
      numeric_properties: {
        duration_seconds: randomInt(60, 900),
        damage_dealt: randomInt(10000, 500000),
      },
    }),
  },
  item_purchased: {
    weight: 6,
    props: () => ({
      properties: {
        item_type: randomPick(['weapon', 'armor', 'potion', 'cosmetic']),
        currency: randomPick(['gold', 'diamond']),
      },
      numeric_properties: {
        price: randomPick([100, 500, 1000, 5000]),
        quantity: randomInt(1, 10),
      },
    }),
  },

  // ── NEW: Revenue page ──
  purchase: {
    weight: 3,
    props: () => {
      const products = [
        { name: 'Premium Battle Pass', price: 9.99 },
        { name: 'Starter Pack', price: 4.99 },
        { name: 'Diamond Bundle (100)', price: 0.99 },
        { name: 'Diamond Bundle (1000)', price: 7.99 },
        { name: 'Diamond Bundle (5000)', price: 29.99 },
        { name: 'Legendary Skin - Dragon Knight', price: 14.99 },
        { name: 'Legendary Skin - Shadow Mage', price: 14.99 },
        { name: 'Season Pass', price: 19.99 },
        { name: 'VIP Membership (Monthly)', price: 4.99 },
        { name: 'Expansion Pack - Frozen Realm', price: 24.99 },
        { name: 'Expansion Pack - Abyssal Depths', price: 24.99 },
        { name: 'Loot Box (x10)', price: 9.99 },
        { name: 'Guild Banner Pack', price: 2.99 },
        { name: 'Name Change Token', price: 1.99 },
        { name: 'Mount - Infernal Steed', price: 19.99 },
      ];
      const product = randomPick(products);
      const currency = randomPick(['USD', 'KRW', 'EUR', 'JPY']);
      let amount = product.price;

      if (currency === 'KRW') {
        amount = Math.round(product.price * 1300 / 100) * 100;
      } else if (currency === 'EUR') {
        amount = parseFloat((product.price * 0.93).toFixed(2));
      } else if (currency === 'JPY') {
        amount = Math.round(product.price * 156 / 10) * 10;
      }

      return {
        properties: {
          product_name: product.name,
          payment_method: randomPick(['credit_card', 'paypal', 'steam_wallet', 'apple_pay', 'google_pay']),
          currency,
        },
        numeric_properties: {
          amount,
          quantity: 1,
        },
      };
    },
  },

  // ── NEW: Lifecycle / Impact ──
  level_up: {
    weight: 4,
    props: () => ({
      properties: {
        class: randomPick(['warrior', 'mage', 'archer', 'priest', 'assassin']),
      },
      numeric_properties: {
        level: randomInt(2, 100),
        time_to_level_minutes: randomInt(30, 600),
      },
    }),
  },

  quest_completed: {
    weight: 4,
    props: () => ({
      properties: {
        quest_id: `quest_${randomInt(1, 200)}`,
        quest_type: randomPick(['main', 'side', 'daily', 'weekly', 'event']),
        difficulty: randomPick(['easy', 'normal', 'hard', 'legendary']),
      },
      numeric_properties: {
        duration_seconds: randomInt(60, 3600),
        exp_reward: randomInt(100, 10000),
      },
    }),
  },

  // ── NEW: Cohorts ──
  guild_joined: {
    weight: 1,
    props: () => ({
      properties: {
        guild_name: randomPick([
          'Dragon Slayers', 'Night Watch', 'Iron Legion',
          'Shadow Council', 'Phoenix Order', 'Storm Riders',
        ]),
        guild_size: String(randomInt(5, 200)),
      },
    }),
  },

  achievement_unlocked: {
    weight: 2,
    props: () => ({
      properties: {
        achievement_id: `ach_${randomInt(1, 100)}`,
        achievement_name: randomPick([
          'First Blood', 'Dragon Slayer', 'Master Crafter',
          'Social Butterfly', 'Speed Runner', 'Completionist',
          'PvP Champion', 'Dungeon Master', 'Treasure Hunter',
        ]),
        rarity: randomPick(['common', 'uncommon', 'rare', 'epic', 'legendary']),
      },
    }),
  },

  // ── NEW: Social / Engagement ──
  chat_message: {
    weight: 3,
    props: () => ({
      properties: {
        channel: randomPick(['global', 'guild', 'party', 'whisper', 'trade']),
      },
    }),
  },

  friend_added: {
    weight: 1,
    props: () => ({
      properties: {
        method: randomPick(['search', 'after_battle', 'guild', 'suggested']),
      },
    }),
  },
  resource_source: {
    weight: 8,
    props: () => {
      const isGold = Math.random() < 0.8;
      const currency = isGold ? 'gold' : 'diamond';
      const source = randomPick(['battle_reward', 'quest_clear', 'daily_login', 'gacha_compensation']);
      const amount = isGold ? randomInt(100, 5000) : randomInt(10, 500);
      return {
        properties: {
          currency_type: currency,
          source_type: source,
        },
        numeric_properties: {
          amount,
        },
      };
    },
  },
  resource_sink: {
    weight: 7,
    props: () => {
      const isGold = Math.random() < 0.8;
      const currency = isGold ? 'gold' : 'diamond';
      const product = randomPick([
        'Health Potion', 'Gacha Scroll', 'Epic Weapon Box',
        'Skill Book Upgrade', 'Revive Token', 'Cosmetic Pack',
      ]);
      const amount = isGold ? randomInt(80, 4000) : randomInt(8, 400);
      return {
        properties: {
          currency_type: currency,
          product_name: product,
        },
        numeric_properties: {
          amount,
        },
      };
    },
  },

  // ── Ad Monetization Events ──
  ad_impression: {
    weight: 12,
    props: () => {
      const adTypes = [
        { type: 'rewarded_video', ecpm: [5, 40] },
        { type: 'interstitial', ecpm: [2, 15] },
        { type: 'banner', ecpm: [0.3, 3] },
      ] as const;
      const adType = weightedPick(
        adTypes.map(a => a),
        [50, 35, 15]
      );
      const placements = adType.type === 'rewarded_video'
        ? ['extra_life', 'double_rewards', 'free_gacha', 'daily_bonus', 'skip_wait']
        : adType.type === 'interstitial'
        ? ['level_complete', 'menu_transition', 'shop_exit', 'game_over']
        : ['bottom_banner', 'top_banner', 'sidebar'];
      const sdks = ['admob', 'applovin', 'unity_ads', 'ironsource', 'meta_audience'];
      // eCPM in USD — divide by 1000 for per-impression revenue
      const ecpm = adType.ecpm[0] + Math.random() * (adType.ecpm[1] - adType.ecpm[0]);
      const revenue = ecpm / 1000; // per-impression revenue

      return {
        properties: {
          ad_type: adType.type,
          ad_placement: randomPick(placements),
          ad_sdk_name: randomPick(sdks),
        },
        numeric_properties: {
          ad_revenue: Math.round(revenue * 10000) / 10000,  // 4 decimal places
          ad_ecpm: Math.round(ecpm * 100) / 100,
          ad_duration_ms: adType.type === 'banner' ? 0 : randomInt(5000, 30000),
        },
      };
    },
  },

  ad_click: {
    weight: 2,
    props: () => {
      const adType = randomPick(['rewarded_video', 'interstitial', 'banner']);
      return {
        properties: {
          ad_type: adType,
          ad_placement: randomPick([
            'extra_life', 'double_rewards', 'level_complete',
            'bottom_banner', 'shop_exit',
          ]),
          ad_sdk_name: randomPick(['admob', 'applovin', 'unity_ads', 'ironsource']),
        },
      };
    },
  },

  // ── Refund Event ──
  refund: {
    weight: 1,
    props: () => {
      const products = [
        { name: 'Premium Battle Pass', price: 9.99 },
        { name: 'Starter Pack', price: 4.99 },
        { name: 'Diamond Bundle (100)', price: 0.99 },
        { name: 'Diamond Bundle (1000)', price: 7.99 },
        { name: 'Diamond Bundle (5000)', price: 29.99 },
        { name: 'Legendary Skin - Dragon Knight', price: 14.99 },
        { name: 'Season Pass', price: 19.99 },
        { name: 'Loot Box (x10)', price: 9.99 },
      ];
      const product = randomPick(products);
      return {
        properties: {
          product_name: product.name,
          refund_reason: randomPick([
            'accidental_purchase',
            'not_as_expected',
            'technical_issue',
            'duplicate_charge',
            'changed_mind',
            'policy_refund',
          ]),
        },
        numeric_properties: {
          amount: product.price,
        },
      };
    },
  },

  // ── Grant (Free Grant) Event ──
  grant: {
    weight: 2,
    props: () => {
      const grants = [
        { reason: 'compensation', amount: [100, 5000] },
        { reason: 'event_reward', amount: [50, 3000] },
        { reason: 'new_user_bonus', amount: [500, 2000] },
        { reason: 'maintenance_apology', amount: [200, 1000] },
        { reason: 'bug_fix_compensation', amount: [300, 5000] },
        { reason: 'promotion', amount: [100, 10000] },
      ] as const;
      const g = randomPick([...grants]);
      return {
        properties: {
          grant_reason: g.reason,
          currency_type: randomPick(['diamond', 'gold']),
        },
        numeric_properties: {
          amount: randomInt(g.amount[0], g.amount[1]),
        },
      };
    },
  },
} as const;

export type ActivityEventName = keyof typeof ACTIVITY_EVENT_DEFS;

// ═══════════════════ ACTIVITIES GENERATOR ═══════════════════

export async function generateAndInsertActivities(ch: any): Promise<number> {
  console.log('\n📊 Generating Product Analytics Activities...');
  
  // Truncate sessions first to keep consistent IDs
  console.log('   🗑️  Truncating sessions table for alignment...');
  try {
    await ch.exec({ query: `TRUNCATE TABLE IF EXISTS ${CH_CONFIG.database}.sessions` });
  } catch {}

  const activeUsers = USERS.slice(0, 3000);
  let activityCount = 0;
  let batchBuffer: any[] = [];
  let sessionsBuffer: any[] = [];

  // Expanded gameplay pool with new events
  const gameplayPool: ActivityEventName[] = [
    '$page_view', '$click', '$error', '$feedback',
    'battle_started', 'battle_won', 'item_purchased',
    'purchase', 'level_up', 'quest_completed',
    'guild_joined', 'achievement_unlocked',
    'chat_message', 'friend_added',
    'resource_source', 'resource_sink',
    'ad_impression', 'ad_click',
    'refund', 'grant',
  ];
  const gameplayWeights = gameplayPool.map(
    (n) => ACTIVITY_EVENT_DEFS[n].weight
  );

  for (let i = 0; i < activeUsers.length; i++) {
    const user = activeUsers[i];
    const joinDay = randomInt(0, DAYS_BACK - 1);
    const retentionClass = weightedPick(
      ['churned', 'casual', 'regular', 'core'] as const,
      [30, 35, 25, 10]
    );

    let activeDays: number;
    switch (retentionClass) {
      case 'churned': activeDays = randomInt(1, 2); break;
      case 'casual': activeDays = randomInt(3, 6); break;
      case 'regular': activeDays = randomInt(7, 11); break;
      case 'core': activeDays = DAYS_BACK - joinDay; break;
    }

    const daysToPlay = new Set<number>();
    daysToPlay.add(joinDay);
    for (let d = 1; d < activeDays; d++) {
      const day = joinDay + randomInt(1, Math.min(activeDays + 2, DAYS_BACK - joinDay - 1));
      if (day < DAYS_BACK) daysToPlay.add(day);
    }

    const sortedDays = [...daysToPlay].sort((a, b) => a - b);
    let isFirstSession = true;

    for (const day of sortedDays) {
      const sessionsToday = retentionClass === 'core' ? randomInt(2, 4) : randomInt(1, 2);

      for (let s = 0; s < sessionsToday; s++) {
        const sessionId = uuid();
        const dayStart = new Date(NOW.getTime() - (DAYS_BACK - day) * 86400000);
        dayStart.setUTCHours(randomInt(9, 18), randomInt(0, 59), randomInt(0, 59));
        let ts = dayStart.getTime();

        const hasUtm = Math.random() < 0.65;
        const utmSource = hasUtm ? randomPick(['google', 'facebook', 'unity', 'naver', 'youtube']) : null;
        const utmMedium = hasUtm ? randomPick(['cpc', 'cpa', 'social', 'display', 'organic']) : null;
        const utmCampaign = hasUtm ? randomPick(['summer_sale_2026', 'brand_awareness', 'pre_registration', 're_engagement']) : null;
        const utmTerm = hasUtm && Math.random() < 0.5 ? randomPick(['best_rpg_game', 'free_to_play', 'strategy_rpg']) : null;
        const utmContent = hasUtm && Math.random() < 0.5 ? randomPick(['banner_a', 'video_ad_30s', 'text_ad_v2', 'main_banner']) : null;

        sessionsBuffer.push({
          session_id: sessionId,
          project_id: PROJECT_ID,
          timestamp: formatDate(new Date(ts)),
          started: formatDate(new Date(ts)),
          duration: randomInt(60, 7200),
          status: randomPick(['exited', 'exited', 'exited', 'crashed', 'abnormal']),
          errors: Math.random() < 0.15 ? randomInt(1, 5) : 0,
          environment: randomPick(['production', 'staging']),
          release: randomPick(['1.14.0', '1.13.2']),
          distinct_id: user.id,
          user_agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`,
          os_name: randomPick(['Windows', 'macOS', 'iOS']),
          os_version: '10',
          ip_address: user.ip || '127.0.0.1',
          country_code: user.country || 'US',
          dsn_key_id: 0,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_term: utmTerm,
          utm_content: utmContent,
        });

        const sessionEvents: ActivityEventName[] = [];
        sessionEvents.push('$session_start', 'user_login');

        if (isFirstSession) {
          sessionEvents.push('character_created');
          if (Math.random() < 0.7) sessionEvents.push('tutorial_completed');
          isFirstSession = false;
        }

        // More events per session for richer data
        const numGameplay = retentionClass === 'core' ? randomInt(8, 18) : randomInt(3, 9);
        for (let g = 0; g < numGameplay; g++) {
          sessionEvents.push(weightedPick(gameplayPool, gameplayWeights));
        }

        if (Math.random() < 0.9) sessionEvents.push('$session_end');

        for (const eventName of sessionEvents) {
          ts += randomInt(2000, 60000);
          const generated = ACTIVITY_EVENT_DEFS[eventName].props();
          const rawCurrency = (generated as any).properties?.currency || 'USD';
          const rawAmount = (generated as any).numeric_properties?.amount || 0;
          let amountUsd = 0;
          if (eventName === 'purchase' || eventName === 'item_purchased') {
            amountUsd = convertToUsd(rawAmount, rawCurrency);
          }

          batchBuffer.push({
            event_id: uuid(),
            project_id: PROJECT_ID,
            timestamp: new Date(ts).toISOString().replace('T', ' ').replace('Z', ''),
            event_name: eventName,
            user_id: user.id,
            device_id: `device_${user.id}`,
            session_id: sessionId,
            platform: randomPick(['Steam', 'PlayStation', 'iOS']),
            environment: randomPick(['production', 'staging']),
            release: randomPick(['1.14.0', '1.13.2']),
            country: user.country,
            city: user.city,
            os: randomPick(['Windows 11', 'macOS 14', 'iOS 17']),
            app_version: randomPick(['1.14.0-b201', '1.13.2-b195']),
            properties: {
              ...((generated as any).properties || {}),
              ...(user.avatarUrl ? { avatar_url: user.avatarUrl } : {}),
              email: user.email,
              browser: (() => { const b = weightedPick(BROWSERS.map(b => b.name), BROWSERS.map(b => b.w)); return b; })(),
            },
            numeric_properties: (generated as any).numeric_properties || {},
            dsn_key_id: 0,
            currency: rawCurrency,
            amount_usd: amountUsd,
          });
        }
      }
    }

    if (batchBuffer.length >= CHUNK_SIZE) {
      await ch.insert({
        table: `${CH_CONFIG.database}.activities`,
        values: batchBuffer,
        format: 'JSONEachRow',
      });
      if (sessionsBuffer.length > 0) {
        await ch.insert({
          table: `${CH_CONFIG.database}.sessions`,
          values: sessionsBuffer,
          format: 'JSONEachRow',
        });
        sessionsBuffer = [];
      }
      activityCount += batchBuffer.length;
      process.stdout.write(`\r   ⏳ ${activityCount.toLocaleString()} activities...`);
      batchBuffer = [];
    }
  }

  if (batchBuffer.length > 0) {
    await ch.insert({
      table: `${CH_CONFIG.database}.activities`,
      values: batchBuffer,
      format: 'JSONEachRow',
    });
    activityCount += batchBuffer.length;
  }

  if (sessionsBuffer.length > 0) {
    await ch.insert({
      table: `${CH_CONFIG.database}.sessions`,
      values: sessionsBuffer,
      format: 'JSONEachRow',
    });
  }

  // ── REALTIME: Generate ~500 events in the last 30 minutes ──
  console.log('\n   ⏳ Generating realtime events (last 30 min)...');
  const realtimeBatch: any[] = [];
  const realtimeSessions: any[] = [];
  const now = Date.now();
  const thirtyMinAgo = now - 30 * 60 * 1000;
  const realtimeUsers = activeUsers.slice(0, 200);

  for (let i = 0; i < 500; i++) {
    const user = randomPick(realtimeUsers);
    const eventName = weightedPick(gameplayPool, gameplayWeights);
    const generated = ACTIVITY_EVENT_DEFS[eventName].props();
    const ts = thirtyMinAgo + Math.random() * (now - thirtyMinAgo);
    const rawCurrency = (generated as any).properties?.currency || 'USD';
    const rawAmount = (generated as any).numeric_properties?.amount || 0;
    let amountUsd = 0;
    if (eventName === 'purchase' || eventName === 'item_purchased') {
      amountUsd = convertToUsd(rawAmount, rawCurrency);
    }
    const sessionId = uuid();

    realtimeSessions.push({
      session_id: sessionId,
      project_id: PROJECT_ID,
      timestamp: formatDate(new Date(ts)),
      started: formatDate(new Date(ts)),
      duration: randomInt(60, 7200),
      status: 'exited',
      errors: 0,
      environment: 'production',
      release: '1.14.0',
      distinct_id: user.id,
      user_agent: 'Chrome',
      os_name: 'Windows',
      os_version: '10',
      ip_address: user.ip || '127.0.0.1',
      country_code: user.country || 'US',
      dsn_key_id: 0,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
    });

    realtimeBatch.push({
      event_id: uuid(),
      project_id: PROJECT_ID,
      timestamp: new Date(ts).toISOString().replace('T', ' ').replace('Z', ''),
      event_name: eventName,
      user_id: user.id,
      device_id: `device_${user.id}`,
      session_id: sessionId,
      platform: randomPick(['Steam', 'PlayStation', 'iOS']),
      environment: 'production',
      release: '1.14.0',
      country: user.country,
      city: user.city,
      os: randomPick(['Windows 11', 'macOS 14', 'iOS 17']),
      app_version: '1.14.0-b201',
      properties: {
        ...((generated as any).properties || {}),
        ...(user.avatarUrl ? { avatar_url: user.avatarUrl } : {}),
        email: user.email,
        browser: weightedPick(BROWSERS.map(b => b.name), BROWSERS.map(b => b.w)),
      },
      numeric_properties: (generated as any).numeric_properties || {},
      dsn_key_id: 0,
      currency: rawCurrency,
      amount_usd: amountUsd,
    });
  }

  if (realtimeBatch.length > 0) {
    await ch.insert({
      table: `${CH_CONFIG.database}.activities`,
      values: realtimeBatch,
      format: 'JSONEachRow',
    });
    activityCount += realtimeBatch.length;
  }
  if (realtimeSessions.length > 0) {
    await ch.insert({
      table: `${CH_CONFIG.database}.sessions`,
      values: realtimeSessions,
      format: 'JSONEachRow',
    });
  }

  console.log(`   ✓ ${activityCount.toLocaleString()} activities inserted (incl. ${realtimeBatch.length} realtime)`);
  return activityCount;
}
