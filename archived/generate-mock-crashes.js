const mysql = require('mysql2/promise');
require('dotenv').config();

// Unreal Engine 4 + Lua 환경에서 발생할 수 있는 현실적인 크래시 타입들
const CRASH_TYPES = [
  'NullPointerException',
  'AccessViolation',
  'StackOverflow',
  'OutOfMemoryError',
  'LuaRuntimeError',
  'BlueprintCompileError',
  'TextureLoadFailure',
  'NetworkTimeoutError',
  'FileIOException',
  'ShaderCompileError',
  'PhysicsSimulationError',
  'AnimationBlendError',
  'AudioStreamError',
  'RenderingPipelineError',
  'GarbageCollectionError',
];

// UE4 + Lua에서 발생할 수 있는 크래시 메시지들
const CRASH_MESSAGES = {
  NullPointerException: [
    'Attempt to access null UObject reference in Blueprint',
    'Lua script tried to access destroyed actor',
    'Widget reference is null during UI update',
    'Component reference lost during level transition',
  ],
  AccessViolation: [
    'Access violation reading location 0x00000000 in UE4 engine',
    'Invalid memory access in Slate UI rendering',
    'Corrupted mesh data causing access violation',
    'Invalid texture memory access during streaming',
  ],
  StackOverflow: [
    'Infinite recursion in Lua coroutine',
    'Blueprint execution stack overflow',
    'Recursive function call in game logic',
    'Deep nested widget hierarchy causing stack overflow',
  ],
  OutOfMemoryError: [
    'Failed to allocate memory for large texture asset',
    'Lua heap exhausted during script execution',
    'UE4 memory pool exhausted',
    'Too many actors spawned in level',
  ],
  LuaRuntimeError: [
    'attempt to index a nil value in player controller script',
    'attempt to call method on nil object in inventory system',
    'bad argument #1 to pairs (table expected, got nil)',
    'attempt to perform arithmetic on local variable (a nil value)',
  ],
  BlueprintCompileError: [
    'Blueprint compilation failed: missing node connection',
    'Invalid cast in Blueprint execution',
    'Blueprint circular dependency detected',
    'Missing Blueprint class reference',
  ],
  TextureLoadFailure: [
    'Failed to load texture: corrupted file format',
    'Texture streaming error: insufficient VRAM',
    'DDS texture format not supported',
    'Texture compression failed during runtime',
  ],
  NetworkTimeoutError: [
    'Server connection timeout during matchmaking',
    'UDP packet loss exceeded threshold',
    'TCP connection reset by peer',
    'Network replication timeout',
  ],
  FileIOException: [
    'Failed to read save game file: file corrupted',
    'Asset loading failed: file not found',
    'Config file write permission denied',
    'Pak file integrity check failed',
  ],
  ShaderCompileError: [
    'HLSL shader compilation failed',
    'Material shader missing required input',
    'Vertex shader compilation error',
    'Pixel shader optimization failed',
  ],
};

