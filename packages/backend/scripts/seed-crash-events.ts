import { Knex } from 'knex';
import crypto from 'crypto';
import { generateULID } from '../src/utils/ulid';
import { config } from '../src/config';
import fs from 'fs/promises';
import path from 'path';

const knex: Knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
  },
  pool: { min: 0, max: 10 },
});

// Sample data arrays
const platforms = ['android', 'ios', 'windows', 'mac', 'linux'];
const environments = ['production', 'staging', 'development'];
const branches = ['main', 'develop', 'feature/new-ui', 'hotfix/crash-fix'];
const marketTypes = ['google', 'apple', 'steam', 'epic'];
const appVersions = ['1.0.0', '1.0.1', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '2.2.0', '3.0.0'];
const resVersions = ['1.0.0', '1.0.1', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '2.2.0', '3.0.0'];

// 대항해시대 온라인 스타일 사용자 이름
const userNames = [
  'CaptainDrake',
  'AdmiralNelson',
  'NavigatorMagellan',
  'TraderVasco',
  'PirateBlackbeard',
  'ExplorerColumbus',
  'MerchantMarco',
  'SailorSinbad',
  'CommanderCortez',
  'VoyagerCook',
  'SeaWolfMorgan',
  'TreasureHunter',
  'OceanMaster',
  'WindRider',
  'StormChaser',
  'GoldSeeker',
  'SilkTrader',
  'SpiceRunner',
  'CannonMaster',
  'ShipBuilder',
  'MapMaker',
  'CompassKeeper',
  'AnchorDrop',
  'SailMaster',
  'DeckHand',
  'FirstMate',
  'Quartermaster',
  'Boatswain',
  'Navigator',
  'Helmsman',
];

// 게임 시스템 오류 메시지
const userMessages = [
  'Failed to load ship inventory data',
  'Trade route calculation error',
  'Port connection timeout',
  'Ship collision detection failed',
  'Weather system synchronization error',
  'Cargo weight calculation overflow',
  'Navigation map rendering failed',
  'Player position desync detected',
  'Guild data corruption',
  'Quest state machine error',
  'Item duplication detected',
  'Server packet loss exceeded threshold',
  'Memory leak in ocean rendering',
  'Texture streaming failure',
  'Audio engine crash',
  'Physics simulation divergence',
  'Database connection pool exhausted',
  'Cache invalidation error',
  'Session token expired unexpectedly',
  'Resource loading deadlock',
  null,
  null,
  null,
  null, // Some nulls to make it realistic
];

