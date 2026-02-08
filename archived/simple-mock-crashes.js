const mysql = require('mysql2/promise');
require('dotenv').config();

// 간단한 크래시 타입들
const CRASH_TYPES = [
  'NullPointerException',
  'AccessViolation',
  'StackOverflow',
  'OutOfMemoryError',
  'LuaRuntimeError',
  'BlueprintCompileError',
  'TextureLoadFailure',
  'NetworkTimeoutError',
];

// 간단한 크래시 메시지들
const CRASH_MESSAGES = [
  'Attempt to access null UObject reference in Blueprint',
  'Lua script tried to access destroyed actor',
  'Access violation reading location 0x00000000 in UE4 engine',
  'Infinite recursion in Lua coroutine',
  'Failed to allocate memory for large texture asset',
  'Blueprint compilation failed: missing node connection',
  'Failed to load texture: corrupted file format',
  'Server connection timeout during matchmaking',
];

const PLATFORMS = ['android', 'ios', 'windows'];
const BRANCHES = ['release', 'patch', 'beta'];
const MARKET_TYPES = ['google_play', 'app_store', 'huawei', 'direct'];
const SERVER_GROUPS = ['kr_server', 'us_server', 'eu_server', 'jp_server'];

const DEVICE_TYPES = {
  android: ['Samsung Galaxy S21', 'Google Pixel 6', 'Xiaomi Mi 11'],
  ios: ['iPhone 13 Pro', 'iPhone 12', 'iPad Pro 11'],
  windows: ['Windows 10 x64', 'Windows 11 x64', 'Gaming Desktop RTX 3080'],
};

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateVersion() {
  const major = Math.floor(Math.random() * 3) + 1;
  const minor = Math.floor(Math.random() * 10);
  const patch = Math.floor(Math.random() * 20);
  return `${major}.${minor}.${patch}`;
}

function generateUserNickname() {
  const prefixes = ['Player', 'Gamer', 'Hero', 'Warrior'];
  const suffixes = ['2023', '2024', 'Pro', 'X'];
  return `${randomChoice(prefixes)}${randomChoice(suffixes)}${Math.floor(Math.random() * 1000)}`;
}

function generateCrashId() {
  return `crash_${Math.random().toString(36).substring(2, 15)}`;
}