// 스택 트레이스 템플릿들
const STACK_TRACES = {
  NullPointerException: `UE4Editor-Core.dll!FOutputDevice::Logf() [d:\\build\\++ue4\\sync\\engine\\source\\runtime\\core\\private\\misc\\outputdevice.cpp:145]
UE4Editor-Core.dll!FDebug::AssertFailed() [d:\\build\\++ue4\\sync\\engine\\source\\runtime\\core\\private\\misc\\assertionmacros.cpp:349]
UE4Editor-Engine.dll!UObject::CallFunction() [d:\\build\\++ue4\\sync\\engine\\source\\runtime\\coreuobject\\private\\uobject\\scriptcore.cpp:866]
UE4Editor-Engine.dll!UGameplayStatics::SpawnActor() [d:\\build\\++ue4\\sync\\engine\\source\\runtime\\engine\\private\\kismet\\gameplaystatics.cpp:2156]`,

  AccessViolation: `UE4Editor-Core.dll!FWindowsPlatformMisc::RaiseException() [d:\\build\\++ue4\\sync\\engine\\source\\runtime\\core\\private\\windows\\windowsplatformmisc.cpp:434]
UE4Editor-RenderCore.dll!FRenderResource::InitResource() [d:\\build\\++ue4\\sync\\engine\\source\\runtime\\rendercore\\private\\renderresource.cpp:89]
UE4Editor-Renderer.dll!FSceneRenderer::Render() [d:\\build\\++ue4\\sync\\engine\\source\\runtime\\renderer\\private\\scenerendering.cpp:1456]`,

  LuaRuntimeError: `lua_error() [lua\\src\\lapi.c:1369]
luaL_error() [lua\\src\\lauxlib.c:178]
PlayerController.lua:45: attempt to index field 'inventory' (a nil value)
GameMode.lua:123: in function 'SpawnPlayer'
LuaInterface.cpp:234: in function 'ExecuteLuaScript'`,
};

// 플랫폼별 디바이스 타입
const DEVICE_TYPES = {
  android: [
    'Samsung Galaxy S21',
    'Samsung Galaxy S20',
    'Samsung Galaxy Note 20',
    'Google Pixel 6',
    'Google Pixel 5',
    'OnePlus 9 Pro',
    'OnePlus 8T',
    'Xiaomi Mi 11',
    'Xiaomi Redmi Note 10',
    'Huawei P40 Pro',
    'LG V60 ThinQ',
    'Sony Xperia 1 III',
    'Oppo Find X3 Pro',
  ],
  ios: [
    'iPhone 13 Pro Max',
    'iPhone 13 Pro',
    'iPhone 13',
    'iPhone 12 Pro Max',
    'iPhone 12 Pro',
    'iPhone 12',
    'iPhone 11 Pro',
    'iPhone 11',
    'iPad Pro 12.9',
    'iPad Pro 11',
    'iPad Air 4',
    'iPad 9th Gen',
  ],
  windows: [
    'Windows 10 x64',
    'Windows 11 x64',
    'Windows 10 x86',
    'Gaming Desktop RTX 3080',
    'Gaming Laptop GTX 1660',
    'Office PC Intel UHD',
    'Surface Pro 8',
    'Surface Book 3',
  ],
};

const PLATFORMS = ['android', 'ios', 'windows'];
const BRANCHES = ['release', 'patch', 'beta', 'alpha', 'dev'];
const MARKET_TYPES = ['google_play', 'app_store', 'huawei', 'xiaomi', 'oppo', 'direct'];
const SERVER_GROUPS = [
  'kr_server',
  'us_server',
  'eu_server',
  'jp_server',
  'cn_server',
  'sea_server',
];

// 버전 생성 함수
function generateVersion() {
  const major = Math.floor(Math.random() * 3) + 1; // 1-3
  const minor = Math.floor(Math.random() * 10); // 0-9
  const patch = Math.floor(Math.random() * 20); // 0-19
  const build = Math.floor(Math.random() * 1000) + 1000; // 1000-1999

  return `${major}.${minor}.${patch}.${build}`;
}

// 랜덤 선택 함수
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 크래시 ID 생성 함수
function generateCrashId(crashType, platform, version) {
  const hash = require('crypto')
    .createHash('md5')
    .update(`${crashType}_${platform}_${version}_${Math.random()}`)
    .digest('hex')
    .substring(0, 16);
  return `crash_${hash}`;
}

// 사용자 닉네임 생성 함수
function generateUserNickname() {
  const prefixes = ['Player', 'Gamer', 'Hero', 'Warrior', 'Mage', 'Knight', 'Archer', 'Ninja'];
  const suffixes = ['2023', '2024', 'Pro', 'X', 'Master', '99', '777', 'Elite'];
  return `${randomChoice(prefixes)}${randomChoice(suffixes)}${Math.floor(Math.random() * 10000)}`;
}