const stackTraces = [
  `NullReferenceException: Object reference not set to an instance of an object
  at NavalGame.Ship.CalculateCargoWeight() in Ship.cs:line 423
  at NavalGame.Trade.ValidateTransaction() in Trade.cs:line 156
  at NavalGame.Port.ProcessDocking() in Port.cs:line 289
  at NavalGame.World.UpdatePorts() in World.cs:line 734
  at NavalGame.GameLoop.Tick() in GameLoop.cs:line 1456
  at NavalGame.Engine.Run() in Engine.cs:line 89
  at NavalGame.Main.Start() in Main.cs:line 45
  at System.AppDomain._nExecuteAssembly(RuntimeAssembly assembly, String[] args)
  at System.AppDomain.ExecuteAssembly(String assemblyFile, Evidence assemblySecurity, String[] args)
  at Microsoft.VisualStudio.HostingProcess.HostProc.RunUsersAssembly()
  at System.Threading.ThreadHelper.ThreadStart_Context(Object state)
  at System.Threading.ExecutionContext.RunInternal(ExecutionContext executionContext, ContextCallback callback, Object state, Boolean preserveSyncCtx)
  at System.Threading.ExecutionContext.Run(ExecutionContext executionContext, ContextCallback callback, Object state, Boolean preserveSyncCtx)
  at System.Threading.ExecutionContext.Run(ExecutionContext executionContext, ContextCallback callback, Object state)
  at System.Threading.ThreadHelper.ThreadStart()`,

  `IndexOutOfRangeException: Index was outside the bounds of the array
  at NavalGame.Inventory.GetItemBySlot(Int32 slotIndex) in Inventory.cs:line 234
  at NavalGame.UI.InventoryPanel.RenderSlot(Int32 index) in InventoryPanel.cs:line 567
  at NavalGame.UI.InventoryPanel.Render() in InventoryPanel.cs:line 489
  at NavalGame.UI.UIManager.UpdatePanels() in UIManager.cs:line 890
  at NavalGame.UI.UIManager.Update() in UIManager.cs:line 123
  at NavalGame.GameLoop.UpdateUI() in GameLoop.cs:line 1234
  at NavalGame.GameLoop.Tick() in GameLoop.cs:line 1456
  at NavalGame.Engine.Run() in Engine.cs:line 89
  at NavalGame.Main.Start() in Main.cs:line 45
  at System.AppDomain._nExecuteAssembly(RuntimeAssembly assembly, String[] args)
  at System.Threading.ThreadHelper.ThreadStart()`,

  `ArgumentException: Invalid network packet format
  at NavalGame.Network.PacketHandler.ParsePacket(Byte[] data) in PacketHandler.cs:line 345
  at NavalGame.Network.NetworkManager.ProcessIncomingData() in NetworkManager.cs:line 678
  at NavalGame.Network.NetworkManager.Update() in NetworkManager.cs:line 234
  at NavalGame.Player.SyncPosition() in Player.cs:line 567
  at NavalGame.Player.Update() in Player.cs:line 123
  at NavalGame.World.UpdatePlayers() in World.cs:line 890
  at NavalGame.GameLoop.Tick() in GameLoop.cs:line 1456
  at NavalGame.Engine.Run() in Engine.cs:line 89
  at NavalGame.Main.Start() in Main.cs:line 45
  at System.AppDomain._nExecuteAssembly(RuntimeAssembly assembly, String[] args)
  at System.Threading.ThreadHelper.ThreadStart()`,

  `OutOfMemoryException: Insufficient memory to continue the execution of the program
  at NavalGame.Graphics.TextureManager.LoadTexture(String path) in TextureManager.cs:line 123
  at NavalGame.Graphics.OceanRenderer.InitializeWaterTextures() in OceanRenderer.cs:line 456
  at NavalGame.Graphics.OceanRenderer.Initialize() in OceanRenderer.cs:line 89
  at NavalGame.Graphics.Renderer.InitializeSubsystems() in Renderer.cs:line 234
  at NavalGame.Graphics.Renderer.Initialize() in Renderer.cs:line 67
  at NavalGame.Engine.InitializeGraphics() in Engine.cs:line 145
  at NavalGame.Engine.Initialize() in Engine.cs:line 56
  at NavalGame.Main.Start() in Main.cs:line 34
  at System.AppDomain._nExecuteAssembly(RuntimeAssembly assembly, String[] args)
  at System.Threading.ThreadHelper.ThreadStart()`,

  `StackOverflowException: Operation caused a stack overflow
  at NavalGame.AI.PathFinding.FindPath(Node start, Node end) in PathFinding.cs:line 234
  at NavalGame.AI.PathFinding.FindPath(Node start, Node end) in PathFinding.cs:line 245
  at NavalGame.AI.PathFinding.FindPath(Node start, Node end) in PathFinding.cs:line 245
  at NavalGame.AI.PathFinding.FindPath(Node start, Node end) in PathFinding.cs:line 245
  at NavalGame.AI.NavigationSystem.CalculateRoute(Vector3 from, Vector3 to) in NavigationSystem.cs:line 567
  at NavalGame.Ship.SetDestination(Port targetPort) in Ship.cs:line 890
  at NavalGame.Player.CommandShip(Port destination) in Player.cs:line 123
  at NavalGame.UI.MapPanel.OnPortClicked(Port port) in MapPanel.cs:line 456
  at NavalGame.UI.UIManager.ProcessInput() in UIManager.cs:line 234
  at NavalGame.GameLoop.Tick() in GameLoop.cs:line 1456`,

  `AccessViolationException: Attempted to read or write protected memory
  at NavalGame.Physics.CollisionDetector.CheckShipCollision(Ship ship1, Ship ship2) in CollisionDetector.cs:line 678
  at NavalGame.Physics.PhysicsEngine.UpdateCollisions() in PhysicsEngine.cs:line 345
  at NavalGame.Physics.PhysicsEngine.Simulate(Single deltaTime) in PhysicsEngine.cs:line 123
  at NavalGame.World.UpdatePhysics() in World.cs:line 890
  at NavalGame.GameLoop.Tick() in GameLoop.cs:line 1456
  at NavalGame.Engine.Run() in Engine.cs:line 89
  at NavalGame.Main.Start() in Main.cs:line 45
  at System.AppDomain._nExecuteAssembly(RuntimeAssembly assembly, String[] args)
  at System.Threading.ThreadHelper.ThreadStart()`,

  `InvalidOperationException: Collection was modified; enumeration operation may not execute
  at System.Collections.Generic.List.Enumerator.MoveNextRare()
  at NavalGame.Guild.UpdateMembers() in Guild.cs:line 234
  at NavalGame.Guild.ProcessEvents() in Guild.cs:line 567
  at NavalGame.Social.GuildManager.Update() in GuildManager.cs:line 890
  at NavalGame.GameLoop.UpdateSocialSystems() in GameLoop.cs:line 1234
  at NavalGame.GameLoop.Tick() in GameLoop.cs:line 1456
  at NavalGame.Engine.Run() in Engine.cs:line 89
  at NavalGame.Main.Start() in Main.cs:line 45
  at System.AppDomain._nExecuteAssembly(RuntimeAssembly assembly, String[] args)
  at System.Threading.ThreadHelper.ThreadStart()`,

  `TimeoutException: The operation has timed out
  at System.Net.Sockets.Socket.Receive(Byte[] buffer, Int32 offset, Int32 size, SocketFlags socketFlags)
  at NavalGame.Network.TcpClient.ReceiveData() in TcpClient.cs:line 345
  at NavalGame.Network.NetworkManager.PollServer() in NetworkManager.cs:line 678
  at NavalGame.Network.NetworkManager.Update() in NetworkManager.cs:line 234
  at NavalGame.GameLoop.UpdateNetwork() in GameLoop.cs:line 1123
  at NavalGame.GameLoop.Tick() in GameLoop.cs:line 1456
  at NavalGame.Engine.Run() in Engine.cs:line 89
  at NavalGame.Main.Start() in Main.cs:line 45
  at System.AppDomain._nExecuteAssembly(RuntimeAssembly assembly, String[] args)
  at System.Threading.ThreadHelper.ThreadStart()`,
];

