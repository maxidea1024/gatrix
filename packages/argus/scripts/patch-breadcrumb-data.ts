/**
 * Patches existing breadcrumbs in ClickHouse to add structured `data` fields
 * to HTTP and navigation breadcrumbs, so the expanded detail panels can be tested.
 *
 * Usage: npx tsx scripts/patch-breadcrumb-data.ts
 */

import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const CH_CONFIG = {
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface BreadcrumbRow {
  event_id: string;
  breadcrumbs: string;
}

const HTTP_ENDPOINTS = [
  { method: 'GET', url: '/api/character/info', durMin: 20, durMax: 150, sizeMin: 512, sizeMax: 4096 },
  { method: 'POST', url: '/api/inventory/move', durMin: 50, durMax: 250, sizeMin: 128, sizeMax: 1024 },
  { method: 'GET', url: '/api/guild/members', durMin: 30, durMax: 200, sizeMin: 2048, sizeMax: 16384 },
  { method: 'PUT', url: '/api/settings/save', durMin: 30, durMax: 120, sizeMin: 64, sizeMax: 512 },
  { method: 'POST', url: '/api/chat/send', durMin: 15, durMax: 80, sizeMin: 64, sizeMax: 256 },
  { method: 'GET', url: '/api/market/listings', durMin: 80, durMax: 400, sizeMin: 4096, sizeMax: 32768 },
  { method: 'POST', url: '/api/trade/confirm', durMin: 100, durMax: 350, sizeMin: 256, sizeMax: 2048 },
  { method: 'DELETE', url: '/api/session/expire', durMin: 8, durMax: 30, sizeMin: 0, sizeMax: 64 },
  { method: 'GET', url: '/api/leaderboard/top', durMin: 150, durMax: 600, sizeMin: 8192, sizeMax: 65536 },
  { method: 'POST', url: '/api/pvp/queue', durMin: 30, durMax: 150, sizeMin: 128, sizeMax: 512 },
];

const NAV_PAGES = [
  { from: '/game/world', to: '/game/inventory' },
  { from: '/game/inventory', to: '/game/guild' },
  { from: '/game/guild', to: '/game/market' },
  { from: '/game/market', to: '/game/pvp' },
  { from: '/game/settings', to: '/game/character' },
  { from: '/game/quest', to: '/game/map' },
];

function parseHttpMessage(msg: string): { method: string; url: string; status: number; duration: number } | null {
  // "GET /api/character/info → 200 (45ms)" or "POST /api/inventory/move → 200 (120ms)"
  const m = msg.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s*→\s*(\d+)\s*\((\d+)ms\)/);
  if (m) {
    return { method: m[1], url: m[2], status: parseInt(m[3]), duration: parseInt(m[4]) };
  }
  // Also handle fetch format: "fetch /api/world/state → 200"
  const f = msg.match(/^fetch\s+(\S+)\s*→\s*(\d+)/);
  if (f) {
    return { method: 'GET', url: f[1], status: parseInt(f[2]), duration: randomInt(20, 200) };
  }
  return null;
}

function parseNavigationMessage(msg: string): { to: string } | null {
  const m = msg.match(/^Navigated to\s+(\S+)/);
  if (m) return { to: m[1] };
  return null;
}

async function main() {
  const client = createClient(CH_CONFIG);
  console.log('🔧 Patching breadcrumb data fields...\n');

  // Get all events with breadcrumbs
  const result = await client.query({
    query: `SELECT event_id, breadcrumbs FROM ${CH_CONFIG.database}.errors WHERE breadcrumbs != '[]' AND breadcrumbs != '' LIMIT 5000`,
    format: 'JSONEachRow',
  });

  const rows = await result.json() as BreadcrumbRow[];
  console.log(`📦 Found ${rows.length} events with breadcrumbs`);

  let patched = 0;
  let httpPatched = 0;
  let navPatched = 0;

  const updates: { event_id: string; breadcrumbs: string }[] = [];

  for (const row of rows) {
    let breadcrumbs: any[];
    try {
      breadcrumbs = JSON.parse(row.breadcrumbs);
    } catch { continue; }

    let changed = false;

    for (const bc of breadcrumbs) {
      // Patch HTTP breadcrumbs
      if ((bc.type === 'http' || bc.category === 'http' || bc.category === 'fetch' || bc.category === 'xhr') && !bc.data) {
        const parsed = parseHttpMessage(bc.message || '');
        if (parsed) {
          const ep = HTTP_ENDPOINTS.find(e => bc.message?.includes(e.url)) || HTTP_ENDPOINTS[0];
          bc.data = {
            method: parsed.method,
            url: `https://game.unchartedwaters.io${parsed.url}`,
            status_code: parsed.status,
            duration: parsed.duration,
            response_body_size: randomInt(ep.sizeMin, ep.sizeMax),
            ...(parsed.status >= 400 ? {
              reason: parsed.status === 429 ? 'Too Many Requests' : parsed.status === 500 ? 'Internal Server Error' : parsed.status === 404 ? 'Not Found' : 'Bad Request'
            } : {}),
          };
          changed = true;
          httpPatched++;
        }
      }

      // Patch navigation breadcrumbs
      if ((bc.category === 'navigation' || bc.type === 'navigation') && !bc.data) {
        const parsed = parseNavigationMessage(bc.message || '');
        if (parsed) {
          const nav = NAV_PAGES.find(n => n.to === parsed.to) || { from: '/game/world', to: parsed.to };
          bc.data = { from: nav.from, to: parsed.to };
          changed = true;
          navPatched++;
        }
      }
    }

    if (changed) {
      updates.push({ event_id: row.event_id, breadcrumbs: JSON.stringify(breadcrumbs) });
      patched++;
    }
  }

  if (updates.length === 0) {
    console.log('✅ No breadcrumbs needed patching');
    await client.close();
    return;
  }

  console.log(`\n📝 Patching ${patched} events (${httpPatched} HTTP, ${navPatched} navigation)...`);

  // ClickHouse ALTER UPDATE for MergeTree
  let done = 0;
  for (const upd of updates) {
    // ClickHouse escapes single quotes by doubling them
    const escaped = upd.breadcrumbs.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    try {
      await client.command({
        query: `ALTER TABLE ${CH_CONFIG.database}.errors UPDATE breadcrumbs = '${escaped}' WHERE event_id = '${upd.event_id}'`,
      });
      done++;
      if (done % 100 === 0) console.log(`   ... ${done}/${updates.length}`);
    } catch (e: any) {
      console.error(`   ✗ Failed event_id=${upd.event_id}: ${e.message?.substring(0, 100)}`);
    }
  }

  console.log(`✅ Done! Patched ${patched} events`);
  console.log(`   HTTP breadcrumbs with data: ${httpPatched}`);
  console.log(`   Navigation breadcrumbs with data: ${navPatched}`);

  await client.close();
}

main().catch(console.error);
