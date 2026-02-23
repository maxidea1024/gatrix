import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AgentConfig } from '../types';

// ============================================================
// AI agent runner - spawns Claude CLI / Codex CLI / custom CLI
// ============================================================

export interface AgentRunOptions {
  prompt: string;
  workspacePath: string;
  config: AgentConfig;
  logFile: string;
}

export interface AgentRunResult {
  success: boolean;
  exitCode: number;
  timedOut: boolean;
}

/**
 * Run the configured AI agent with the given prompt inside the workspace directory.
 * Streams stdout/stderr to the provided log file.
 */
export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { prompt, workspacePath, config, logFile } = opts;
  const timeoutMs = config.timeoutMinutes * 60 * 1000;

  const command = config.command ?? config.type;
  const extraArgs = config.args ?? [];

  // Build args based on agent type
  // Claude CLI: claude --print <prompt>
  // Codex CLI: codex -q <prompt>
  // Custom: pass prompt via stdin or as last arg
  let args: string[];
  switch (config.type) {
    case 'claude':
      args = ['--print', prompt, ...extraArgs];
      break;
    case 'codex':
      args = ['-q', prompt, ...extraArgs];
      break;
    default:
      // Generic: pass prompt as last argument
      args = [...extraArgs, prompt];
  }

  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: workspacePath,
      shell: false,
      env: { ...process.env },
    });

    proc.stdout.on('data', (data: Buffer) => logStream.write(data));
    proc.stderr.on('data', (data: Buffer) => logStream.write(data));

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeoutMs);

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      logStream.end();
      resolve({
        success: exitCode === 0 && !timedOut,
        exitCode: exitCode ?? -1,
        timedOut,
      });
    });
  });
}