async function generateSimpleMockCrashes() {
  console.log('🚀 Starting simple mock crash data generation...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate',
  });

  try {
    // 기존 데이터 삭제
    console.log('🗑️  Clearing existing crash data...');
    await connection.execute('DELETE FROM crash_instances');
    await connection.execute('DELETE FROM crashes');

    console.log('📊 Generating 1000 crashes...');

    // 1000개의 크래시 생성
    const crashes = [];
    for (let i = 0; i < 1000; i++) {
      const platform = randomChoice(PLATFORMS);
      const crash = {
        crash_id: generateCrashId(),
        user_id: Math.floor(Math.random() * 1000) + 1,
        user_nickname: generateUserNickname(),
        platform: platform,
        branch: randomChoice(BRANCHES),
        market_type:
          platform === 'android'
            ? randomChoice(MARKET_TYPES.slice(0, 3))
            : platform === 'ios'
              ? 'app_store'
              : null,
        server_group: randomChoice(SERVER_GROUPS),
        device_type: randomChoice(DEVICE_TYPES[platform]),
        version: generateVersion(),
        crash_type: randomChoice(CRASH_TYPES),
        crash_message: randomChoice(CRASH_MESSAGES),
        stack_trace_file: `/crashes/2025/09/26/crash_${i}_stacktrace.txt`,
        logs_file: `/crashes/2025/09/26/crash_${i}_logs.txt`,
        state: Math.random() < 0.8 ? 0 : 1, // 80% OPEN, 20% CLOSED
        first_occurred_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        last_occurred_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        occurrence_count: Math.floor(Math.random() * 50) + 1,
      };
      crashes.push(crash);
    }

    console.log('💾 Inserting crashes into database...');

    // 배치로 삽입 (100개씩)
    const batchSize = 100;
    for (let i = 0; i < crashes.length; i += batchSize) {
      const batch = crashes.slice(i, i + batchSize);
      const values = batch.map((crash) => [
        crash.crash_id,
        crash.user_id,
        crash.user_nickname,
        crash.platform,
        crash.branch,
        crash.market_type,
        crash.server_group,
        crash.device_type,
        crash.version,
        crash.crash_type,
        crash.crash_message,
        crash.stack_trace_file,
        crash.logs_file,
        crash.state,
        crash.first_occurred_at,
        crash.last_occurred_at,
        crash.occurrence_count,
      ]);

      await connection.query(
        `
        INSERT INTO crashes (
          crash_id, user_id, user_nickname, platform, branch, market_type, server_group,
          device_type, version, crash_type, crash_message, stack_trace_file, logs_file,
          state, first_occurred_at, last_occurred_at, occurrence_count
        ) VALUES ?
      `,
        [values]
      );

      console.log(
        `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(crashes.length / batchSize)}`
      );
    }

    console.log('📊 Generating crash instances...');

    // 각 크래시에 대해 1-10개의 인스턴스 생성
    const crashIds = await connection.query(
      'SELECT id, crash_id, user_id, user_nickname, platform, branch, market_type, server_group, device_type, version, crash_type, crash_message, stack_trace_file, logs_file FROM crashes'
    );

    const allInstances = [];
    for (const crash of crashIds[0]) {
      const instanceCount = Math.floor(Math.random() * 10) + 1; // 1-10

      for (let j = 0; j < instanceCount; j++) {
        const instance = {
          cid: crash.id,
          user_id: crash.user_id,
          user_nickname: crash.user_nickname,
          platform: crash.platform,
          branch: crash.branch,
          market_type: crash.market_type,
          server_group: crash.server_group,
          device_type: crash.device_type,
          version: crash.version,
          crash_type: crash.crash_type,
          crash_message: crash.crash_message,
          stack_trace_file: crash.stack_trace_file,
          logs_file: crash.logs_file,
          occurred_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        };

        allInstances.push(instance);
      }
    }

    console.log('💾 Inserting crash instances into database...');

    // 인스턴스 배치 삽입 (500개씩)
    const instanceBatchSize = 500;
    for (let i = 0; i < allInstances.length; i += instanceBatchSize) {
      const batch = allInstances.slice(i, i + instanceBatchSize);
      const values = batch.map((instance) => [
        instance.cid,
        instance.user_id,
        instance.user_nickname,
        instance.platform,
        instance.branch,
        instance.market_type,
        instance.server_group,
        instance.device_type,
        instance.version,
        instance.crash_type,
        instance.crash_message,
        instance.stack_trace_file,
        instance.logs_file,
        instance.occurred_at,
      ]);

      await connection.query(
        `
        INSERT INTO crash_instances (
          cid, user_id, user_nickname, platform, branch, market_type, server_group,
          device_type, version, crash_type, crash_message, stack_trace_file, logs_file, occurred_at
        ) VALUES ?
      `,
        [values]
      );

      console.log(
        `Inserted instance batch ${Math.floor(i / instanceBatchSize) + 1}/${Math.ceil(allInstances.length / instanceBatchSize)}`
      );
    }

    // 통계 출력
    const [crashCount] = await connection.query('SELECT COUNT(*) as count FROM crashes');
    const [instanceCount] = await connection.query('SELECT COUNT(*) as count FROM crash_instances');

    console.log('✅ Simple mock data generation completed!');
    console.log(`📊 Generated ${crashCount[0].count} crashes`);
    console.log(`📊 Generated ${instanceCount[0].count} crash instances`);
  } catch (error) {
    console.error('❌ Error generating mock data:', error);
  } finally {
    await connection.end();
  }
}

// 실행
if (require.main === module) {
  generateSimpleMockCrashes().catch(console.error);
}

module.exports = { generateSimpleMockCrashes };