// Generate realistic log content with variable length
function generateLogContent(lineCount: number): string {
  const logLevels = ['INFO', 'DEBUG', 'WARN', 'ERROR'];
  const logMessages = [
    'Game client started',
    'Loading configuration from config.xml',
    'Initializing graphics engine',
    'Creating DirectX device',
    'Loading shader programs',
    'Initializing audio system',
    'Connecting to game server',
    'Authenticating user credentials',
    'Loading player data from server',
    'Initializing world map',
    'Loading port data',
    'Loading ship models',
    'Loading texture atlases',
    'Compiling shader: ocean_water.hlsl',
    'Compiling shader: ship_hull.hlsl',
    'Creating render targets',
    'Initializing physics engine',
    'Loading collision meshes',
    'Starting game loop',
    'Player entered port: Lisbon',
    'Player entered port: Seville',
    'Player entered port: London',
    'Trade window opened',
    'Inventory updated',
    'Ship cargo weight calculated',
    'Navigation route calculated',
    'Weather system updated',
    'Ocean waves simulated',
    'Ship position synchronized',
    'Network packet received',
    'Network packet sent',
    'Guild data synchronized',
    'Quest state updated',
    'Achievement unlocked',
    'Item equipped',
    'Skill level increased',
    'Experience points gained',
    'High latency detected: 250ms',
    'Connection timeout warning',
    'Retrying connection...',
    'Memory usage: 1.2GB / 4.0GB',
    'Memory usage: 2.5GB / 4.0GB',
    'Memory usage: 3.8GB / 4.0GB',
    'Low memory warning',
    'Garbage collection triggered',
    'Texture cache cleared',
    'Model cache cleared',
    'Audio buffer underrun',
    'Frame rate dropped below 30 FPS',
    'GPU driver timeout detected',
    'Null reference exception in Ship.Update()',
    'Index out of range in Inventory.GetItem()',
    'Invalid argument in Network.SendPacket()',
    'Out of memory in TextureManager.LoadTexture()',
    'Stack overflow in PathFinding.FindPath()',
    'Access violation in CollisionDetector.CheckCollision()',
    'Invalid operation in Guild.UpdateMembers()',
    'Timeout in NetworkManager.PollServer()',
    'Database connection lost',
    'Failed to save player data',
    'Failed to load resource file',
    'Shader compilation failed',
    'Render target creation failed',
    'Audio device initialization failed',
    'Network socket error',
    'File not found: data/ships/galleon.mdl',
    'File not found: textures/ocean/wave_normal.dds',
    'Permission denied: save/player.dat',
    'Disk full: unable to write log file',
    'Application terminated abnormally',
  ];

  const lines: string[] = [];
  const startTime = Date.now() - lineCount * 100; // Simulate logs over time

  for (let i = 0; i < lineCount; i++) {
    const timestamp = new Date(startTime + i * 100).toISOString();
    const level = randomElement(logLevels);
    const message = randomElement(logMessages);
    lines.push(`[${timestamp}] [${level}] ${message}`);
  }

  return lines.join('\n');
}

