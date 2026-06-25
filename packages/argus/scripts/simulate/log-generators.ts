/**
 * Simulate Data — Contextual Log Message Generators
 */
import { randomInt, randomFloat, randomPick, uuid } from './helpers';
import { ErrorScenario } from './scenarios';
import { GAME_SHARDS } from './dynamic-tags';

export interface LogLine {
  level: string;
  logger: string;
  msg: string;
  body?: string;
}

export function generateContextualLogs(
  scenario: ErrorScenario,
  user: { id: string; ip: string },
  server: string,
  env: string,
  release: string
): LogLine[] {
  const logs: LogLine[] = [];
  const shard = randomPick(GAME_SHARDS);
  const connId = randomInt(10000, 99999);
  const reqId = uuid().substring(0, 12);

  // Runtime-specific pre-error logs
  if (scenario.runtime === 'nodejs') {
    // Common server-side request lifecycle
    if (
      scenario.transaction.startsWith('POST') ||
      scenario.transaction.startsWith('GET')
    ) {
      logs.push({
        level: 'info',
        logger: 'HttpServer',
        msg: `[req:${reqId}] ${scenario.transaction} from ${user.ip} (${server}/${shard})`,
      });
      logs.push({
        level: 'debug',
        logger: 'AuthMiddleware',
        msg: `[req:${reqId}] Token validated for ${user.id} (expires in ${randomInt(300, 7200)}s)`,
      });
    } else if (scenario.transaction.startsWith('WS')) {
      logs.push({
        level: 'debug',
        logger: 'WebSocketServer',
        msg: `[conn:${connId}] Frame received from ${user.id} (${user.ip}), size=${randomInt(64, 4096)}B`,
      });
    } else if (scenario.transaction.startsWith('INTERNAL')) {
      logs.push({
        level: 'debug',
        logger: 'Scheduler',
        msg: `[job:${reqId}] Internal task started: ${scenario.culprit}`,
      });
    }

    // Scenario-specific context
    switch (scenario.id) {
      case 'ws-drop':
        logs.push({
          level: 'info',
          logger: 'NetworkGateway',
          msg: `[conn:${connId}] WebSocket keepalive ping sent to ${user.id}`,
        });
        logs.push({
          level: 'warn',
          logger: 'NetworkGateway',
          msg: `[conn:${connId}] Pong timeout after ${randomInt(25000, 35000)}ms — marking connection stale`,
        });
        logs.push({
          level: 'info',
          logger: 'SessionManager',
          msg: `[conn:${connId}] Saving player state before disconnect (character_id=${randomInt(10000, 999999)}, gold=${randomInt(1000, 500000)})`,
        });
        logs.push({
          level: 'error',
          logger: 'NetworkGateway',
          msg: `[conn:${connId}] WebSocket closed abnormally (code=1006) for ${user.id}. Last packet: ${randomInt(20, 45)}s ago`,
        });
        break;
      case 'redis-conn':
        logs.push({
          level: 'warn',
          logger: 'RedisClient',
          msg: `Health check FAIL (attempt 1/3): ECONNREFUSED 10.0.3.12:6379`,
        });
        logs.push({
          level: 'warn',
          logger: 'RedisClient',
          msg: `Health check FAIL (attempt 2/3): ECONNREFUSED 10.0.3.12:6379 (retry in 1s)`,
        });
        logs.push({
          level: 'error',
          logger: 'RedisClient',
          msg: `Health check FAIL (attempt 3/3): All retries exhausted. Sentinel unavailable.`,
        });
        logs.push({
          level: 'error',
          logger: 'RedisSessionStore',
          msg: `Session store OFFLINE — ${randomInt(200, 5000)} active sessions at risk`,
        });
        break;
      case 'mysql-pool':
        logs.push({
          level: 'info',
          logger: 'ConnectionPool',
          msg: `[pool:character-primary] Utilization: ${randomInt(85, 95)}/100 connections active`,
        });
        logs.push({
          level: 'warn',
          logger: 'ConnectionPool',
          msg: `[pool:character-primary] Utilization: 100/100 — queuing requests (depth: ${randomInt(100, 1500)})`,
        });
        logs.push({
          level: 'warn',
          logger: 'QueryRunner',
          msg: `[req:${reqId}] Connection acquire timeout after ${randomInt(8000, 15000)}ms — avgQueryTime=${randomInt(200, 500)}ms`,
        });
        logs.push({
          level: 'error',
          logger: 'ConnectionPool',
          msg: `[pool:character-primary] EXHAUSTED: 100/100 active, ${randomInt(500, 2000)} waiting. Oldest waiting: ${randomInt(5, 30)}s`,
        });
        break;
      case 'inv-dupe':
        logs.push({
          level: 'info',
          logger: 'TradeController',
          msg: `[req:${reqId}] Trade initiated: ${user.id} selling item_id=${randomInt(10000, 99999)} to NPC`,
        });
        logs.push({
          level: 'info',
          logger: 'InventoryManager',
          msg: `[req:${reqId}] Server inventory count: ${randomInt(40, 50)} items`,
        });
        logs.push({
          level: 'warn',
          logger: 'InventoryManager',
          msg: `[req:${reqId}] Client reports ${randomInt(48, 55)} items — MISMATCH detected`,
        });
        logs.push({
          level: 'error',
          logger: 'ItemValidator',
          msg: `[req:${reqId}] Duplicate item_id=${randomInt(20000, 40000)} (Refined Gold Bar) found. Race condition suspected in concurrent trade API.`,
        });
        break;
      case 'match-timeout':
        logs.push({
          level: 'info',
          logger: 'MatchmakingService',
          msg: `[req:${reqId}] Player ${user.id} entered PvP queue (MMR: ${randomInt(1200, 2400)}, mode: pvp_fleet_battle)`,
        });
        logs.push({
          level: 'info',
          logger: 'MatchmakingService',
          msg: `[req:${reqId}] Queue size: ${randomInt(1500, 4000)} players waiting`,
        });
        logs.push({
          level: 'warn',
          logger: 'MatchmakingService',
          msg: `[req:${reqId}] 60s elapsed — expanding MMR range: ±200 → ±500`,
        });
        logs.push({
          level: 'warn',
          logger: 'MatchmakingService',
          msg: `[req:${reqId}] 90s elapsed — expanding MMR range: ±500 → ±1000 (desperate mode)`,
        });
        logs.push({
          level: 'error',
          logger: 'MatchmakingService',
          msg: `[req:${reqId}] Queue timeout after 120s. No suitable opponent found for MMR ${randomInt(1200, 2400)}.`,
        });
        break;
      case 'slow-query':
        logs.push({
          level: 'debug',
          logger: 'QueryExecutor',
          msg: `[req:${reqId}] Executing: SELECT * FROM guild_rankings WHERE season=12 ORDER BY score DESC`,
        });
        logs.push({
          level: 'warn',
          logger: 'QueryMonitor',
          msg: `[req:${reqId}] Query running ${randomInt(3000, 6000)}ms (threshold: 2000ms) — possible full table scan`,
        });
        logs.push({
          level: 'warn',
          logger: 'QueryMonitor',
          msg: `[req:${reqId}] Query completed in ${randomInt(6000, 12000)}ms. Rows scanned: ${randomInt(800000, 2000000)}. Missing index suspected on (season, score).`,
        });
        break;
      case 'deadlock':
        logs.push({
          level: 'info',
          logger: 'TransactionRunner',
          msg: `[req:${reqId}] BEGIN TRANSACTION (guild_bank_transfer, isolation: REPEATABLE READ)`,
        });
        logs.push({
          level: 'debug',
          logger: 'GuildBankService',
          msg: `[req:${reqId}] Locking guild_bank_items for guild_id=${randomInt(1000, 9999)}`,
        });
        logs.push({
          level: 'warn',
          logger: 'TransactionRunner',
          msg: `[req:${reqId}] Lock wait timeout exceeded (${randomInt(40, 60)}s) — concurrent transactions: ${randomInt(5, 20)}`,
        });
        logs.push({
          level: 'error',
          logger: 'TransactionRunner',
          msg: `[req:${reqId}] DEADLOCK DETECTED on table guild_bank_items. Transaction rolled back. Retry #${randomInt(1, 3)}.`,
        });
        break;
      default:
        // Generic contextual logs for other nodejs scenarios
        logs.push({
          level: 'debug',
          logger: scenario.culprit.split(/[.:]/)[0],
          msg: `[req:${reqId}] Executing ${scenario.culprit} for ${user.id}`,
        });
        if (Math.random() < 0.5)
          logs.push({
            level: 'info',
            logger: 'MetricsCollector',
            msg: `[req:${reqId}] Request latency: ${randomInt(50, 2000)}ms, memory: ${randomInt(200, 1500)}MB`,
          });
        logs.push({
          level: scenario.level === 'fatal' ? 'error' : scenario.level,
          logger: 'ErrorHandler',
          msg: `[req:${reqId}] ${scenario.type}: ${scenario.value.substring(0, 180)}`,
        });
        break;
    }
  } else if (scenario.runtime === 'lua') {
    logs.push({
      level: 'debug',
      logger: 'LuaVM',
      msg: `[vm:${uuid().substring(0, 8)}] Script tick #${randomInt(10000, 999999)} (GC: ${randomInt(20, 180)}MB, entities: ${randomInt(100, 5000)})`,
    });
    switch (scenario.id) {
      case 'lua-nil':
        logs.push({
          level: 'info',
          logger: 'UIManager',
          msg: `Player ${user.id} opened CharacterPanel (scene: ${randomPick(['port_lisbon', 'port_london', 'sea_atlantic'])})`,
        });
        logs.push({
          level: 'debug',
          logger: 'CharacterUI',
          msg: `CharacterUI:onOpen() — loading equipment data for character_id=${randomInt(10000, 999999)}`,
        });
        logs.push({
          level: 'error',
          logger: 'LuaRuntime',
          msg: `attempt to index a nil value (field 'equipSlots') at CharacterUI.lua:234 — characterData is nil, data not loaded before UI render`,
        });
        break;
      case 'lua-cooldown':
        logs.push({
          level: 'info',
          logger: 'CombatSystem',
          msg: `Player ${user.id} using skill "Broadside Barrage" (id=2847) on target entity_${randomInt(1000, 9999)}`,
        });
        logs.push({
          level: 'warn',
          logger: 'SkillCooldownTracker',
          msg: `Skill 2847 server cooldown remaining: ${randomFloat(2, 8).toFixed(1)}s, client reports 0s — DESYNC`,
        });
        logs.push({
          level: 'error',
          logger: 'CombatSystem',
          msg: `CooldownDesyncError: ${randomInt(2, 5)} extra shots fired during desync window. Client clock drift: ${randomInt(100, 2000)}ms.`,
        });
        break;
      case 'lua-gc':
        logs.push({
          level: 'info',
          logger: 'GCMonitor',
          msg: `GC cycle started (mode: generational, memory: ${randomInt(100, 200)}MB)`,
        });
        logs.push({
          level: 'warn',
          logger: 'GCMonitor',
          msg: `GC pause spike: ${randomInt(200, 600)}ms (threshold: 16ms). Freed ${randomInt(20, 80)}MB. ${randomInt(500, 3000)} objects collected.`,
        });
        logs.push({
          level: 'info',
          logger: 'GCMonitor',
          msg: `GC cycle complete. Post-GC memory: ${randomInt(60, 120)}MB. Consider incremental GC tuning.`,
        });
        break;
      default:
        logs.push({
          level: 'debug',
          logger: 'LuaRuntime',
          msg: `Executing: ${scenario.culprit} (frame ${randomInt(1, 60)} of tick)`,
        });
        logs.push({
          level: scenario.level === 'fatal' ? 'error' : scenario.level,
          logger: 'LuaRuntime',
          msg: `${scenario.type}: ${scenario.value.substring(0, 180)}`,
        });
        break;
    }
  } else if (scenario.runtime === 'ue4') {
    logs.push({
      level: 'debug',
      logger: 'UE4Core',
      msg: `[Frame:${randomInt(100000, 9999999)}] FPS: ${randomInt(15, 120)}, DrawCalls: ${randomInt(500, 5000)}, Triangles: ${randomInt(500000, 5000000)}`,
    });
    switch (scenario.id) {
      case 'ue4-gpu-lost':
        logs.push({
          level: 'info',
          logger: 'Renderer',
          msg: `VRAM usage: ${randomFloat(4.5, 5.9).toFixed(1)}GB / ${randomPick(['6.0', '8.0'])}GB (${randomInt(85, 98)}%)`,
        });
        logs.push({
          level: 'warn',
          logger: 'Renderer',
          msg: `FPS dropped: ${randomInt(40, 60)} → ${randomInt(8, 15)}. GPU stall detected during ocean surface shader.`,
        });
        logs.push({
          level: 'error',
          logger: 'D3D12RHI',
          msg: `D3D Device Removed: DXGI_ERROR_DEVICE_HUNG. GPU: ${randomPick(['GeForce RTX 3060', 'GeForce GTX 1660', 'Radeon RX 6700 XT'])}. Driver: ${randomPick(['551.86', '552.12', '24.5.1'])}.`,
        });
        break;
      case 'ue4-repl':
        logs.push({
          level: 'info',
          logger: 'NetDriver',
          msg: `Network update tick. RTT: ${randomInt(50, 400)}ms, PacketLoss: ${randomFloat(0, 0.15).toFixed(3)}`,
        });
        logs.push({
          level: 'warn',
          logger: 'ShipActor',
          msg: `Position desync for BP_PlayerShip_C_${randomInt(1, 100)}: delta ${randomInt(100, 1000)} units. Server correcting client.`,
        });
        logs.push({
          level: 'error',
          logger: 'NetReplication',
          msg: `ReplicationError: Persistent desync (${randomInt(3, 10)} corrections in last 30s). Client rubber-banding. Consider lowering net update frequency.`,
        });
        break;
      default:
        logs.push({
          level: 'debug',
          logger: 'UE4Core',
          msg: `${scenario.culprit} executing (tick ${randomInt(1, 60)})`,
        });
        logs.push({
          level: scenario.level === 'fatal' ? 'error' : scenario.level,
          logger: 'UE4Crash',
          msg: `${scenario.type}: ${scenario.value.substring(0, 180)}`,
        });
        break;
    }
  }

  // Always add the final error log
  if (!logs.some((l) => l.level === 'error' || l.level === 'fatal')) {
    logs.push({
      level: scenario.level === 'warning' ? 'warn' : scenario.level,
      logger: 'ErrorReporter',
      msg: `${scenario.type}: ${scenario.value.substring(0, 200)}`,
    });
  }

  return logs;
}

// ═══════════════════ GAME RELEASES ═══════════════════

