/**
 * Real-time Flag Dashboard Example
 *
 * Shows all flags in a fixed table that updates in real-time.
 * The display stays in place and refreshes on changes.
 *
 * Usage:
 *   yarn example:dashboard
 *   npx ts-node examples/dashboard.ts
 *   npx ts-node examples/dashboard.ts --url <url> --token <token>
 *   npx ts-node examples/dashboard.ts --config ./config.json
 */

import { GatrixClient, EVENTS, InMemoryStorageProvider } from '../src';
import { parseConfig } from './config';

// ANSI escape codes for terminal control
const CLEAR_SCREEN = '\x1b[2J';
const CURSOR_HOME = '\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

async function main() {
  const config = parseConfig();

  const client = new GatrixClient({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
    appName: config.appName,
    environment: config.environment,
    storageProvider: new InMemoryStorageProvider(),
    features: {
      refreshInterval: 1,
    },
  });

  const initialVersions: Map<string, number> = new Map();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    process.stdout.write(SHOW_CURSOR);
    console.log('\n\nGoodbye!');
    await client.stop();
    process.exit(0);
  });

  // Track events for initial version capture
  client.on(EVENTS.READY, () => {
    // Capture initial versions
    const flags = client.features.getAllFlags();
    for (const flag of flags) {
      initialVersions.set(flag.name, flag.version || 0);
    }
    render();
  });

  client.on(EVENTS.UPDATE, () => {
    render();
  });

  client.on(EVENTS.ERROR, () => {
    render();
  });

  client.on(EVENTS.RECOVERED, () => {
    render();
  });

  // Render table with auto column widths
  // Each cell can be { text: string, display?: string } where display contains ANSI codes
  type Cell = string | { text: string; display: string };
  const COL_GAP = '    '; // 4 spaces between columns
  function renderTable(headers: string[], rows: Cell[][], indent = '  ', minWidths: number[] = []): string {
    // Calculate max width for each column
    const colWidths = headers.map((h, i) => {
      const cellTexts = rows.map((row) => {
        const cell = row[i];
        return typeof cell === 'string' ? cell : cell.text;
      });
      const minW = minWidths[i] || 0;
      return Math.max(h.length, minW, ...cellTexts.map((t) => t.length));
    });

    let out = '';
    // Header
    out += indent + DIM + headers.map((h, i) => h.padEnd(colWidths[i])).join(COL_GAP) + RESET + '\n';
    out +=
      indent +
      DIM +
      '─'.repeat(colWidths.reduce((a, b) => a + b, 0) + (colWidths.length - 1) * COL_GAP.length) +
      RESET +
      '\n';

    // Rows
    for (const row of rows) {
      const cells = row.map((cell, i) => {
        const text = typeof cell === 'string' ? cell : cell.text;
        const display = typeof cell === 'string' ? cell : cell.display;
        const padding = ' '.repeat(Math.max(0, colWidths[i] - text.length));
        return display + padding;
      });
      out += indent + cells.join(COL_GAP) + '\n';
    }
    return out;
  }

  function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  function formatTimeAgo(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour > 0) {
      return `${diffHour}h ago`;
    } else if (diffMin > 0) {
      return `${diffMin}m ago`;
    } else if (diffSec > 5) {
      return `${diffSec}s ago`;
    }
    return 'just now';
  }

  function render() {
    const flags = client.features.getAllFlags();
    const stats = client.features.getStats();
    const uptime = stats.startTime ? formatUptime(Date.now() - stats.startTime.getTime()) : '0s';

    let output = CURSOR_HOME + CLEAR_SCREEN;

    // Header
    output += `\n  ${BOLD}${CYAN}Gatrix Feature Flags Dashboard${RESET}\n\n`;

    // API info
    output += `  ${'API:'.padEnd(12)} ${DIM}${config.apiUrl}${RESET}\n`;
    output += `  ${'App/Env:'.padEnd(12)} ${DIM}${config.appName} / ${config.environment}${RESET}\n`;

    // Helper to format error details
    const formatError = (err: any): string => {
      if (!err) return '';
      if (err.code === 'ECONNREFUSED') return 'Connection refused';
      if (err.code === 'ETIMEDOUT') return 'Connection timeout';
      if (err.code === 'ENOTFOUND') return 'Host not found';
      if (typeof err.code === 'number') return `HTTP ${err.code}`;
      if (err.message) return err.message.substring(0, 30);
      if (err.type) return err.type;
      return 'Unknown error';
    };

    // Check if still initializing (no flags fetched yet)
    const isInitializing = stats.totalFlagCount === 0 && stats.sdkState !== 'healthy' && stats.sdkState !== 'ready';

    if (isInitializing) {
      // Simplified initializing view
      output += `\n  ${YELLOW}●${RESET} ${'Status:'.padEnd(12)} ${YELLOW}Initializing...${RESET}\n`;
      output += `  ${'Uptime:'.padEnd(12)} ${uptime}\n`;
      output += `  ${'Attempts:'.padEnd(12)} ${stats.fetchFlagsCount}\n`;

      if (stats.lastError) {
        const errDetail = formatError(stats.lastError);
        output += `\n  ${RED}Error:${RESET} ${errDetail}\n`;
        if (stats.lastErrorTime) {
          output += `  ${DIM}Last attempt: ${stats.lastErrorTime.toLocaleTimeString()}${RESET}\n`;
        }
      }

      output += `\n  ${DIM}Waiting for server connection...${RESET}\n`;
      output += `\n  ${DIM}Press Ctrl+C to exit${RESET}\n`;

      process.stdout.write(output);
      return;
    }

    // Status line
    const stateIcon =
      stats.sdkState === 'healthy' || stats.sdkState === 'ready'
        ? `${GREEN}●${RESET}`
        : stats.sdkState === 'error'
          ? `${RED}●${RESET}`
          : `${YELLOW}●${RESET}`;

    // Stats with aligned labels - show error details if in error state
    let statusLine = `${stateIcon} ${stats.sdkState}`;
    if (stats.sdkState === 'error' && stats.lastError) {
      const errDetail = formatError(stats.lastError);
      statusLine += ` ${DIM}(${errDetail})${RESET}`;
    }
    output += `  ${'Status:'.padEnd(12)} ${statusLine}\n`;
    output += `  ${'Uptime:'.padEnd(12)} ${uptime}\n`;

    // Flag counts
    const enabledCount = flags.filter((f) => f.enabled).length;
    const disabledCount = flags.filter((f) => !f.enabled).length;
    output += `  ${'Flags:'.padEnd(12)} ${flags.length} total (${GREEN}${enabledCount} on${RESET} / ${RED}${disabledCount} off${RESET})\n`;

    // Network stats (from SDK stats)
    output += `  ${'Network:'.padEnd(12)} ${DIM}Fetches: ${String(stats.fetchFlagsCount).padStart(4)}  |  Updates: ${String(stats.updateCount).padStart(3)}  |  304s: ${String(stats.notModifiedCount).padStart(4)}${RESET}\n`;
    output += `  ${'Health:'.padEnd(12)} ${DIM}Errors: ${String(stats.errorCount).padStart(3)}  |  Recoveries: ${String(stats.recoveryCount).padStart(3)}  |  Impressions: ${String(stats.impressionCount).padStart(4)}${RESET}\n`;

    // ETag line
    const etagDisplay = stats.etag ? stats.etag.replace(/"/g, '') : '-';
    output += `  ${'ETag:'.padEnd(12)} ${DIM}${etagDisplay}${RESET}\n`;

    // Error/Recovery info
    if (stats.lastErrorTime || stats.lastRecoveryTime) {
      let errorRecoveryLine = `  ${'Events:'.padEnd(12)} ${DIM}`;
      if (stats.lastErrorTime) {
        errorRecoveryLine += `Error @ ${RED}${stats.lastErrorTime.toLocaleTimeString()}${RESET}${DIM}`;
      }
      if (stats.lastRecoveryTime) {
        if (stats.lastErrorTime) errorRecoveryLine += '  →  ';
        errorRecoveryLine += `Recovered @ ${GREEN}${stats.lastRecoveryTime.toLocaleTimeString()}${RESET}`;
      }
      output += errorRecoveryLine + `${RESET}\n`;
    }

    output += `\n`;

    // Build table data as 2D array
    const headers = ['', 'NAME', 'VER', 'CHG', 'VARIANT', 'TYPE', 'LAST_CHG', 'PAYLOAD'];
    const tableRows: Cell[][] = [];
    const currentFlagNames = new Set(flags.map((f) => f.name));

    // Process current flags
    for (const flag of flags) {
      const icon = flag.enabled
        ? { text: '●', display: `${GREEN}●${RESET}` }
        : { text: '●', display: `${RED}●${RESET}` };
      const name = flag.name;
      const ver = String(flag.version || 0);

      // Change indicator
      let chg: Cell = '-';
      if (!initialVersions.has(flag.name)) {
        chg = { text: 'NEW', display: `${GREEN}NEW${RESET}` };
        initialVersions.set(flag.name, flag.version || 0);
      } else {
        const changes = (flag.version || 0) - initialVersions.get(flag.name)!;
        if (changes > 0) {
          const chgText = `+${changes}`;
          chg = { text: chgText, display: `${YELLOW}${chgText}${RESET}` };
        }
      }

      // Variant with colors
      const rawVariant = flag.variant?.name || '-';
      let variant: Cell = rawVariant;
      if (rawVariant === '-') {
        variant = '-';
      } else if (rawVariant === 'disabled') {
        variant = { text: 'disabled', display: `${RED}disabled${RESET}` };
      } else if (rawVariant === 'config') {
        variant = { text: 'config', display: `${CYAN}config${RESET}` };
      } else if (rawVariant === 'default') {
        variant = { text: 'default', display: `${YELLOW}default${RESET}` };
      } else {
        // General variant names in green
        variant = { text: rawVariant, display: `${GREEN}${rawVariant}${RESET}` };
      }

      const type = flag.variantType || 'none';

      // Last changed time (relative)
      const lastChangedTime = stats.flagLastChangedTimes[flag.name];
      const lastChg = lastChangedTime ? formatTimeAgo(lastChangedTime) : '-';

      // Payload
      let payload = '-';
      if (
        flag.variant?.payload !== undefined &&
        flag.variant?.payload !== null &&
        flag.variant?.payload !== ''
      ) {
        const payloadStr =
          typeof flag.variant.payload === 'object'
            ? JSON.stringify(flag.variant.payload)
            : String(flag.variant.payload);
        payload = payloadStr.length > 40 ? payloadStr.substring(0, 37) + '...' : payloadStr;
      }

      tableRows.push([icon, name, ver, chg, variant, type, lastChg, payload]);
    }

    // Process deleted flags
    for (const [flagName] of initialVersions) {
      if (!currentFlagNames.has(flagName)) {
        const delLastChg = stats.flagLastChangedTimes[flagName];
        const lastChg = delLastChg ? formatTimeAgo(delLastChg) : '-';
        tableRows.push([
          { text: '✗', display: `${RED}✗${RESET}` },
          flagName,
          '-',
          { text: 'DEL', display: `${RED}DEL${RESET}` },
          { text: 'deleted', display: `${DIM}deleted${RESET}` },
          'none',
          lastChg,
          '-',
        ]);
      }
    }

    // Render table with minimum 25 chars for NAME column
    // minWidths: [icon, NAME, VER, CHG, VARIANT, TYPE, LAST_CHG, PAYLOAD]
    output += renderTable(headers, tableRows, '  ', [0, 25, 0, 0, 0, 0, 0, 0]);

    // Footer
    output += `\n  ${DIM}Total: ${flags.length} flags  |  Refresh: 1s  |  Ctrl+C to exit${RESET}\n`;

    process.stdout.write(output);
  }

  try {
    process.stdout.write(HIDE_CURSOR);
    process.stdout.write(CLEAR_SCREEN + CURSOR_HOME);
    console.log('  Starting Gatrix Dashboard...\n');

    await client.start();
    render();

    setInterval(() => render(), 1000);

    await new Promise(() => { });
  } catch (error: any) {
    process.stdout.write(SHOW_CURSOR);
    console.error('Error:', error.message);
    await client.stop();
    process.exit(1);
  }
}

main();