// Generate random element from array
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate random integer between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random date within last 30 days
function randomDate(): Date {
  const now = new Date();
  const daysAgo = randomInt(0, 30);
  const hoursAgo = randomInt(0, 23);
  const minutesAgo = randomInt(0, 59);
  const secondsAgo = randomInt(0, 59);

  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(date.getMinutes() - minutesAgo);
  date.setSeconds(date.getSeconds() - secondsAgo);

  return date;
}

// Generate MD5 hash
function generateMD5(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

// Generate crash groups
async function generateCrashGroups(count: number = 500): Promise<string[]> {
  console.log(`Generating ${count} crash groups...`);

  const crashIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const stackTrace = randomElement(stackTraces);
    const md5Hash = generateMD5(stackTrace + i); // Add index to ensure uniqueness
    const branch = randomElement(branches);
    const platform = randomElement(platforms);
    const environment = randomElement(environments);
    const firstVersion = randomElement(appVersions);
    const lastVersion = randomElement(appVersions);
    const firstCrash = randomDate();
    const lastCrash = new Date(firstCrash.getTime() + randomInt(0, 7 * 24 * 60 * 60 * 1000)); // Up to 7 days later

    // Store stack trace file
    const hash = md5Hash;
    const dir1 = hash.substring(0, 2);
    const dir2 = hash.substring(2, 4);
    const stackTraceUrl = `/crashes/${dir1}/${dir2}/${hash}`;

    // Create stack trace file
    const stackTraceDir = path.join(process.cwd(), 'public', 'crashes', dir1, dir2);
    await fs.mkdir(stackTraceDir, { recursive: true });
    await fs.writeFile(path.join(stackTraceDir, hash), stackTrace, 'utf8');

    const crashId = generateULID();

    await knex('crashes').insert({
      id: crashId,
      chash: md5Hash,
      branch: branch,
      platform: platform,
      environment: environment,
      crashesState: randomElement([0, 0, 0, 1, 3]), // Mostly open, some closed/resolved
      crashesCount: randomInt(1, 100),
      maxAppVersion: lastVersion,
      maxResVersion: randomElement(resVersions),
      firstCrashAt: firstCrash,
      lastCrashAt: lastCrash,
      stackFilePath: stackTraceUrl,
      firstLine: stackTrace.split('\n')[0].substring(0, 200),
      createdAt: firstCrash,
      updatedAt: lastCrash,
    });

    crashIds.push(crashId);

    if ((i + 1) % 50 === 0) {
      console.log(`  Created ${i + 1}/${count} crash groups`);
    }
  }

  console.log(`✓ Created ${count} crash groups`);
  return crashIds;
}