async function generateMockCrashes() {
  console.log('🚀 Starting mock crash data generation...');

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

    console.log('📊 Generating crash data in batches...');

    const totalCrashes = 100000; // 10만개로 줄임
    const batchSize = 5000; // 배치 크기

    // 배치별로 크래시 생성 및 삽입
    for (let batch = 0; batch < Math.ceil(totalCrashes / batchSize); batch++) {
      console.log(`Processing batch ${batch + 1}/${Math.ceil(totalCrashes / batchSize)}`);

      const crashes = [];
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, totalCrashes);

      // 배치 내 크래시 생성
      for (let i = startIdx; i < endIdx; i++) {
        const crashType = randomChoice(CRASH_TYPES);
        const platform = randomChoice(PLATFORMS);
        const branch = randomChoice(BRANCHES);
        const version = generateVersion();
        const crashId = generateCrashId(crashType, platform, version);

        const crash = {
          crash_id: crashId,
          user_id: Math.floor(Math.random() * 100000) + 1,
          user_nickname: generateUserNickname(),
          platform: platform,
          branch: branch,
          market_type:
            platform === 'android'
              ? randomChoice(MARKET_TYPES.slice(0, 6))
              : platform === 'ios'
                ? 'app_store'
                : null,
          server_group: randomChoice(SERVER_GROUPS),
          device_type: randomChoice(DEVICE_TYPES[platform]),
          version: version,
          crash_type: crashType,
          crash_message: randomChoice(CRASH_MESSAGES[crashType] || ['Unknown error']),
          stack_trace_file: `/crashes/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${crashId}_stacktrace.txt`,
          logs_file: `/crashes/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${crashId}_logs.txt`,
          state: Math.random() < 0.8 ? 0 : Math.random() < 0.9 ? 1 : 2, // 80% OPEN, 18% CLOSED, 2% DELETED
          first_occurred_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // 지난 30일 내
          last_occurred_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // 지난 7일 내
          occurrence_count: Math.floor(Math.random() * 100) + 1, // 1-100
        };

        crashes.push(crash);
      }

      // 배치 삽입
      if (crashes.length > 0) {
        const values = crashes.map((crash) => [
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
      }
    }

    console.log('📊 Generating crash instances...');

    // 각 크래시에 대해 1-100개의 인스턴스 생성 (배치별로 처리)
    const crashIds = await connection.query(
      'SELECT id, crash_id, user_id, user_nickname, platform, branch, market_type, server_group, device_type, version, crash_type, crash_message, stack_trace_file, logs_file FROM crashes'
    );

    const instanceBatchSize = 2000;
    let totalInstances = 0;

    for (let i = 0; i < crashIds[0].length; i += instanceBatchSize) {
      const crashBatch = crashIds[0].slice(i, i + instanceBatchSize);
      const crashInstances = [];

      console.log(
        `Processing crash instances batch ${Math.floor(i / instanceBatchSize) + 1}/${Math.ceil(crashIds[0].length / instanceBatchSize)}`
      );

      for (const crash of crashBatch) {
        const instanceCount = Math.floor(Math.random() * 100) + 1; // 1-100

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

          crashInstances.push(instance);
        }
      }

      // 인스턴스 배치 삽입
      if (crashInstances.length > 0) {
        const values = crashInstances.map((instance) => [
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

        totalInstances += crashInstances.length;
        console.log(`Inserted ${crashInstances.length} instances (Total: ${totalInstances})`);
      }
    }

    // 통계 출력
    const [crashCount] = await connection.query('SELECT COUNT(*) as count FROM crashes');
    const [instanceCount] = await connection.query('SELECT COUNT(*) as count FROM crash_instances');

    console.log('✅ Mock data generation completed!');
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
  generateMockCrashes().catch(console.error);
}

module.exports = { generateMockCrashes };
