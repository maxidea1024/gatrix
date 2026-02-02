/**
 * Spawn Multiple Idle Servers
 *
 * Spawns 50 idle servers sequentially with 2-10 second random delays
 * Usage: npx ts-node test-servers/spawn-idle-servers.ts [count] [environment]
 * Example: npx ts-node test-servers/spawn-idle-servers.ts 50 development
 */

import { spawn, ChildProcess } from "child_process";
import path from "path";

const SERVER_COUNT = parseInt(process.argv[2] || "50");
const ENVIRONMENT = process.argv[3] || "development";
const MIN_DELAY_MS = parseInt(process.argv[4] || "2000"); // default 2 seconds
const MAX_DELAY_MS = parseInt(process.argv[5] || "10000"); // default 10 seconds
const BASE_PORT = 11000;

// Groups to distribute servers across
const GROUPS = ["alpha", "beta", "gamma", "delta"];
const REGIONS = ["us-east", "us-west", "eu-west", "ap-northeast"];

const children: ChildProcess[] = [];

function getRandomDelay(): number {
  return (
    Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spawnServer(index: number): Promise<void> {
  const port = BASE_PORT + index;
  const instanceName = `idle-${index.toString().padStart(3, "0")}`;

  console.log(
    `[${new Date().toISOString()}] Starting server ${index + 1}/${SERVER_COUNT}: ${instanceName} on port ${port}`,
  );

  const serverPath = path.join(__dirname, "idle-server.ts");

  // Distribute servers across groups and regions
  const group = GROUPS[index % GROUPS.length];
  const region = REGIONS[index % REGIONS.length];

  const child = spawn("npx", ["ts-node", serverPath, port.toString()], {
    env: {
      ...process.env,
      ENVIRONMENT: ENVIRONMENT,
      INSTANCE_NAME: instanceName,
      METRICS_PORT: port.toString(),
      SERVICE_GROUP: group,
      SERVICE_REGION: region,
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  console.log(
    `[${new Date().toISOString()}]   -> Group: ${group}, Region: ${region}`,
  );

  children.push(child);

  // Log stdout with instance prefix
  child.stdout?.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line: string) => {
      if (line.trim()) {
        console.log(`[${instanceName}] ${line}`);
      }
    });
  });

  // Log stderr with instance prefix
  child.stderr?.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line: string) => {
      if (line.trim()) {
        console.error(`[${instanceName}] ERROR: ${line}`);
      }
    });
  });

  child.on("exit", (code) => {
    console.log(`[${instanceName}] Process exited with code ${code}`);
  });
}

async function main() {
  console.log("=".repeat(60));
  console.log(`Spawning ${SERVER_COUNT} idle servers`);
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(
    `Delay between spawns: ${MIN_DELAY_MS / 1000}-${MAX_DELAY_MS / 1000} seconds`,
  );
  console.log(`Port range: ${BASE_PORT} - ${BASE_PORT + SERVER_COUNT - 1}`);
  console.log("=".repeat(60));
  console.log("");

  for (let i = 0; i < SERVER_COUNT; i++) {
    await spawnServer(i);

    // Don't delay after the last server
    if (i < SERVER_COUNT - 1) {
      const delay = getRandomDelay();
      console.log(
        `[SPAWNER] Waiting ${(delay / 1000).toFixed(1)}s before next server...`,
      );
      await sleep(delay);
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`All ${SERVER_COUNT} servers spawned!`);
  console.log("Press Ctrl+C to stop all servers");
  console.log("=".repeat(60));

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down all servers...");
    children.forEach((child) => {
      child.kill("SIGTERM");
    });
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nShutting down all servers...");
    children.forEach((child) => {
      child.kill("SIGTERM");
    });
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
