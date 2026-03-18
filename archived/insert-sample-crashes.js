/**
 * Insert sample crash data into gatrix_crash database
 * for testing CrashesPage UI
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');

function ulid() {
  // Simple ULID-like ID generator for sample data
  const now = Date.now();
  const timeStr = now.toString(36).padStart(10, '0');
  const randomStr = crypto.randomBytes(10).toString('hex').slice(0, 16);
  return (timeStr + randomStr).toUpperCase().slice(0, 26);
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.CRASH_DB_NAME || 'gatrix_crash',
  });

  console.log('Connected to gatrix_crash database');

  // Check if data already exists
  const [existing] = await connection.execute('SELECT COUNT(*) as cnt FROM g_crashes');
  if (existing[0].cnt > 0) {
    console.log(`Already have ${existing[0].cnt} crash groups. Skipping insert.`);
    await connection.end();
    return;
  }

  // Get a valid environmentId from main DB
  let envId = ulid(); // fallback
  try {
    const mainConn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'admin_panel',
    });
    const [envRows] = await mainConn.execute('SELECT id FROM g_environments LIMIT 1');
    if (envRows.length > 0) {
      envId = envRows[0].id;
    }
    await mainConn.end();
  } catch (e) {
    console.log('Could not fetch environment ID from admin_panel, using generated one');
  }

  // Sample crash stacks
  const stacks = [
    {
      firstLine: 'NullReferenceException: Object reference not set',
      stack: `NullReferenceException: Object reference not set to an instance of an object
  at GameEngine.PlayerController.Update() in PlayerController.cs:line 142
  at GameEngine.EntityManager.UpdateAll() in EntityManager.cs:line 89
  at GameEngine.GameLoop.Tick() in GameLoop.cs:line 35`,
      platform: 'Windows',
      branch: 'main',
    },
    {
      firstLine: 'AccessViolationException: Attempted to read protected memory',
      stack: `AccessViolationException: Attempted to read or write protected memory
  at NativePlugin.RenderSystem.DrawMesh() in RenderSystem.cpp:line 512
  at GameEngine.Renderer.OnRenderFrame() in Renderer.cs:line 201
  at GameEngine.GraphicsLoop.Render() in GraphicsLoop.cs:line 78`,
      platform: 'Windows',
      branch: 'main',
    },
    {
      firstLine: 'OutOfMemoryException: Insufficient memory',
      stack: `OutOfMemoryException: Insufficient memory to continue the execution of the program
  at System.Runtime.InteropServices.Marshal.AllocHGlobal(Int32 cb)
  at GameEngine.AssetLoader.LoadTexture(String path) in AssetLoader.cs:line 267
  at GameEngine.ResourceManager.PreloadAssets() in ResourceManager.cs:line 45`,
      platform: 'Windows',
      branch: 'develop',
    },
    {
      firstLine: 'SIGSEGV: Segmentation fault in libgame.so',
      stack: `Signal 11 (SIGSEGV), Code 1 (SEGV_MAPERR)
  #0 0x7f4a3c001234 in GameEngine::Physics::CollisionDetect() at physics.cpp:331
  #1 0x7f4a3c002345 in GameEngine::Physics::Step() at physics.cpp:178
  #2 0x7f4a3c003456 in GameEngine::GameLoop::Update() at gameloop.cpp:92`,
      platform: 'Linux',
      branch: 'main',
    },
    {
      firstLine: 'EXC_BAD_ACCESS (SIGBUS) at 0x0000000000000008',
      stack: `EXC_BAD_ACCESS (SIGBUS)
  Thread 0 Crashed:
  0   libgame.dylib    0x1045a3210 GameEngine::Audio::ProcessBuffer() + 128
  1   libgame.dylib    0x1045a4420 GameEngine::Audio::MixChannels() + 96
  2   libgame.dylib    0x1045a5630 GameEngine::Audio::Update() + 48`,
      platform: 'macOS',
      branch: 'main',
    },
    {
      firstLine: 'StackOverflowException: Stack overflow in AI pathfinding',
      stack: `StackOverflowException: Stack overflow
  at GameEngine.AI.Pathfinder.FindPath(Vector3 start, Vector3 end) in Pathfinder.cs:line 88
  at GameEngine.AI.Pathfinder.FindPath(Vector3 start, Vector3 end) in Pathfinder.cs:line 88
  at GameEngine.AI.NPCController.MoveTo(Vector3 target) in NPCController.cs:line 156`,
      platform: 'Windows',
      branch: 'feature/ai-rework',
    },
    {
      firstLine: 'TimeoutException: Network request timed out',
      stack: `TimeoutException: Network request timed out after 30000ms
  at GameEngine.Network.HttpClient.Send(HttpRequest req) in HttpClient.cs:line 134
  at GameEngine.Network.LoginService.Authenticate(String token) in LoginService.cs:line 67
  at GameEngine.UI.LoginScreen.DoLogin() in LoginScreen.cs:line 42`,
      platform: 'Windows',
      branch: 'main',
    },
    {
      firstLine: 'InvalidOperationException: Cannot modify collection during enumeration',
      stack: `InvalidOperationException: Collection was modified; enumeration operation may not halt.
  at System.Collections.Generic.List\`1.Enumerator.MoveNext()
  at GameEngine.Inventory.InventoryManager.RemoveExpiredItems() in InventoryManager.cs:line 203
  at GameEngine.Inventory.InventoryManager.Update() in InventoryManager.cs:line 55`,
      platform: 'Windows',
      branch: 'develop',
    },
  ];

  const userNames = ['warrior123', 'mage_queen', 'healer_joe', 'tank_master', 'rogue_shadow', 'archer_luna', 'paladin_rex'];
  const versions = ['1.0.0', '1.0.1', '1.1.0', '1.2.0', '1.2.1', '2.0.0-beta'];
  const resVersions = ['100', '101', '102', '103', '110'];
  const states = [0, 0, 0, 2, 0, 1, 0, 3]; // mostly OPEN

  console.log('Inserting crash groups...');

  for (let i = 0; i < stacks.length; i++) {
    const s = stacks[i];
    const crashId = ulid();
    const chash = md5(s.stack);
    const eventCount = 2 + Math.floor(Math.random() * 15);

    // Random dates within last 30 days
    const now = Date.now();
    const firstCrashMs = now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000);
    const lastCrashMs = firstCrashMs + Math.floor(Math.random() * (now - firstCrashMs));
    const firstCrash = new Date(firstCrashMs).toISOString().slice(0, 19).replace('T', ' ');
    const lastCrash = new Date(lastCrashMs).toISOString().slice(0, 19).replace('T', ' ');

    const maxVer = versions[Math.min(i, versions.length - 1)];

    await connection.execute(
      `INSERT INTO g_crashes (id, chash, branch, environmentId, platform, isEditor, firstLine, crashesCount, firstCrashAt, lastCrashAt, crashesState, assignee, jiraTicket, maxAppVersion, maxResVersion, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [
        crashId,
        chash,
        s.branch,
        envId,
        s.platform,
        false,
        s.firstLine,
        eventCount,
        firstCrash,
        lastCrash,
        states[i],
        i === 0 ? 'jhseo' : i === 3 ? 'dev_kim' : null,
        i === 0 ? 'GATRIX-1234' : i === 2 ? 'https://jira.example.com/browse/GAME-567' : null,
        maxVer,
        resVersions[Math.min(i, resVersions.length - 1)],
      ]
    );

    console.log(`  Crash group #${i + 1}: ${s.firstLine.slice(0, 50)}... (${eventCount} events)`);

    // Insert crash events
    for (let j = 0; j < eventCount; j++) {
      const eventId = ulid();
      const eventTime = new Date(
        firstCrashMs + Math.floor(Math.random() * (lastCrashMs - firstCrashMs + 60000))
      ).toISOString().slice(0, 19).replace('T', ' ');

      const userName = userNames[Math.floor(Math.random() * userNames.length)];
      const accId = String(10000 + Math.floor(Math.random() * 90000));
      const charId = String(200000 + Math.floor(Math.random() * 800000));
      const ver = versions[Math.floor(Math.random() * versions.length)];
      const resVer = resVersions[Math.floor(Math.random() * resVersions.length)];

      await connection.execute(
        `INSERT INTO g_crash_events (id, crashId, firstLine, platform, branch, environmentId, isEditor, appVersion, resVersion, accountId, characterId, userName, userMessage, crashEventIp, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          crashId,
          s.firstLine,
          s.platform,
          s.branch,
          envId,
          false,
          ver,
          resVer,
          accId,
          charId,
          userName,
          j % 3 === 0 ? 'Game froze during battle' : j % 3 === 1 ? 'Crash after loading map' : null,
          `192.168.1.${10 + Math.floor(Math.random() * 240)}`,
          eventTime,
        ]
      );
    }
  }

  const [totalCrashes] = await connection.execute('SELECT COUNT(*) as cnt FROM g_crashes');
  const [totalEvents] = await connection.execute('SELECT COUNT(*) as cnt FROM g_crash_events');
  console.log(`\nDone! Inserted ${totalCrashes[0].cnt} crash groups, ${totalEvents[0].cnt} crash events.`);

  await connection.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