// Generate crash events
async function generateCrashEvents(crashIds: string[], eventsPerCrash: number = 20): Promise<void> {
  const totalEvents = crashIds.length * eventsPerCrash;
  console.log(`Generating ${totalEvents} crash events (${eventsPerCrash} per crash group)...`);

  let eventCount = 0;
  let gameUserIdCounter = 2000; // Starting game user ID

  for (const crashId of crashIds) {
    // Get crash info
    const crash = await knex('crashes').where('id', crashId).first();

    const events = [];
    for (let i = 0; i < eventsPerCrash; i++) {
      const createdAt = randomDate();
      const year = createdAt.getFullYear();
      const month = String(createdAt.getMonth() + 1).padStart(2, '0');
      const day = String(createdAt.getDate()).padStart(2, '0');

      const eventId = generateULID();
      const logFileUrl = `/crashes/logs/${year}/${month}/${day}/${eventId}.txt`;

      // Generate log file with random line count (30 to 30000 lines)
      const logLineCount = randomInt(30, 30000);
      const logDir = path.join(
        process.cwd(),
        'public',
        'crashes',
        'logs',
        String(year),
        month,
        day
      );
      await fs.mkdir(logDir, { recursive: true });
      const logContent = generateLogContent(logLineCount);
      await fs.writeFile(path.join(logDir, `${eventId}.txt`), logContent, 'utf8');

      // Generate account ID in format like "20332433333" (11 digits)
      const accountId = `20${String(randomInt(100000000, 999999999))}`;

      events.push({
        id: eventId,
        crashId: crashId,
        platform: crash.platform,
        environment: crash.environment,
        branch: crash.branch,
        marketType: randomElement(marketTypes),
        isEditor: Math.random() < 0.1, // 10% chance of being editor
        appVersion: randomElement(appVersions),
        resVersion: randomElement(resVersions),
        accountId: accountId,
        characterId: String(randomInt(100000, 999999)),
        gameUserId: String(gameUserIdCounter++),
        userName: randomElement(userNames),
        userMessage: randomElement(userMessages),
        logFilePath: logFileUrl,
        createdAt: createdAt,
      });
    }

    // Insert in batches
    await knex('crash_events').insert(events);

    eventCount += eventsPerCrash;
    if (eventCount % 500 === 0) {
      console.log(`  Created ${eventCount}/${totalEvents} crash events`);
    }
  }

  console.log(`✓ Created ${totalEvents} crash events`);
}

// Main function
async function main() {
  try {
    console.log('Starting crash events seeding...\n');

    // Clear existing data
    console.log('Clearing existing data...');
    await knex('crash_events').del();
    await knex('crashes').del();
    console.log('✓ Cleared existing data\n');

    // Generate crash groups (500 groups)
    const crashIds = await generateCrashGroups(500);
    console.log('');

    // Generate crash events (20 events per group = 10000 total)
    await generateCrashEvents(crashIds, 20);
    console.log('');

    console.log('✅ Seeding completed successfully!');
    console.log(`   Total crash groups: ${crashIds.length}`);
    console.log(`   Total crash events: ${crashIds.length * 20}`);
  } catch (error) {
    console.error('❌ Error seeding crash events:', error);
    throw error;
  } finally {
    await knex.destroy();
  }
}

// Run the script
main();
