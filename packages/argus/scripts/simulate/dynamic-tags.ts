/**
 * Simulate Data — Dynamic Tags & Extra
 */
import { randomInt, randomFloat, randomPick, uuid } from './helpers';
import { ErrorScenario } from './scenarios';

export const K8S_NAMESPACES = ['game-prod', 'game-staging', 'infra-prod'];
export const DATACENTERS = [
  'ap-northeast-2a',
  'ap-northeast-2b',
  'ap-northeast-2c',
  'eu-west-1a',
  'us-east-1b',
];
export const DEPLOY_SLOTS = ['blue', 'green'];
export const CLIENT_PLATFORMS = [
  'Steam',
  'Epic',
  'Direct',
  'WeGame',
  'PlayStation',
  'Xbox',
];
export const GAME_SHARDS = Array.from(
  { length: 20 },
  (_, i) => `shard-${String(i + 1).padStart(2, '0')}`
);
export const K8S_SUFFIXES = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function k8sPodName(service: string): string {
  const suffix = Array.from(
    { length: 5 },
    () => K8S_SUFFIXES[randomInt(0, K8S_SUFFIXES.length - 1)]
  ).join('');
  const replicaSet = Array.from(
    { length: 9 },
    () => K8S_SUFFIXES[randomInt(0, K8S_SUFFIXES.length - 1)]
  ).join('');
  return `${service}-${replicaSet}-${suffix}`;
}
export function instanceId(): string {
  return `i-${uuid().substring(0, 17)}`;
}

export function dynamicTags(
  scenario: ErrorScenario,
  server: string,
  env: string
): Record<string, string> {
  const base: Record<string, string> = { ...scenario.tags };
  const service = randomPick(scenario.services);
  base['server.name'] = server;
  base['environment'] = env;
  base['deployment.slot'] = randomPick(DEPLOY_SLOTS);
  base['server.datacenter'] = randomPick(DATACENTERS);

  if (scenario.runtime === 'nodejs') {
    base['kubernetes.pod_name'] = k8sPodName(service);
    base['kubernetes.namespace'] = randomPick(K8S_NAMESPACES);
    base['process.pid'] = String(randomInt(1000, 65535));
    base['node.version'] = randomPick(['v20.14.0', 'v20.12.2', 'v22.2.0']);
    base['server.instance_id'] = instanceId();
    base['game.shard'] = randomPick(GAME_SHARDS);
    if (Math.random() < 0.4)
      base['db.connection_pool'] = `pool-${randomInt(1, 5)}`;
    if (Math.random() < 0.3) base['network.rtt_ms'] = String(randomInt(8, 450));
  } else if (scenario.runtime === 'lua') {
    base['lua.vm_id'] = `vm-${uuid().substring(0, 8)}`;
    base['lua.gc_memory_kb'] = String(randomInt(8000, 180000));
    base['game.world_id'] = randomPick(GAME_SHARDS);
    base['game.scene'] = randomPick([
      'port_lisbon',
      'port_london',
      'port_istanbul',
      'sea_atlantic',
      'sea_mediterranean',
      'sea_caribbean',
      'port_amsterdam',
      'port_venice',
      'sea_indian_ocean',
      'port_calicut',
    ]);
    base['game.zone_population'] = String(randomInt(50, 800));
  } else if (scenario.runtime === 'ue4') {
    base['gpu.vendor'] = randomPick(['NVIDIA', 'AMD', 'Intel']);
    base['gpu.vram_mb'] = String(randomPick([4096, 6144, 8192, 12288, 16384]));
    base['client.platform'] = randomPick(CLIENT_PLATFORMS);
    base['client.build_number'] = String(randomInt(10000, 99999));
    base['display.resolution'] = randomPick([
      '1920x1080',
      '2560x1440',
      '3840x2160',
      '1366x768',
      '2560x1080',
    ]);
    base['display.fullscreen'] = randomPick(['true', 'false', 'borderless']);
    base['client.fps_avg'] = String(randomInt(12, 144));
    if (Math.random() < 0.5)
      base['network.rtt_ms'] = String(randomInt(15, 600));
  }
  // Occasional extra tags for diversity
  if (Math.random() < 0.2)
    base['feature_flag.new_combat'] = randomPick(['true', 'false']);
  if (Math.random() < 0.15)
    base['ab_test.variant'] = randomPick([
      'control',
      'treatment_a',
      'treatment_b',
    ]);
  if (Math.random() < 0.1)
    base['session.is_returning'] = randomPick(['true', 'false']);

  // ── Number-type tags for testing numeric queries ──
  // These appear frequently so number-type filters can be tested properly
  base['response_time_ms'] = String(randomInt(5, 5000));
  base['memory_usage_mb'] = String(randomInt(64, 4096));
  if (Math.random() < 0.7)
    base['cpu_percent'] = String(randomFloat(1, 99).toFixed(1));
  if (Math.random() < 0.5) base['error_count'] = String(randomInt(0, 50));
  if (Math.random() < 0.4) base['retry_count'] = String(randomInt(0, 5));
  if (Math.random() < 0.3) base['queue_depth'] = String(randomInt(0, 10000));
  if (Math.random() < 0.3) base['connection_count'] = String(randomInt(1, 500));
  if (Math.random() < 0.5)
    base['payload_size_bytes'] = String(randomInt(64, 1048576));
  return base;
}

export function dynamicExtra(scenario: ErrorScenario): Record<string, string> {
  const base: Record<string, string> = { ...scenario.extra };
  if (Math.random() < 0.3) base['request_id'] = uuid();
  if (Math.random() < 0.4) base['correlation_id'] = uuid().substring(0, 16);
  if (Math.random() < 0.2)
    base['cpu_usage_pct'] = String(randomFloat(20, 98).toFixed(1));
  if (Math.random() < 0.2) base['memory_rss_mb'] = String(randomInt(256, 4096));
  if (Math.random() < 0.15) base['gc_pause_ms'] = String(randomInt(5, 800));
  if (Math.random() < 0.1)
    base['active_goroutines'] = String(randomInt(100, 5000));
  return base;
}

// ═══════════════════ REALISTIC SPAN TEMPLATES ═══════════════════

